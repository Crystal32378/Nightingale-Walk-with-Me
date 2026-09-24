import { z } from "zod";

/**
 * Route truth. Authored and field-verified by a human; never written by an LLM.
 * Landmark strings are canonical vocabulary — Gemini maps free text/photos onto
 * this vocabulary, and anything outside it is ignored (fail-closed).
 */

export interface ConflictLandmark {
  /** Canonical landmark that means the user is off-route (e.g. "renai roundabout"). */
  landmark: string;
  /** Checkpoint to re-anchor at when this conflict is observed. */
  recoveryPointer: string;
  /** Canonical recovery fact, phrased later by the language layer. */
  recoveryInstruction: string;
}

export interface Ambiguity {
  /**
   * Evidence that is true at more than one place (e.g. "hospital building")
   * and therefore can never confirm this checkpoint on its own.
   */
  sharedEvidence: string[];
  /** The single discriminating question the engine asks. Engine-owned, not LLM-chosen. */
  question: string;
}

export interface Checkpoint {
  id: string;
  /** Canonical instruction fact for the segment starting at this checkpoint. */
  instruction: string;
  /** Evidence that confirms the user is at / has reached this checkpoint. */
  expectedLandmarks: string[];
  ambiguity?: Ambiguity;
  conflictLandmarks?: ConflictLandmark[];
  /** Terminal checkpoints only: evidence required to declare true arrival. */
  arrivalEvidence?: string[];
  next?: string;
}

export interface Route {
  routeId: string;
  origin: { type: string; name: string };
  destination: { type: string; name: string };
  /** First checkpoint id. */
  start: string;
  checkpoints: Checkpoint[];
}

/** Session state machine. */
export type SessionState =
  | "AT_CHECKPOINT"
  | "AMBIGUOUS"
  | "RECOVERING"
  | "ARRIVED";

export interface SessionSnapshot {
  routeId: string;
  state: SessionState;
  /** Checkpoint the engine currently expects the user to be heading to / at. */
  checkpointId: string;
  /** Consecutive clarifying questions asked at the current checkpoint. */
  questionCount: number;
}

/**
 * Observation — the ONLY thing the AI layer may hand the engine.
 * Treated as untrusted structured input; parse with `observationSchema`.
 */
export const observationSchema = z.object({
  landmarks: z.array(z.string().min(1).max(80)).max(10),
  signage: z.array(z.string().min(1).max(80)).max(10),
  confidence: z.enum(["low", "medium", "high"]),
  source: z.enum(["text", "photo"]),
});

export type Observation = z.infer<typeof observationSchema>;

export type Verdict = "CONFIRMED" | "INSUFFICIENT" | "CONFLICT" | "UNKNOWN";

export interface VerdictResult {
  verdict: Verdict;
  matchedExpected: string[];
  matchedArrival: string[];
  matchedShared: string[];
  matchedConflict: ConflictLandmark | null;
  /** Observed strings not registered anywhere in the route (never count as evidence). */
  unrecognized: string[];
}

/** What the engine decided; canonical facts only, phrased later by the language layer. */
export type EngineAction =
  | { type: "GUIDE"; checkpointId: string; instruction: string }
  | { type: "ASK"; checkpointId: string; question: string }
  | { type: "RECOVER"; checkpointId: string; instruction: string }
  | { type: "REANCHOR"; checkpointId: string; lookFor: string[] }
  | { type: "CONFIRM_ARRIVAL"; checkpointId: string };

export interface StepResult {
  session: SessionSnapshot;
  action: EngineAction;
  verdict: VerdictResult;
}
