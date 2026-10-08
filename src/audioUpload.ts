import { AudioError, MAX_AUDIO_BYTES } from "./audio.js";

/** Read bytes under both a size limit and a cancellable deadline. A middleware
 * that buffers first cannot enforce our timeout against a stalled upload. */
export async function readAudioUpload(request: Request, signal: AbortSignal): Promise<Buffer> {
  if (signal.aborted) throw new AudioError("cancelled");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_AUDIO_BYTES)) throw new AudioError("audio_too_large");
  if (!request.body) throw new AudioError("invalid_audio");
  const reader = request.body.getReader();
  let chunks: Buffer[] = []; let size = 0;
  let stoppedCode: string | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => {
    const stop = (code: string) => {
      stoppedCode = code;
      // Do not await cancel: a hostile/failed underlying source may never
      // resolve its cancel promise, but our request must still terminate.
      void reader.cancel().catch(() => {});
      reject(new AudioError(code));
    };
    abort = () => stop("cancelled");
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => stop("audio_upload_timeout"), 8000);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), stopped]);
      if (stoppedCode) throw new AudioError(stoppedCode);
      if (signal.aborted) throw new AudioError("cancelled");
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_BYTES) throw new AudioError("audio_too_large");
      chunks.push(Buffer.from(value));
    }
    if (!size) throw new AudioError("invalid_audio");
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer!); signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
    try { reader.releaseLock(); } catch { /* cancelled pending read settles independently */ }
    chunks = [];
  }
}
