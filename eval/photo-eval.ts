/**
 * Field-photo evaluation of the photo reader against route truth.
 *
 * Live run (calls Vertex, same client and prompt as production):
 *   GOOGLE_CLOUD_PROJECT=nightingale-walk-with-me npx tsx eval/photo-eval.ts
 *     [--variants orig,small,crop,blur,dark] [--repeat 1] [--concurrency 4]
 *     [--route fixtures/route-renai-001.json] [--out eval/out]
 *
 * Re-score saved readings against another route file, no model calls:
 *   npx tsx eval/photo-eval.ts --replay eval/out/<run>.json --route <candidate.json>
 *
 * Photos are read from `field trip photos/` and never leave this machine
 * except as the model request itself. Outputs hold file names and readings only.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { buildPhotoPrompt, createVertexClient, parseObservation } from "../src/gemini.js";
import { EMPTY_PHOTO_OBSERVATION } from "../src/interpreter.js";
import type { Route } from "../src/types.js";
import { routeTerms } from "../src/validator.js";
import { judge, termStats, type Cell, type PhotoLabel, type Reading } from "./score.js";

const PROD_PHOTO_TIMEOUT_MS = 15000;

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");

const root = resolve(import.meta.dirname, "..");
const labelsDoc = JSON.parse(readFileSync(join(root, "eval/photo-labels.json"), "utf8")) as {
  photoDir: string;
  photos: PhotoLabel[];
};
const labels = new Map(labelsDoc.photos.map((p) => [p.file, p]));
const routePath = resolve(root, args.get("route") ?? "fixtures/route-renai-001.json");
const route = JSON.parse(readFileSync(routePath, "utf8")) as Route;
const outDir = resolve(root, args.get("out") ?? "eval/out");

/** What the phone would send (client downsizes to 1280 px JPEG), then harder conditions. */
const VARIANTS: Record<string, (img: sharp.Sharp) => sharp.Sharp> = {
  orig: (i) => i.resize(1280, 1280, { fit: "inside" }).jpeg({ quality: 80 }),
  small: (i) => i.resize(640, 640, { fit: "inside" }).jpeg({ quality: 70 }),
  crop: (i) => i, // handled in render(): centre 60 % of the frame
  blur: (i) => i.resize(1280, 1280, { fit: "inside" }).blur(4).jpeg({ quality: 80 }),
  dark: (i) =>
    i.resize(1280, 1280, { fit: "inside" }).modulate({ brightness: 0.3, saturation: 0.6 }).blur(0.8).jpeg({ quality: 70 }),
};

async function render(file: string, variant: string): Promise<string> {
  const path = join(root, labelsDoc.photoDir, file);
  let img = sharp(path).rotate();
  if (variant === "crop") {
    const { width = 0, height = 0 } = await sharp(path).rotate().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    const w = Math.round(width * 0.6);
    const h = Math.round(height * 0.6);
    img = sharp(path)
      .rotate()
      .extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h })
      .resize(1280, 1280, { fit: "inside" })
      .jpeg({ quality: 80 });
  } else {
    img = VARIANTS[variant]!(img);
  }
  return (await img.toBuffer()).toString("base64");
}

