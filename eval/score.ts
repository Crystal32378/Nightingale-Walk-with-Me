import { step } from "../src/engine.js";
import { UNKNOWN_ZONE, type EngineAction, type LocationFix, type Observation, type Route, type VerdictResult } from "../src/types.js";
import { routeVocabulary } from "../src/validator.js";

/**
 * Where a photo was taken, as a named place along the route. `noise` is
 * anywhere or nowhere in particular; `past` is walked beyond the lobby.
 */
export interface PhotoLabel {
  file: string;
  place: string;
  expect: string[];
  optional?: string[];
  note?: string;
  review?: boolean;
  trip?: number;
}

/** pos: where the place sits between checkpoints (cp at index i has pos i+1). zone: what a phone there reports. */
export type Places = Record<string, { pos: number; zone: string }>;

export type Outcome = "correct" | "miss" | "ok" | "advance" | "false_confirm" | "false_arrival" | "false_conflict";

export interface Cell {
  checkpointId: string;
  action: EngineAction["type"];
  verdict: VerdictResult["verdict"];
  outcome: Outcome;
  /** Could this (place, engine checkpoint) pair happen on a real walk? */
  reachable: boolean;
  vetoed: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

/** `none`: the phone reports nothing. `place`: it reports the zone of the place the photo was taken. */
export type LocationMode = "none" | "place";

/**
 * Judges one engine step, taken while the engine expects `checkpointId`, on an
 * observation of a photo taken at `label.place`.
 *
 * Reachable pairs are the ones a real walk produces: the person is somewhere
 * between the previous checkpoint and this one, or walked past the lobby, or
 * the photo says nothing about place at all. Confirming a checkpoint the person
 * has not reached is the failure that must never happen.
 */
export function judge(
  route: Route,
  places: Places,
  label: PhotoLabel,
  checkpointId: string,
  observation: Observation,
  mode: LocationMode = "none",
): Cell {
  const idx = route.checkpoints.findIndex((cp) => cp.id === checkpointId);
  const c = idx + 1;
  const isLast = idx === route.checkpoints.length - 1;
  const noise = label.place === "noise";
  const place = noise ? undefined : places[label.place];
  if (!noise && !place) throw new Error(`unknown place ${label.place} for ${label.file}`);
  const location: LocationFix | undefined =
    mode === "place" ? { zone: place?.zone ?? UNKNOWN_ZONE } : undefined;

  const result = step(
    route,
    { routeId: route.routeId, state: "AT_CHECKPOINT", checkpointId, questionCount: 0 },
    observation,
    location,
  );
  const action = result.action.type;
  const verdict = result.verdict.verdict;
  const shown = new Set([...label.expect, ...(label.optional ?? [])].map(norm));
  const past = label.place === "past";
  const z = place?.pos ?? -1;

  const reachable = noise || (past ? isLast : c - 1 <= z && z <= c);

  let outcome: Outcome;
  if (action === "RECOVER") {
    const real = result.verdict.matchedConflict !== null && shown.has(norm(result.verdict.matchedConflict.landmark));
    outcome = real && (past || z < c) ? "correct" : "false_conflict";
  } else if (noise) {
    outcome = action === "GUIDE" ? "false_confirm" : action === "CONFIRM_ARRIVAL" ? "false_arrival" : "ok";
  } else if (past) {
    if (isLast) outcome = action === "CONFIRM_ARRIVAL" ? "false_arrival" : action === "GUIDE" ? "false_confirm" : "miss";
    else outcome = action === "GUIDE" ? "advance" : "ok";
  } else if (z >= c) {
    const home = z === c;
    if (action === "CONFIRM_ARRIVAL" || action === "GUIDE") outcome = home ? "correct" : "advance";
    else outcome = home && label.expect.length > 0 ? "miss" : "ok";
  } else {
    outcome = action === "GUIDE" ? "false_confirm" : action === "CONFIRM_ARRIVAL" ? "false_arrival" : "ok";
  }
  return { checkpointId, action, verdict, outcome, reachable, vetoed: result.verdict.locationVeto !== undefined };
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
