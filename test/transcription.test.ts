import { describe, expect, it, vi } from "vitest";
import { transcribeWith, parseTranscript } from "../src/transcription.js";

describe("transcription treats model output as unconfirmed text", () => {
  it("returns only bounded validated text", () => {
    expect(parseTranscript('{"text":" 我看見便利商店。 "}')).toBe("我看見便利商店。");
  });
  it.each(['{"text":""}', '{"text":"   "}', '{}', '{"text":42}', 'go forward', '{"text":"ok","action":"ARRIVED"}', JSON.stringify({ text: "x".repeat(501) }), '{"text":"bad\\u0000text"}'])
  ("rejects empty, malformed or instruction-bearing schema: %s", raw => {
    expect(() => parseTranscript(raw)).toThrow();
  });
  it("has a real deadline even if a provider never settles", async () => {
    vi.useFakeTimers();
    try {
      const result = transcribeWith(() => new Promise(() => {}), new AbortController().signal, 20);
      const assertion = expect(result).rejects.toMatchObject({ code: "transcription_timeout" });
      await vi.advanceTimersByTimeAsync(21); await assertion;
    } finally { vi.useRealTimers(); }
  });
  it("maps provider 429 without leaking its text or retrying", async () => {
    await expect(transcribeWith(async () => { throw Object.assign(new Error("private content"), { status: 429 }); }, new AbortController().signal))
      .rejects.toMatchObject({ code: "transcription_limited", message: "transcription_limited" });
  });
  it("aborts pending model work when cancelled", async () => {
    const controller = new AbortController(); let providerSignal: AbortSignal | undefined;
    const result = transcribeWith(signal => { providerSignal = signal; return new Promise(() => {}); }, controller.signal);
    const assertion = expect(result).rejects.toMatchObject({ code: "cancelled" });
    controller.abort(); await assertion;
    expect(providerSignal?.aborted).toBe(true);
  });
});