async function readAll(): Promise<Reading[]> {
  const variants = (args.get("variants") ?? "orig,small,crop,blur,dark").split(",");
  const repeat = Number(args.get("repeat") ?? 1);
  const concurrency = Number(args.get("concurrency") ?? 4);
  const client = createVertexClient();
  const prompt = buildPhotoPrompt(route);
  const jobs = labelsDoc.photos.flatMap((p) =>
    variants.flatMap((v) => Array.from({ length: repeat }, (_, r) => ({ file: p.file, variant: v, repeat: r }))),
  );
  const readings: Reading[] = [];
  let done = 0;
  const worker = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const data = await render(job.file, job.variant);
      let reading: Reading | undefined;
      let lastError = "";
      for (let attempt = 0; attempt < 3 && !reading; attempt++) {
        const t0 = Date.now();
        try {
          const raw = await client.generateWithImage!(prompt, { mimeType: "image/jpeg", data });
          const latencyMs = Date.now() - t0;
          const parsed = parseObservation(raw, "photo");
          const timedOut = latencyMs > PROD_PHOTO_TIMEOUT_MS;
          reading = {
            ...job,
            latencyMs,
            observation: timedOut || !parsed ? EMPTY_PHOTO_OBSERVATION : parsed,
            ...(timedOut ? { timedOut } : {}),
            ...(parsed ? {} : { schemaInvalid: true }),
          };
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      readings.push(reading ?? { ...job, latencyMs: 0, observation: EMPTY_PHOTO_OBSERVATION, error: lastError.slice(0, 200) });
      done++;
      if (done % 20 === 0) console.error(`… ${done} readings`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return readings;
}

function score(readings: Reading[]) {
  const byVariant = new Map<string, Reading[]>();
  for (const r of readings) byVariant.set(r.variant, [...(byVariant.get(r.variant) ?? []), r]);
  const rows: Record<string, unknown>[] = [];
  const failures: { file: string; variant: string; repeat: number; zone: string; cell: Cell; read: string[] }[] = [];
  for (const [variant, rs] of byVariant) {
    const ok = rs.filter((r) => !r.error);
    const cells = ok.flatMap((r) =>
      route.checkpoints.map((cp) => ({ r, cell: judge(route, labels.get(r.file)!, cp.id, r.observation) })),
    );
    const count = (pred: (c: Cell) => boolean) => cells.filter(({ cell }) => pred(cell)).length;
    const home = cells.filter(({ r, cell }) => {
      const l = labels.get(r.file)!;
      const z = l.zone === "inside" ? "cp5" : l.zone === "past" ? "cp5" : l.zone;
      return z === cell.checkpointId && l.expect.length > 0;
    });
    const terms = termStats(route, labels, ok);
    for (const { r, cell } of cells) {
      if (["false_confirm", "false_arrival", "false_conflict"].includes(cell.outcome) || (cell.outcome === "miss" && cell.reachable)) {
        failures.push({
          file: r.file, variant, repeat: r.repeat, zone: labels.get(r.file)!.zone, cell,
          read: [...r.observation.signage, ...r.observation.landmarks],
        });
      }
    }
    rows.push({
      variant,
      readings: rs.length,
      errors: rs.length - ok.length,
      timeouts: ok.filter((r) => r.timedOut).length,
      schemaInvalid: ok.filter((r) => r.schemaInvalid).length,
      medianLatencyMs: median(ok.map((r) => r.latencyMs)),
      reachableFalseConfirm: count((c) => c.reachable && c.outcome === "false_confirm"),
      reachableFalseArrival: count((c) => c.reachable && c.outcome === "false_arrival"),
      reachableFalseConflict: count((c) => c.reachable && c.outcome === "false_conflict"),
      strictFalseConfirmOrArrival: count((c) => c.outcome === "false_confirm" || c.outcome === "false_arrival"),
      homeHits: `${home.filter(({ cell }) => cell.outcome === "correct").length}/${home.length}`,
      termRecall: `${terms.read}/${terms.expected}`,
      unsupportedTerms: terms.unsupported.length,
      outOfVocab: terms.outOfVocab,
    });
  }
  return { rows, failures, unsupported: termStats(route, labels, readings.filter((r) => !r.error)).unsupported };
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

let readings: Reading[];
let runId: string;
if (args.has("replay")) {
  const saved = JSON.parse(readFileSync(resolve(root, args.get("replay")!), "utf8"));
  const savedTerms = JSON.stringify(saved.vocabulary);
  if (savedTerms !== JSON.stringify(routeTerms(route))) {
    console.error("warning: this route's vocabulary differs from the one the photos were read with; re-run live to be exact");
  }
  readings = saved.readings;
  runId = `${saved.runId}-replay-${route.routeId}`;
} else {
  runId = new Date().toISOString().replace(/[:.]/g, "-");
  readings = await readAll();
}

const result = score(readings);
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, `${runId}.json`),
  JSON.stringify({ runId, route: routePath.replace(root + "/", ""), vocabulary: routeTerms(route), readings, ...result }, null, 2),
);
console.table(result.rows);
console.log(`\nfailures (${result.failures.length}):`);
for (const f of result.failures) {
  console.log(`  ${f.cell.outcome.padEnd(14)} ${f.file} [${f.variant}#${f.repeat}] zone=${f.zone} at=${f.cell.checkpointId} → ${f.cell.action} read=${JSON.stringify(f.read)}`);
}
console.log(`\nsaved ${join(outDir, `${runId}.json`)}`);
