import { beforeEach, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import routeJson from "../fixtures/fixture-hospital-001.json";
import { KeywordInterpreter } from "../src/interpreter.js";
import { createApp } from "../src/server.js";
import { InMemorySessionStore } from "../src/store.js";
import type { Route } from "../src/types.js";

const route = routeJson as Route;

let app: Hono;

beforeEach(() => {
  app = createApp({
    routes: [route],
    store: new InMemorySessionStore(),
    interpreter: new KeywordInterpreter(),
  });
});

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function createSession(): Promise<string> {
  const res = await post("/api/sessions", { routeId: route.routeId });
  const body = await res.json();
  return body.sessionId;
}

describe("session lifecycle", () => {
  it("health check", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
  });

  it("lists routes without exposing checkpoint internals", async () => {
    const res = await app.request("/api/routes");
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].routeId).toBe(route.routeId);
    expect(body[0].checkpoints).toBeUndefined();
  });

  it("creates a session anchored at the start checkpoint", async () => {
    const res = await post("/api/sessions", { routeId: route.routeId });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session.checkpointId).toBe("cp1");
    expect(body.action).toEqual({
      type: "REANCHOR",
      checkpointId: "cp1",
      lookFor: ["exit 6 sign"],
    });
  });

  it("404s on unknown route and unknown session", async () => {
    expect((await post("/api/sessions", { routeId: "nope" })).status).toBe(404);
    expect((await app.request("/api/sessions/nope")).status).toBe(404);
    expect((await post("/api/sessions/nope/observations", { text: "hi" })).status).toBe(404);
  });
});

describe("observations", () => {
  it("advances on a structured observation", async () => {
    const id = await createSession();
    const res = await post(`/api/sessions/${id}/observations`, {
      observation: { landmarks: ["exit 6 sign"], signage: [], confidence: "high", source: "text" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdict.verdict).toBe("CONFIRMED");
    expect(body.session.checkpointId).toBe("cp2");
    expect(body.action.type).toBe("GUIDE");
  });

  it("rejects malformed structured observations", async () => {
    const id = await createSession();
    const res = await post(`/api/sessions/${id}/observations`, {
      observation: { landmarks: "exit 6 sign" },
    });
    expect(res.status).toBe(400);
  });

  it("interprets free text through the fallback interpreter", async () => {
    const id = await createSession();
    const res = await post(`/api/sessions/${id}/observations`, {
      text: "I just came up and I can see the Exit 6 Sign here",
    });
    const body = await res.json();
    expect(body.observation.landmarks).toEqual(["exit 6 sign"]);
    expect(body.session.checkpointId).toBe("cp2");
  });

  it("rejects empty bodies", async () => {
    const id = await createSession();
    expect((await post(`/api/sessions/${id}/observations`, {})).status).toBe(400);
    expect((await post(`/api/sessions/${id}/observations`, { text: "  " })).status).toBe(400);
  });

  it("persists session state across observations", async () => {
    const id = await createSession();
    await post(`/api/sessions/${id}/observations`, { text: "exit 6 sign" });
    const res = await app.request(`/api/sessions/${id}`);
    const body = await res.json();
    expect(body.session.checkpointId).toBe("cp2");
    expect(body.lastAction.type).toBe("GUIDE");
  });

  it("409s once arrived", async () => {
    const id = await createSession();
    const store: string[] = ["exit 6 sign", "green pharmacy sign", "footbridge", "blue outpatient signpost", "outpatient entrance sign"];
    for (const text of store) {
      await post(`/api/sessions/${id}/observations`, { text });
    }
    const after = await post(`/api/sessions/${id}/observations`, { text: "anything" });
    expect(after.status).toBe(409);
  });
});
