import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import renaiJson from "../fixtures/route-renai-001.json";
import { buildPhotoPrompt, GeminiInterpreter, type LlmClient } from "../src/gemini.js";
import { KeywordInterpreter, type PhotoInput } from "../src/interpreter.js";
import { createApp, MAX_PHOTO_BASE64_CHARS } from "../src/server.js";
import { InMemorySessionStore } from "../src/store.js";
import type { Route } from "../src/types.js";

const route = renaiJson as Route;
const photo: PhotoInput = { mimeType: "image/jpeg", data: "" };
beforeAll(async () => {
  photo.data = (await sharp({ create: { width: 320, height: 240, channels: 3, background: "#888" } }).jpeg().toBuffer()).toString("base64");
});
const seeing = (raw: string): LlmClient => ({
  generate: async () => "{}",
  generateWithImage: async () => raw,
});

describe("photo interpretation", () => {
  it("prompt carries the vocabulary and forbids guessing unreadable text", () => {
    const p = buildPhotoPrompt(route);
    expect(p).toContain("- 出口2");
    expect(p).toContain("do not guess");
  });

  it("returns the model's reading, stamped as a photo observation", async () => {
    const gi = new GeminiInterpreter(
      seeing('{"landmarks":[],"signage":["出口2","SOGO復興館"],"confidence":"high","source":"text"}'),
      new KeywordInterpreter(),
    );
    const obs = await gi.interpretPhoto(photo, route);
    expect(obs.signage).toEqual(["出口2", "SOGO復興館"]);
    expect(obs.source).toBe("photo");
  });

  it("yields no evidence on prose, throw, timeout, or a client that cannot see", async () => {
    const cases: LlmClient[] = [
      seeing("I think this is the exit."),
      { generate: async () => "", generateWithImage: async () => { throw new Error("vertex down"); } },
      { generate: async () => "", generateWithImage: () => new Promise(() => {}) },
      { generate: async () => "" },
    ];
    for (const client of cases) {
      const obs = await new GeminiInterpreter(client, new KeywordInterpreter(), 8000, 20).interpretPhoto(photo, route);
      expect(obs.landmarks).toEqual([]);
      expect(obs.signage).toEqual([]);
      expect(obs.source).toBe("photo");
    }
  });
});

describe("photo observations over HTTP", () => {
  const app = (interpreter = new GeminiInterpreter(
    seeing('{"landmarks":[],"signage":["出口2"],"confidence":"high"}'),
    new KeywordInterpreter(),
  )) => createApp({ routes: [route], store: new InMemorySessionStore(), interpreter });
  const post = async (a: ReturnType<typeof app>, path: string, body: unknown) => {
    const res = await a.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };

  it("a readable exit-2 sign advances the walk", async () => {
    const a = app();
    const { json: s } = await post(a, "/api/sessions", { routeId: route.routeId });
    const { status, json } = await post(a, `/api/sessions/${s.sessionId}/observations`, { photo });
    expect(status).toBe(200);
    expect(json.verdict.verdict).toBe("CONFIRMED");
    expect(json.session.checkpointId).toBe("cp2");
  });

  it("an interpreter that cannot see never moves the walk", async () => {
    const a = app(new KeywordInterpreter() as unknown as GeminiInterpreter);
    const { json: s } = await post(a, "/api/sessions", { routeId: route.routeId });
    const { json } = await post(a, `/api/sessions/${s.sessionId}/observations`, { photo });
    expect(json.verdict.verdict).toBe("UNKNOWN");
    expect(json.session.checkpointId).toBe("cp1");
  });

  it("rejects bad mime types, non-base64, empty and oversized photos", async () => {
    const a = app();
    const { json: s } = await post(a, "/api/sessions", { routeId: route.routeId });
    for (const bad of [
      { mimeType: "image/gif", data: "AAAA" },
      { mimeType: "image/jpeg", data: "not base64!" },
      { mimeType: "image/jpeg", data: "" },
      { mimeType: "image/jpeg", data: "A".repeat(MAX_PHOTO_BASE64_CHARS + 4) },
    ]) {
      const { status } = await post(a, `/api/sessions/${s.sessionId}/observations`, { photo: bad });
      expect(status).toBe(400);
    }
  });
});
