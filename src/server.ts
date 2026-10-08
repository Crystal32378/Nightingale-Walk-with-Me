import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { RouteError, startSession, step } from "./engine.js";
import {
  EMPTY_PHOTO_OBSERVATION,
  PHOTO_MIME_TYPES,
  type Interpreter,
  type PhotoInput,
} from "./interpreter.js";
import { clientKey, DEFAULT_PHOTO_LIMITS, SlidingWindow, type PhotoLimits } from "./limits.js";
import { inspectPhoto } from "./photo.js";
import { registerTranscriptions, type TranscriptionDeps } from "./transcriptionRoutes.js";
import { confirmTextContinuation, textFollowUp, withTextAlias, withoutTextContinuation } from "./textFollowUp.js";
import type { SessionStore } from "./store.js";
import {
  observationSchema,
  UNKNOWN_ZONE,
  type EngineAction,
  type LocationFix,
  type Observation,
  type Route,
  type SessionSnapshot,
} from "./types.js";

/** ~4.5 MB of image; the client downsizes before upload. */
export const MAX_PHOTO_BASE64_CHARS = 6_000_000;

export interface AppDeps {
  routes: Route[];
  store: SessionStore;
  interpreter: Interpreter;
  photoLimits?: PhotoLimits;
  now?: () => number;
  transcription?: TranscriptionDeps;
}

function initialAction(route: Route): EngineAction {
  const cp = route.checkpoints.find((x) => x.id === route.start)!;
  return {
    type: "REANCHOR",
    checkpointId: cp.id,
    lookFor: [...cp.expectedLandmarks, ...(cp.arrivalEvidence ?? [])],
  };
}

/** What the next confirmation has to be: evidence (text/photo), or the walker saying this step is done. */
function expects(route: Route, session: SessionSnapshot): "evidence" | "walker" {
  return route.checkpoints.find((c) => c.id === session.checkpointId)?.confirmBy === "walker" ? "walker" : "evidence";
}

