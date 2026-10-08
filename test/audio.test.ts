import { describe, expect, it } from "vitest";
import { decodeAudio } from "../src/audio.js";

export function wav(seconds = 0.5): Buffer {
  const data = Buffer.alloc(44 + Math.floor(16000 * seconds) * 2);
  data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(16000, 24); data.writeUInt32LE(32000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(data.length - 44, 40);
  for (let i = 44; i < data.length; i += 2) data.writeInt16LE(Math.round(8000 * Math.sin(i / 17)), i);
  return data;
}

describe("audio byte validation and decoding", () => {
  it("decodes actual audio to a bounded metadata-free mono WAV", async () => {
    const out = await decodeAudio(wav(), "audio/wav", new AbortController().signal);
    expect(out.subarray(0, 4).toString()).toBe("RIFF");
    expect(out.readUInt32LE(24)).toBe(16000);
    expect(out.readUInt16LE(22)).toBe(1);
    expect(out.length).toBe(16044);
  });
  it.each(["audio/mp4", "audio/webm", "image/jpeg"])("rejects MIME mismatch %s", async mime => {
    await expect(decodeAudio(wav(), mime, new AbortController().signal)).rejects.toMatchObject({ code: "invalid_audio" });
  });
  it("rejects a plausible WAV header with no decodable payload", async () => {
    await expect(decodeAudio(wav().subarray(0, 44), "audio/wav", new AbortController().signal)).rejects.toMatchObject({ code: "invalid_audio" });
  });
  it("enforces duration from decoded bytes, not client metadata", async () => {
    await expect(decodeAudio(wav(17), "audio/wav", new AbortController().signal)).rejects.toMatchObject({ code: "audio_too_long" });
  });
  it("rejects oversized input and already-cancelled work", async () => {
    await expect(decodeAudio(Buffer.alloc(2 * 1024 * 1024 + 1), "audio/wav", new AbortController().signal)).rejects.toMatchObject({ code: "audio_too_large" });
    const controller = new AbortController(); controller.abort();
    await expect(decodeAudio(wav(), "audio/wav", controller.signal)).rejects.toMatchObject({ code: "cancelled" });
  });
});
