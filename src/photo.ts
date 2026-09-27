import { imageSize } from "image-size";
import type { PhotoInput } from "./interpreter.js";

/** The client sends ~1280 px; anything far outside this is not a phone photo of a sign. */
export const PHOTO_MIN_SIDE = 64;
export const PHOTO_MAX_SIDE = 4096;
export const PHOTO_MAX_PIXELS = 16_777_216;

const MAGIC: Record<PhotoInput["mimeType"], (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
};

const SIZE_TYPE: Record<PhotoInput["mimeType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type PhotoCheck = { ok: true; width: number; height: number } | { ok: false; reason: string };

/**
 * Checks the decoded bytes, not the label: the declared type must match the
 * file's own signature and header, and the header must describe an image of a
 * sane size. Nothing is kept — the bytes go to the reader and are dropped.
 */
export function inspectPhoto(photo: PhotoInput): PhotoCheck {
  const bytes = Buffer.from(photo.data, "base64");
  if (bytes.length < 12 || !MAGIC[photo.mimeType](bytes)) return { ok: false, reason: "content does not match type" };
  let size: ReturnType<typeof imageSize>;
  try {
    size = imageSize(bytes);
  } catch {
    return { ok: false, reason: "unreadable image header" };
  }
  if (size.type !== SIZE_TYPE[photo.mimeType]) return { ok: false, reason: "content does not match type" };
  const { width, height } = size;
  if (
    width < PHOTO_MIN_SIDE || height < PHOTO_MIN_SIDE ||
    width > PHOTO_MAX_SIDE || height > PHOTO_MAX_SIDE ||
    width * height > PHOTO_MAX_PIXELS
  ) {
    return { ok: false, reason: "image dimensions out of range" };
  }
  return { ok: true, width, height };
}