export function createApp({
  routes,
  store,
  interpreter,
  photoLimits = DEFAULT_PHOTO_LIMITS,
  now = Date.now,
  transcription,
}: AppDeps): Hono {
  const app = new Hono();
  const routeById = new Map(routes.map((r) => [r.routeId, r]));
  const perClient = new SlidingWindow(photoLimits.perClient.max, photoLimits.perClient.windowMs, now);
  const perInstance = new SlidingWindow(photoLimits.perInstance.max, photoLimits.perInstance.windowMs, now);

  // Production serves the frontend from the same origin (Firebase rewrite);
  // this is for local dev and preview deploys. No credentials are involved.
  app.use("/api/*", cors());
  if (transcription) registerTranscriptions(app, routes, store, transcription, now);

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/routes", (c) =>
    c.json(
      routes.map((r) => ({
        routeId: r.routeId,
        origin: r.origin,
        destination: r.destination,
        // Public street corners; the phone maps its own position onto them locally.
        zones: r.zones ?? [],
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
    return c.json({ sessionId, session, action, expects: expects(route, session) }, 201);
  });

  app.get("/api/sessions/:id", async (c) => {
    const record = await store.get(c.req.param("id"));
    if (!record) return c.json({ error: "unknown session" }, 404);
    return c.json(record);
  });

  app.post("/api/sessions/:id/observations", async (c) => {
    const id = c.req.param("id");
    let record = await store.get(id);
    if (!record) return c.json({ error: "unknown session" }, 404);
    const requestCheckpoint = record.session.checkpointId;
    if (record.session.state === "ARRIVED") {
      return c.json({ error: "session already arrived" }, 409);
    }
    const route = routeById.get(record.session.routeId);
    if (!route) return c.json({ error: "route no longer available" }, 500);

    const body = await c.req.json().catch(() => null);

    let location: LocationFix | undefined;
    if (body?.location !== undefined) {
      const zone = (body.location as Record<string, unknown> | null)?.zone;
      const known = new Set([UNKNOWN_ZONE, ...(route.zones ?? []).map((z) => z.id)]);
      if (typeof zone !== "string" || !known.has(zone)) return c.json({ error: "invalid location" }, 400);
      location = { zone };
    }

    const inputKeys = ["text", "photo", "observation", "confirm", "confirmation"].filter(key => body?.[key] !== undefined);
    if (inputKeys.length !== 1) return c.json({ error: "provide exactly one observation or confirmation" }, 400);
    if (body.confirmation !== undefined) {
      const answer = body.confirmation;
      if (typeof answer?.id !== "string" || !["confirm", "cancel"].includes(answer?.answer)) {
        return c.json({ error: "invalid confirmation" }, 400);
      }
      try {
        const result = await store.update(id, current => {
          const value = confirmTextContinuation(route, current, answer, location, now());
          return { record: { ...withoutTextContinuation(current), session: value.session, lastAction: value.action }, value };
        });
        if (!result) return c.json({ error: "unknown session" }, 404);
        return c.json({ ...result, expects: expects(route, result.session) });
      } catch (err) {
        if (err instanceof RouteError) return c.json({ error: err.message }, 409);
        throw err;
      }
    }
    // A different observation withdraws the old question, even if its photo later fails validation.
    if (record.pendingTextContinuation) {
      const current = await store.update(id, latest => {
        const clean = withoutTextContinuation(latest);
        return { record: clean, value: clean };
      });
      if (!current) return c.json({ error: "unknown session" }, 404);
      record = current;
      if (record.session.state === "ARRIVED") return c.json({ error: "session already arrived" }, 409);
    }

    let observation: Observation;
    let rawText: string | undefined;
    if (body?.confirm === "done") {
      observation = { landmarks: [], signage: [], confidence: "high", source: "walker" };
    } else if (body?.observation !== undefined) {
      // Structured observations (tests, demo scripts, future Gemini layer)
      // are untrusted input: schema or nothing.
      const parsed = observationSchema.safeParse(body.observation);
      if (!parsed.success) return c.json({ error: "invalid observation" }, 400);
      observation = parsed.data;
    } else if (body?.photo !== undefined) {
      const photo = body.photo as Record<string, unknown> | null;
      const mimeType = photo?.mimeType;
      const data = photo?.data;
      if (
        typeof mimeType !== "string" ||
        !(PHOTO_MIME_TYPES as readonly string[]).includes(mimeType) ||
        typeof data !== "string" ||
        data.length === 0 ||
        data.length > MAX_PHOTO_BASE64_CHARS ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
      ) {
        return c.json({ error: "invalid photo" }, 400);
      }
      const input: PhotoInput = { mimeType: mimeType as PhotoInput["mimeType"], data };
      if (!inspectPhoto(input).ok) return c.json({ error: "invalid photo" }, 400);

      // Cost gate: cheapest check first, and a throttled client never spends the shared budget.
      const photoCount = record.photoCount ?? 0;
      if (photoCount >= photoLimits.perSession) {
        return c.json({ error: "photo limit reached for this walk" }, 429);
      }
      const wait =
        perClient.take(clientKey(c.req.header("x-forwarded-for"))) ||
        perInstance.take("all");
      if (wait > 0) {
        c.header("Retry-After", String(Math.ceil(wait / 1000)));
        return c.json({ error: "too many photos, try again shortly" }, 429);
      }
      const allowed = await store.update(id, current => {
        const count = current.photoCount ?? 0;
        return count >= photoLimits.perSession
          ? { record: current, value: false }
          : { record: { ...withoutTextContinuation(current), photoCount: count + 1 }, value: true };
      });
      if (allowed === undefined) return c.json({ error: "unknown session" }, 404);
      if (!allowed) return c.json({ error: "photo limit reached for this walk" }, 429);

      observation = interpreter.interpretPhoto
        ? await interpreter.interpretPhoto(input, route)
        : EMPTY_PHOTO_OBSERVATION;
    } else if (typeof body?.text === "string" && body.text.trim().length > 0) {
      rawText = body.text;
      observation = withTextAlias(route, body.text, await interpreter.interpret(body.text, route));
    } else {
      return c.json({ error: "provide text, photo, confirm or observation" }, 400);
    }

    try {
      const followUpId = randomUUID();
      const result = await store.update(id, current => {
        if (current.session.checkpointId !== requestCheckpoint) throw new RouteError("checkpoint changed; submit a new observation");
        let value = step(route, current.session, observation, location);
        const followUp = rawText === undefined ? undefined : textFollowUp(route, current, value, observation, rawText, now(), followUpId);
        if (followUp) value = followUp.result;
        return { record: { ...withoutTextContinuation(current), session: value.session, lastAction: value.action,
          ...(followUp?.pending ? { pendingTextContinuation: followUp.pending } : {}),
        }, value };
      });
      if (!result) return c.json({ error: "unknown session" }, 404);
      // verdict + observation are returned for observability (debug panel), not for UI truth.
      return c.json({ ...result, observation, expects: expects(route, result.session) });
    } catch (err) {
      if (err instanceof RouteError) return c.json({ error: err.message }, 409);
      throw err;
    }
  });

  return app;
}
