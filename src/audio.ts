import { spawn } from "node:child_process";

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const AUDIO_MIME_TYPES = ["audio/mp4", "audio/webm", "audio/wav"];

export class AudioError extends Error {
  constructor(readonly code: string) { super(code); }
}

/** Container is checked before invoking the decoder; declared MIME alone is insufficient. */
function demuxer(bytes: Buffer, mime: string): string {
  if (mime === "audio/wav" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE") return "wav";
  if (mime === "audio/mp4" && bytes.toString("ascii", 4, 8) === "ftyp") return "mov";
  if (mime === "audio/webm" && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "matroska";
  throw new AudioError("invalid_audio");
}

function pcmWav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF"); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** No files, shell, network protocols, metadata, or decoder stderr are retained. */
export async function decodeAudio(bytes: Buffer, mime: string, signal: AbortSignal): Promise<Buffer> {
  if (signal.aborted) throw new AudioError("cancelled");
  if (bytes.length > MAX_AUDIO_BYTES) throw new AudioError("audio_too_large");
  if (bytes.length < 16) throw new AudioError("invalid_audio");
  const format = demuxer(bytes, mime);
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-xerror",
      "-protocol_whitelist", "pipe", "-threads", "1", "-f", format, "-i", "pipe:0",
      "-map", "0:a:0", "-vn", "-sn", "-dn", "-t", "16.1", "-ac", "1", "-ar", "16000",
      "-threads", "1", "-f", "s16le", "pipe:1",
    ], { stdio: ["pipe", "pipe", "ignore"] });
    let chunks: Buffer[] = []; let size = 0; let settled = false;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); chunks = []; };
    const fail = (code: string) => {
      if (settled) return;
      settled = true; child.kill("SIGKILL"); cleanup(); reject(new AudioError(code));
    };
    const abort = () => fail("cancelled");
    const timer = setTimeout(() => fail("audio_decode_timeout"), 5000);
    signal.addEventListener("abort", abort, { once: true });
    child.on("error", () => fail("audio_unavailable"));
    child.stdin.on("error", () => { /* close/error determines the safe response */ });
    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > 16000 * 2 * 16) return fail("audio_too_long");
      chunks.push(chunk);
    });
    child.on("close", code => {
      if (settled) return;
      if (code !== 0 || size < 16000 * 2 * 0.2) return fail("invalid_audio");
      const result = pcmWav(Buffer.concat(chunks));
      settled = true; cleanup(); resolve(result);
    });
    if (signal.aborted) abort(); else child.stdin.end(bytes);
  });
}
