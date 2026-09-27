import { step } from "../src/engine.js";
import type { EngineAction, Observation, Route, VerdictResult } from "../src/types.js";
import { routeVocabulary } from "../src/validator.js";

/**
 * Where a photo was taken. `inside` is past the lobby doors (arrival is right),
 * `past` is walked-too-far, `noise` is anywhere or nowhere in particular.
 */
export type Zone = "station" | "cp1" | "cp2" | "cp3" | "cp4" | "cp5" | "inside" | "past" | "noise";

export interface PhotoLabel {
  file: string;
  zone: Zone;
  expect: string[];
  optional?: string[];
  note?: string;
  review?: boolean;
}

export type Outcome =
  | "correct"
  | "miss"
  | "ok"
  | "advance"
  | "false_confirm"
  | "false_arrival"
  | "false_conflict";

export interface Cell {
  checkpointId: string;
  action: EngineAction["type"];
  verdict: VerdictResult["verdict"];
  outcome: Outcome;
  /** Could this (photo place, engine checkpoint) pair happen on a real walk? */
  reachable: boolean;
}

const ORDER: Record<Zone, number> = {
  station: 0, cp1: 1, cp2: 2, cp3: 3, cp4: 4, cp5: 5, inside: 5, past: 6, noise: -1,
};

const cpIndex = (id: string): number => Number(id.replace(/^cp/, ""));
const norm = (s: string) => s.trim().toLowerCase();

/**
 * Judges one engine step, taken at checkpoint `checkpointId`, on an observation
 * of a photo taken in `label.zone`.
 *
 * Reachable pairs are the ones a real walk produces: the person is at the
 * checkpoint the engine expects, or still standing at the previous one (the
 * moment right after a confirmation), or walked past the lobby, or the photo
 * says nothing about place at all. A confirmation there while the person has
 * not reached the checkpoint is the failure that must never happen.
 */
export function judge(
  route: Route,
  label: PhotoLabel,
  checkpointId: string,
  observation: Observation,
): Cell {
  const result = step(
    route,
    { routeId: route.routeId, state: "AT_CHECKPOINT", checkpointId, questionCount: 0 },
    observation,
  );
  const action = result.action.type;
  const verdict = result.verdict.verdict;
  const c = cpIndex(checkpointId);
  const z = ORDER[label.zone];
  const shown = new Set([...label.expect, ...(label.optional ?? [])].map(norm));
  const lastId = route.checkpoints[route.checkpoints.length - 1]!.id;
  const isLast = checkpointId === lastId;

  const reachable =
    label.zone === "noise" || z === c || z === c - 1 || (label.zone === "past" && isLast);

  const conflictIsReal = () =>
    result.verdict.matchedConflict !== null &&
    shown.has(norm(result.verdict.matchedConflict.landmark));

  let outcome: Outcome;
  if (action === "RECOVER") {
    outcome = conflictIsReal() ? (label.zone === "past" || z < c ? "correct" : "false_conflict") : "false_conflict";
  } else if (label.zone === "noise") {
    outcome = action === "GUIDE" ? "false_confirm" : action === "CONFIRM_ARRIVAL" ? "false_arrival" : "ok";
  } else if (label.zone === "past") {
    if (isLast) outcome = action === "CONFIRM_ARRIVAL" ? "false_arrival" : action === "GUIDE" ? "false_confirm" : "miss";
    else outcome = action === "GUIDE" ? "advance" : "ok";
  } else if (z === c) {
    if (action === "CONFIRM_ARRIVAL") outcome = "correct";
    else if (action === "GUIDE") outcome = isLast ? "miss" : "correct";
    else outcome = label.expect.length > 0 ? "miss" : "ok";
  } else if (z < c) {
    outcome = action === "GUIDE" ? "false_confirm" : action === "CONFIRM_ARRIVAL" ? "false_arrival" : "ok";
  } else {
    outcome = action === "GUIDE" ? "advance" : "ok";
  }
  return { checkpointId, action, verdict, outcome, reachable };
}

export interface Reading {
  file: string;
  variant: string;
  repeat: number;
  observation: Observation;
  latencyMs: number;
  /** Set when the call failed after retries; the row is left out of the scores. */
  error?: string;
  /** Production gives up after this long and uses an empty observation. */
  timedOut?: boolean;
  /** Raw output did not pass the schema; production treats it as no evidence. */
  schemaInvalid?: boolean;
}

export interface TermStats {
  expected: number;
  read: number;
  /**
   * In-vocabulary terms reported that the label does not say are in the photo.
   * Shared evidence (醫院, 玻璃門…) is left out: it can never confirm on its own.
   */
  unsupported: { file: string; variant: string; term: string }[];
  /** Strings outside the route vocabulary (the validator discards them). */
  outOfVocab: number;
}

export function termStats(route: Route, labels: Map<string, PhotoLabel>, readings: Reading[]): TermStats {
  const vocab = routeVocabulary(route);
  const shared = new Set(route.checkpoints.flatMap((cp) => cp.ambiguity?.sharedEvidence ?? []).map(norm));
  const stats: TermStats = { expected: 0, read: 0, unsupported: [], outOfVocab: 0 };
  for (const r of readings) {
    if (r.error) continue;
    const label = labels.get(r.file)!;
    const seen = [...r.observation.landmarks, ...r.observation.signage].map(norm);
    const seenSet = new Set(seen);
    const shown = new Set([...label.expect, ...(label.optional ?? [])].map(norm));
    for (const t of label.expect) {
      stats.expected++;
      if (seenSet.has(norm(t))) stats.read++;
    }
    for (const t of seenSet) {
      if (!vocab.has(t)) stats.outOfVocab++;
      else if (!shown.has(t) && !shared.has(t)) stats.unsupported.push({ file: r.file, variant: r.variant, term: t });
    }
  }
  return stats;
}
