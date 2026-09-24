import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { RouteError, startSession, step } from "./engine.js";
import type { Interpreter } from "./interpreter.js";
import type { SessionStore } from "./store.js";
import {
  observationSchema,
  type EngineAction,
  type Observation,
  type Route,
} from "./types.js";

export interface AppDeps {
  routes: Route[];
  store: SessionStore;
  interpreter: Interpreter;
}

function initialAction(route: Route): EngineAction {
  const cp = route.checkpoints.find((x) => x.id === route.start)!;
  return {
    type: "REANCHOR",
    checkpointId: cp.id,
    lookFor: [...cp.expectedLandmarks, ...(cp.arrivalEvidence ?? [])],
  };
}

export function createApp({ routes, store, interpreter }: AppDeps): Hono {
  const app = new Hono();
  const routeById = new Map(routes.map((r) => [r.routeId, r]));

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/routes", (c) =>
    c.json(
      routes.map((r) => ({
        routeId: r.routeId,
        origin: r.origin,
        destination: r.destination,
      })),
    ),
  );

  app.post("/api/sessions", async (c) => {
    const body = await c.req.json().catch(() => null);
    const routeId = typeof body?.routeId === "string" ? body.routeId : "";
    const route = routeById.get(routeId);
    if (!route) return c.json({ error: "unknown route" }, 404);

    const session = startSession(route);
    const action = initialAction(route);
    const sessionId = randomUUID();
    await store.put(sessionId, { session, lastAction: action });
    return c.json({ sessionId, session, action }, 201);
  });

  app.get("/api/sessions/:id", async (c) => {
    const record = await store.get(c.req.param("id"));
    if (!record) return c.json({ error: "unknown session" }, 404);
    return c.json(record);
  });

  app.post("/api/sessions/:id/observations", async (c) => {
    const id = c.req.param("id");
    const record = await store.get(id);
    if (!record) return c.json({ error: "unknown session" }, 404);
    if (record.session.state === "ARRIVED") {
      return c.json({ error: "session already arrived" }, 409);
    }
    const route = routeById.get(record.session.routeId);
    if (!route) return c.json({ error: "route no longer available" }, 500);

    const body = await c.req.json().catch(() => null);
    let observation: Observation;
    if (body?.observation !== undefined) {
      // Structured observations (tests, demo scripts, future Gemini layer)
      // are untrusted input: schema or nothing.
      const parsed = observationSchema.safeParse(body.observation);
      if (!parsed.success) return c.json({ error: "invalid observation" }, 400);
      observation = parsed.data;
    } else if (typeof body?.text === "string" && body.text.trim().length > 0) {
      observation = await interpreter.interpret(body.text, route);
    } else {
      return c.json({ error: "provide text or observation" }, 400);
    }

    try {
      const result = step(route, record.session, observation);
      await store.put(id, { session: result.session, lastAction: result.action });
      // verdict + observation are returned for observability (debug panel), not for UI truth.
      return c.json({ ...result, observation });
    } catch (err) {
      if (err instanceof RouteError) return c.json({ error: err.message }, 409);
      throw err;
    }
  });

  return app;
}
