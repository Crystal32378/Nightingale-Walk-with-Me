import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { AUDIO_MIME_TYPES, AudioError, decodeAudio, MAX_AUDIO_BYTES } from "./audio.js";
import { clientKey, SlidingWindow } from "./limits.js";
import type { SessionRecord, SessionStore } from "./store.js";
import { validateTranscript, type Transcriber } from "./transcription.js";
import type { Route } from "./types.js";

export interface TranscriptionDeps {
  transcriber: Transcriber;
  decode?: typeof decodeAudio;
}

export function registerTranscriptions(app: Hono, routes: Route[], store: SessionStore, deps: TranscriptionDeps, now: () => number) {
  const perClient = new SlidingWindow(6, 60000, now);
  const perInstance = new SlidingWindow(10, 60000, now);
  let active = false;
  const path = "/api/sessions/:id/transcriptions";
  const eligible = (record: SessionRecord | undefined) => {
    if (!record || record.session.state === "ARRIVED" || record.pendingTextContinuation) return false;
    const cp = routes.find(r => r.routeId === record.session.routeId)?.checkpoints.find(c => c.id === record.session.checkpointId);
    return !!cp && cp.confirmBy !== "walker";
  };
  const identity = (record: SessionRecord) => JSON.stringify([record.session, record.lastAction, record.pendingTextContinuation]);
  app.use(path, async (c, next) => { c.header("Cache-Control", "no-store"); await next(); });
  app.use(path, bodyLimit({ maxSize: MAX_AUDIO_BYTES, onError: c => c.json({ error: "audio_too_large" }, 413) }));
  app.post(path, async c => {
    const id = c.req.param("id");
    const initial = await store.get(id);
    if (!initial) return c.json({ error: "unknown_session" }, 404);
    if (!eligible(initial)) return c.json({ error: "voice_not_available_here" }, 409);
    if ((initial.audioCount ?? 0) >= 12) return c.json({ error: "audio_session_limit" }, 429);
    const mime = c.req.header("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    if (!AUDIO_MIME_TYPES.includes(mime)) return c.json({ error: "unsupported_audio" }, 415);
    if (active) { c.header("Retry-After", "5"); return c.json({ error: "transcription_limited" }, 429); }
    const wait = perClient.take(clientKey(c.req.header("x-forwarded-for"))) || perInstance.take("all");
    if (wait) { c.header("Retry-After", String(Math.ceil(wait / 1000))); return c.json({ error: "transcription_limited" }, 429); }
    active = true;
    const controller = new AbortController();
    const abort = () => controller.abort();
    c.req.raw.signal.addEventListener("abort", abort, { once: true });
    const deadline = setTimeout(abort, 28000);
    try {
      if (c.req.raw.signal.aborted) abort();
      const bytes = Buffer.from(await c.req.arrayBuffer());
      const wav = await (deps.decode ?? decodeAudio)(bytes, mime, controller.signal);
      const allowed = await store.update(id, current => {
        if (!eligible(current) || identity(current) !== identity(initial)) return { record: current, value: "changed" };
        if ((current.audioCount ?? 0) >= 12) return { record: current, value: "limited" };
        return { record: { ...current, audioCount: (current.audioCount ?? 0) + 1 }, value: "ok" };
      });
      if (allowed !== "ok") return c.json({ error: allowed === "limited" ? "audio_session_limit" : "voice_step_changed" }, allowed === "limited" ? 429 : 409);
      const text = validateTranscript(await deps.transcriber.transcribe(wav, controller.signal));
      if (controller.signal.aborted) throw new AudioError("cancelled");
      const current = await store.get(id);
      if (!current || !eligible(current) || identity(current) !== identity(initial)) return c.json({ error: "voice_step_changed" }, 409);
      return c.json({ text });
    } catch (err) {
      const code = err instanceof AudioError ? err.code : "transcription_failed";
      if (code === "transcription_limited") { c.header("Retry-After", "30"); return c.json({ error: code }, 429); }
      if (code === "audio_too_large") return c.json({ error: code }, 413);
      if (["invalid_audio", "audio_too_long"].includes(code)) return c.json({ error: code }, 400);
      if (["speech_unclear", "invalid_transcript"].includes(code)) return c.json({ error: code }, 422);
      if (["transcription_timeout", "audio_decode_timeout", "cancelled"].includes(code)) return c.json({ error: code }, 504);
      return c.json({ error: "transcription_failed" }, 503);
    } finally {
      clearTimeout(deadline); c.req.raw.signal.removeEventListener("abort", abort); active = false;
    }
  });
}
