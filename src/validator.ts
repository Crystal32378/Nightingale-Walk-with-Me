import type {
  Checkpoint,
  Observation,
  Route,
  VerdictResult,
} from "./types.js";

const normalize = (s: string): string => s.trim().toLowerCase();

/** Every landmark string registered anywhere in the route. Fail-closed boundary. */
export function routeVocabulary(route: Route): Set<string> {
  const vocab = new Set<string>();
  for (const cp of route.checkpoints) {
    for (const l of cp.expectedLandmarks) vocab.add(normalize(l));
    for (const l of cp.ambiguity?.sharedEvidence ?? []) vocab.add(normalize(l));
    for (const c of cp.conflictLandmarks ?? []) vocab.add(normalize(c.landmark));
    for (const l of cp.arrivalEvidence ?? []) vocab.add(normalize(l));
  }
  return vocab;
}

/**
 * Deterministic core: compares an observation against route truth at one checkpoint.
 * Pure function — no IO, no LLM, no clock.
 *
 * Precedence: CONFLICT > CONFIRMED > INSUFFICIENT > UNKNOWN.
 * Conflict wins because acting on a wrong confirmation is the worst failure mode.
 */
export function validate(
  route: Route,
  checkpoint: Checkpoint,
  observation: Observation,
): VerdictResult {
  const vocab = routeVocabulary(route);
  const observed = [...observation.landmarks, ...observation.signage].map(normalize);

  const unrecognized = observed.filter((o) => !vocab.has(o));
  const recognized = new Set(observed.filter((o) => vocab.has(o)));

  const matchedConflict =
    (checkpoint.conflictLandmarks ?? []).find((c) =>
      recognized.has(normalize(c.landmark)),
    ) ?? null;

  const matchedExpected = checkpoint.expectedLandmarks.filter((l) =>
    recognized.has(normalize(l)),
  );
  const matchedArrival = (checkpoint.arrivalEvidence ?? []).filter((l) =>
    recognized.has(normalize(l)),
  );
  const matchedShared = (checkpoint.ambiguity?.sharedEvidence ?? []).filter((l) =>
    recognized.has(normalize(l)),
  );

  const result = {
    matchedExpected,
    matchedArrival,
    matchedShared,
    matchedConflict,
    unrecognized,
  };

  if (matchedConflict) return { verdict: "CONFLICT", ...result };
  if (checkpoint.arrivalEvidence && matchedArrival.length > 0)
    return { verdict: "CONFIRMED", ...result };
  if (matchedExpected.length > 0) return { verdict: "CONFIRMED", ...result };
  if (matchedShared.length > 0) return { verdict: "INSUFFICIENT", ...result };
  return { verdict: "UNKNOWN", ...result };
}
