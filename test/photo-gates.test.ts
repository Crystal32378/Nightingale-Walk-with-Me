import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import renaiJson from "../fixtures/route-renai-001.json";
import { GeminiInterpreter, type LlmClient } from "../src/gemini.js";
import { KeywordInterpreter, type PhotoInput } from "../src/interpreter.js";
import { clientKey, DEFAULT_PHOTO_LIMITS, SlidingWindow, type PhotoLimits } from "../src/limits.js";
import { inspectPhoto } from "../src/photo.js";
import { createApp } from "../src/server.js";
import { FirestoreSessionStore, InMemorySessionStore, type DocCollection } from "../src/store.js";
import type { Route } from "../src/types.js";

const route = renaiJson as Route;
const img = async (format: "jpeg" | "png" | "webp", width = 320, height = 240) =>
  (await sharp({ create: { width, height, channels: 3, background: "#777" } })[format]().toBuffer()).toString("base64");

let jpeg = "";
let png = "";
let webp = "";
beforeAll(async () => {
  [jpeg, png, webp] = await Promise.all([img("jpeg"), img("png"), img("webp")]);
});

describe("photo format gate", () => {
  it("accepts real jpeg, png and webp with their own type", () => {
    expect(inspectPhoto({ mimeType: "image/jpeg", data: jpeg })).toEqual({ ok: true, width: 320, height: 240 });
    expect(inspectPhoto({ mimeType: "image/png", data: png }).ok).toBe(true);
    expect(inspectPhoto({ mimeType: "image/webp", data: webp }).ok).toBe(true);
  });

  it("rejects bytes that do not match the declared type", () => {
    expect(inspectPhoto({ mimeType: "image/jpeg", data: png }).ok).toBe(false);
    expect(inspectPhoto({ mimeType: "image/webp", data: jpeg }).ok).toBe(false);
    const html = Buffer.from("<html><script>alert(1)</script></html>").toString("base64");
    expect(inspectPhoto({ mimeType: "image/png", data: html }).ok).toBe(false);
  });

  it("rejects a valid signature with a broken header", () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0x41)]).toString("base64");
    expect(inspectPhoto({ mimeType: "image/jpeg", data: fake }).ok).toBe(false);
  });

  it("rejects images too small or too large to be a phone photo of a sign", async () => {
    expect(inspectPhoto({ mimeType: "image/png", data: await img("png", 32, 32) }).ok).toBe(false);
    expect(inspectPhoto({ mimeType: "image/png", data: await img("png", 5000, 100) }).ok).toBe(false);
  });
});

describe("photo cost gate", () => {
  const seeing: LlmClient = { generate: async () => "{}", generateWithImage: async () => '{"landmarks":[],"signage":[],"confidence":"low"}' };
  let calls = 0;
  const counting: LlmClient = { ...seeing, generateWithImage: async (p, i) => { calls++; return seeing.generateWithImage!(p, i); } };

  const setup = (limits: PhotoLimits, clock = { t: 0 }) => {
    calls = 0;
    const app = createApp({
      routes: [route],
      store: new InMemorySessionStore(),
      interpreter: new GeminiInterpreter(counting, new KeywordInterpreter()),
      photoLimits: limits,
      now: () => clock.t,
    });
    const post = async (path: string, body: unknown, ip = "1.1.1.1") => {
      const res = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
        body: JSON.stringify(body),
      });
      return { status: res.status, retryAfter: res.headers.get("retry-after"), json: await res.json() };
    };
    const walk = async (ip?: string) => (await post("/api/sessions", { routeId: route.routeId }, ip)).json.sessionId as string;
    const shoot = (id: string, ip?: string, p: PhotoInput = { mimeType: "image/jpeg", data: jpeg }) =>
      post(`/api/sessions/${id}/observations`, { photo: p }, ip);
    return { walk, shoot, clock };
  };
  const loose = { max: 1000, windowMs: 60_000 };

  it("caps photos per walk, and a refused photo is never read", async () => {
    const { walk, shoot } = setup({ perSession: 2, perClient: loose, perInstance: loose });
    const id = await walk();
    expect((await shoot(id)).status).toBe(200);
    expect((await shoot(id)).status).toBe(200);
    const third = await shoot(id);
    expect(third.status).toBe(429);
    expect(third.json.error).toMatch(/limit/);
    expect(calls).toBe(2);
    expect((await shoot(await walk())).status).toBe(200);
  });

  it("an invalid photo does not use up the walk's allowance", async () => {
    const { walk, shoot } = setup({ perSession: 1, perClient: loose, perInstance: loose });
    const id = await walk();
    expect((await shoot(id, undefined, { mimeType: "image/jpeg", data: png })).status).toBe(400);
    expect((await shoot(id)).status).toBe(200);
  });

  it("throttles one client with Retry-After, then lets it back in", async () => {
    const { walk, shoot, clock } = setup({ perSession: 100, perClient: { max: 2, windowMs: 60_000 }, perInstance: loose });
    const id = await walk();
    await shoot(id);
    clock.t = 10_000;
    await shoot(id);
    const r = await shoot(id);
    expect(r.status).toBe(429);
    expect(r.retryAfter).toBe("50");
    expect((await shoot(await walk("2.2.2.2"), "2.2.2.2")).status).toBe(200);
    clock.t = 60_001;
    expect((await shoot(id)).status).toBe(200);
  });

  it("bounds the whole instance, and a throttled client cannot spend that shared budget", async () => {
    const { walk, shoot } = setup({ perSession: 100, perClient: { max: 1, windowMs: 60_000 }, perInstance: { max: 2, windowMs: 60_000 } });
    expect((await shoot(await walk("a"), "a")).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await shoot(await walk("a"), "a")).status).toBe(429);
    expect((await shoot(await walk("b"), "b")).status).toBe(200);
    expect((await shoot(await walk("c"), "c")).status).toBe(429);
    expect(calls).toBe(2);
  });

  it("defaults stay small: 8 per walk, 12 per minute per instance", () => {
    expect(DEFAULT_PHOTO_LIMITS.perSession).toBe(8);
    expect(DEFAULT_PHOTO_LIMITS.perInstance).toEqual({ max: 12, windowMs: 60_000 });
  });
});

describe("limit helpers", () => {
  it("keys on the first forwarded hop and falls back to a shared bucket", () => {
    expect(clientKey("203.0.113.9, 10.0.0.1")).toBe("203.0.113.9");
    expect(clientKey(undefined)).toBe("unknown");
    expect(clientKey("x".repeat(100))).toBe("unknown");
  });

  it("a sliding window forgets old hits", () => {
    let t = 0;
    const w = new SlidingWindow(1, 1000, () => t);
    expect(w.take("k")).toBe(0);
    expect(w.take("k")).toBe(1000);
    t = 1000;
    expect(w.take("k")).toBe(0);
  });

  it("the photo count survives the Firestore store", async () => {
    const docs: Record<string, unknown> = {};
    const col: DocCollection = {
      doc: (id) => ({ get: async () => ({ exists: id in docs, data: () => docs[id] }), set: async (d) => { docs[id] = d; } }),
    };
    const store = new FirestoreSessionStore(col);
    const rec = {
      session: { routeId: "renai-001", state: "AT_CHECKPOINT" as const, checkpointId: "cp1", questionCount: 0 },
      lastAction: { type: "REANCHOR" as const, checkpointId: "cp1", lookFor: [] },
      photoCount: 3,
    };
    await store.put("s", rec);
    expect((await store.get("s"))?.photoCount).toBe(3);
  });
});
