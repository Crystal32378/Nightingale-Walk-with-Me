import { describe, expect, it, vi } from "vitest";
import routeJson from "../fixtures/route-renai-001.json";
import { createApp } from "../src/server.js";
import { InMemorySessionStore } from "../src/store.js";
import { KeywordInterpreter } from "../src/interpreter.js";
import type { Route } from "../src/types.js";
import { AudioError } from "../src/audio.js";

// Valid container signature; the decoder seam is external CPU work. Audio tests
// above exercise the real decoder. These requests exercise actual Hono routes/store.
const bytes = Buffer.from("RIFF0000WAVEaudio");
async function setup(options: Record<string, unknown> = {}) {
  const store = new InMemorySessionStore(); let calls = 0;
  const app = createApp({ routes: [routeJson as Route], store, interpreter: new KeywordInterpreter(),
    transcription: { decode: async () => bytes, transcriber: { transcribe: async () => { calls++; return "我看見便利商店"; } }, ...options } });
  const start = await app.request("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routeId: "renai-001" }) });
  const { sessionId: id } = await start.json();
  await app.request(`/api/sessions/${id}/observations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "done" }) });
  const post = (data = bytes, mime = "audio/wav") => app.request(`/api/sessions/${id}/transcriptions`, {
    method: "POST", headers: { "Content-Type": mime }, body: data,
  });
  return { app, store, id, post, calls: () => calls };
}

describe("isolated transcription endpoint", () => {
  it.each([true, false])("times out a stalled body (Content-Length present=%s), cancels it and frees the processing slot", async declared => {
    vi.useFakeTimers();
    try {
      const s = await setup(); let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2, 3, 4])); }, cancel() { cancelled = true; } });
      const request = new Request(`http://localhost/api/sessions/${s.id}/transcriptions`, {
        method: "POST", headers: { "Content-Type": "audio/wav", ...(declared ? { "Content-Length": "16" } : {}) }, body: stream, duplex: "half",
      } as RequestInit);
      let status: number | undefined;
      const pending = Promise.resolve(s.app.request(request)).then(response => { status = response.status; });
      await vi.advanceTimersByTimeAsync(29000);
      expect(status).toBe(504); expect(cancelled).toBe(true); await pending;
      expect((await s.post()).status).toBe(200);
    } finally { vi.useRealTimers(); }
  });
  it("cancels an upload on client abort and accepts the next request", async () => {
    const s = await setup(); const controller = new AbortController(); let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); }, cancel() { cancelled = true; } });
    const request = new Request(`http://localhost/api/sessions/${s.id}/transcriptions`, {
      method: "POST", headers: { "Content-Type": "audio/wav", "Content-Length": "16" }, body: stream, signal: controller.signal, duplex: "half",
    } as RequestInit);
    const pending = s.app.request(request);
    await new Promise(resolve => setTimeout(resolve, 5)); controller.abort();
    expect((await pending).status).toBe(504); expect(cancelled).toBe(true);
    expect((await s.post()).status).toBe(200);
  });
  it("ends a stalled quota transaction and never starts delayed model work after timeout", async () => {
    vi.useFakeTimers();
    try {
      const s = await setup(); const update = s.store.update.bind(s.store);
      let release: () => void = () => {};
      const wait = new Promise<void>(r => { release = r; });
      s.store.update = async (...args) => { await wait; return update(...args); };
      let status: number | undefined;
      const pending = Promise.resolve(s.post()).then(response => { status = response.status; });
      await vi.advanceTimersByTimeAsync(29000);
      expect(status).toBe(504); await pending;
      s.store.update = update;
      expect((await s.post()).status).toBe(200);
      release(); await vi.advanceTimersByTimeAsync(1);
      expect(s.calls()).toBe(1);
    } finally { vi.useRealTimers(); }
  });
  it("returns unconfirmed text without observing or changing route state", async () => {
    const s = await setup(); const before = structuredClone(await s.store.get(s.id));
    const res = await s.post();
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ text: "我看見便利商店" });
    const after = await s.store.get(s.id);
    expect(after?.session).toEqual(before?.session); expect(after?.lastAction).toEqual(before?.lastAction);
    expect(after?.audioCount).toBe(1); expect(s.calls()).toBe(1);
    expect(JSON.stringify(after)).not.toContain("我看見便利商店");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("denies recording for both walker crossings without spending model calls", async () => {
    const s = await setup(); const before = (await s.store.get(s.id))!;
    for (const checkpointId of ["cp2x", "cp3x"]) {
      await s.store.put(s.id, { ...before, session: { ...before.session, checkpointId } });
      expect((await s.post()).status).toBe(409);
    }
    expect(s.calls()).toBe(0);
  });
  it("does not withdraw a pending location confirmation", async () => {
    const s = await setup(); const before = (await s.store.get(s.id))!;
    const record = { ...before, pendingTextContinuation: { id: "question", kind: "renai-before-second-crossing" as const, expiresAt: Date.now() + 60000, evidence: ["仁愛路"] } };
    await s.store.put(s.id, record);
    expect((await s.post()).status).toBe(409); expect(await s.store.get(s.id)).toEqual(record);
  });
  it("rejects unsupported format and oversized body before paid work", async () => {
    const s = await setup();
    expect((await s.post(bytes, "text/plain")).status).toBe(415);
    expect((await s.post(Buffer.alloc(2 * 1024 * 1024 + 1))).status).toBe(413);
    expect(s.calls()).toBe(0);
  });
  it("failed decode never reaches the model or consumes the session quota", async () => {
    const s = await setup({ decode: async () => { throw new AudioError("invalid_audio"); } });
    expect((await s.post()).status).toBe(400); expect(s.calls()).toBe(0);
    expect((await s.store.get(s.id))?.audioCount).toBeUndefined();
  });
  it("limits each walk and returns retry information for request throttling", async () => {
    const s = await setup(); const before = (await s.store.get(s.id))!;
    await s.store.put(s.id, { ...before, audioCount: 12 });
    expect((await s.post()).status).toBe(429); expect(s.calls()).toBe(0);
    await s.store.put(s.id, before);
    for (let i = 0; i < 6; i++) expect((await s.post()).status).toBe(200);
    const limited = await s.post(); expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
  it("rejects concurrent paid work and discards a result after a step change", async () => {
    let finish: (text: string) => void = () => {};
    let entered: () => void = () => {}; const started = new Promise<void>(r => { entered = r; });
    const s = await setup({ transcriber: { transcribe: () => { entered(); return new Promise<string>(r => { finish = r; }); } } });
    const first = s.post(); await started;
    expect((await s.post()).status).toBe(429);
    const current = (await s.store.get(s.id))!;
    await s.store.put(s.id, { ...current, session: { ...current.session, checkpointId: "cp2x" } });
    finish("已過馬路"); expect((await first).status).toBe(409);
  });
  it("handles provider failure without exposing private error content", async () => {
    const s = await setup({ transcriber: { transcribe: async () => { throw new AudioError("transcription_limited"); } } });
    const res = await s.post(); expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "transcription_limited" });
  });
});
