/** Seven saved failing image/variant pairs, using the current production prompt/client.
 * No source photos or encoded image payloads are written to the result.
 * npx tsx eval/narrow-photo-probe.ts --live
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { buildPhotoPrompt, createVertexClient, parseObservation, DEFAULT_MODEL } from "../src/gemini.js";
import { EMPTY_PHOTO_OBSERVATION } from "../src/interpreter.js";
import { routeTerms } from "../src/validator.js";
import type { Route } from "../src/types.js";
import type { Reading } from "./score.js";

const root = resolve(import.meta.dirname, "..");
const source = "eval/reviews/trip2-2026-10-07/after-projected.json";
const before = JSON.parse(readFileSync(join(root, source), "utf8"));
const jobs = [...new Map<string, { file: string; variant: string }>(before.failures
  .filter((f: { cell: { reachable: boolean; outcome: string } }) => f.cell.reachable && ["false_confirm", "false_conflict"].includes(f.cell.outcome))
  .map((f: { file: string; variant: string }) => [f.file + ":" + f.variant, { file: f.file, variant: f.variant }])).values()];
if (jobs.length !== 7) throw new Error("Unexpected probe scope; expected seven saved failing pairs");
const offsetIndex = process.argv.indexOf("--start-at");
const offset = offsetIndex >= 0 ? Number(process.argv[offsetIndex + 1]) : 0;
if (!Number.isInteger(offset) || offset < 0 || offset >= jobs.length) throw new Error("Invalid start-at index");
const selectedJobs = jobs.slice(offset);
const routePath = join(root, "fixtures/route-renai-001.json");
const route = JSON.parse(readFileSync(routePath, "utf8")) as Route;
const prompt = buildPhotoPrompt(route);
const hash = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");
console.log(JSON.stringify({ jobs: selectedJobs, count: selectedJobs.length, startAt: offset, live: process.argv.includes("--live") }));
if (!process.argv.includes("--live")) process.exit(0);
const project = process.env.GOOGLE_CLOUD_PROJECT;
if (!project) throw new Error("Set GOOGLE_CLOUD_PROJECT for the explicitly requested live probe");
const client = createVertexClient();
const runId = new Date().toISOString().replace(/[:.]/g, "-") + "-narrow-photo";
const out = join(root, "eval/out/narrow-fix-2026-10-08");
mkdirSync(out, { recursive: true });
const readings: (Reading & { inputSha256: string; checkedAt: string })[] = [];
for (const job of selectedJobs) {
  const path = join(root, "field trip photos", job.file);
  let image = sharp(path).rotate();
  if (job.variant === "crop") {
    const { width, height } = (await image.toBuffer({ resolveWithObject: true })).info;
    const w = Math.round(width * 0.6), h = Math.round(height * 0.6);
    image = sharp(path).rotate().extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h });
  }
  const size = job.variant === "small" ? 640 : 1280;
  const input = await image.resize(size, size, { fit: "inside" }).jpeg({ quality: job.variant === "small" ? 70 : 80 }).toBuffer();
  const started = Date.now();
  let reading: Reading;
  try {
    const raw = await client.generateWithImage!(prompt, { mimeType: "image/jpeg", data: input.toString("base64") });
    const latencyMs = Date.now() - started;
    const parsed = parseObservation(raw, "photo");
    reading = { ...job, repeat: 0, latencyMs, observation: latencyMs > 20_000 || !parsed ? EMPTY_PHOTO_OBSERVATION : parsed,
      ...(latencyMs > 20_000 ? { timedOut: true } : {}), ...(!parsed ? { schemaInvalid: true } : {}) };
  } catch (error) {
    // Bound the error text and retain a failed call as a failed call; no retries.
    reading = { ...job, repeat: 0, latencyMs: Date.now() - started, observation: EMPTY_PHOTO_OBSERVATION,
      error: error instanceof Error ? error.message.slice(0, 300) : "Unknown request error" };
  }
  readings.push({ ...reading, inputSha256: hash(input), checkedAt: new Date().toISOString() });
  writeFileSync(join(out, runId + ".json"), JSON.stringify({ runId, evaluationMode: "live-narrow-probe", project,
    location: process.env.VERTEX_LOCATION ?? "global", model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    promptSha256: hash(prompt), routeSha256: hash(readFileSync(routePath)), sourceFailures: source,
    vocabulary: routeTerms(route), readings, plannedRequests: selectedJobs.length, completedRequests: readings.length, startAt: offset,
    scope: "Subset of seven previously failing pairs; one interpreter call per selected pair in this run. All partial/failed runs retained. Not a full model or phone-field acceptance." }, null, 2));
  console.log(JSON.stringify({ file: job.file, variant: job.variant, latencyMs: reading.latencyMs,
    error: reading.error ?? null, timedOut: reading.timedOut ?? false, observation: reading.observation }));
  if (reading.error) break;
}
console.log("Saved " + join(out, runId + ".json"));
