import { z } from "zod";

/**
 * Route truth. Authored and field-verified by a human; never written by an LLM.
 * Landmark strings are canonical vocabulary — Gemini maps free text/photos onto
 * this vocabulary, and anything outside it is ignored (fail-closed).
 */

export interface ConflictLandmark {
  /** Stable presentation identity, authored with the route; never inferred from prose. */
  messageKey?: string;
  /** Canonical landmark that means the user is off-route (e.g. "renai roundabout"). */
  landmark: string;
  /** Checkpoint to re-anchor at when this conflict is observed. */
  recoveryPointer: string;
  /** Canonical recovery fact, phrased later by the language layer. */
  recoveryInstruction: string;
  /**
   * Zones where this landmark can really mean "you are here". A reliable fix
   * in another zone vetoes the conflict (a floor directory inside the lobby
   * printing 急診 is not the ER driveway). Vetoing never confirms anything.
   */
  zones?: string[];
}

export interface Ambiguity {
  messageKey?: string;
  /**
   * Evidence that is true at more than one place (e.g. "hospital building")
   * and therefore can never confirm this checkpoint on its own.
   */
  sharedEvidence: string[];
  /** The single discriminating question the engine asks. Engine-owned, not LLM-chosen. */
  question: string;
}

/**
 * A coarse circle around one stretch of the route. The phone turns its own
 * position into a zone id before anything is sent; raw coordinates never leave
 * the device. Zones only veto — they never confirm a checkpoint on their own.
 */
export interface Zone {
  id: string;
  lat: number;
  lon: number;
  radiusM: number;
}

/** Per-checkpoint use of zones. A known zone outside both lists vetoes a confirmation. */
export interface CheckpointZones {
  /** Being in one of these is consistent with having reached this checkpoint. */
  allow: string[];
  /** Close but not certain: arrival asks the entrance question first. Terminal checkpoints only. */
  ask?: string[];
}

/** Measured once on site; varies by time of day, so never spoken or shown as a promise. */
export interface FieldObservation {
  note: string;
  observedOn: string;
  stable: false;
}

export interface Checkpoint {
  id: string;
  /**
   * `walker`: confirmed only by the walker saying they are done (reaching
   * exit 2 at ground level, finishing a crossing), never by what a photo or
   * sentence happens to contain. Default: evidence.
   */
  confirmBy?: "evidence" | "walker";
  zones?: CheckpointZones;
  observations?: FieldObservation[];
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
  zones?: Zone[];
}

/** What the phone reports about where it is: a zone id from the route, or unknown. */
export interface LocationFix {
  zone: string;
}

export const UNKNOWN_ZONE = "unknown";

export interface TextConfirmation {
  id: string;
  kind: "renai-before-second-crossing";
}

/** Server-created only; records evidence without retaining the walker's raw text. */
export interface PendingTextContinuation extends TextConfirmation {
  evidence: string[];
  expiresAt: number;
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
  source: z.enum(["text", "photo", "walker"]),
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
  /** Set when the evidence matched but the phone's zone says this checkpoint is not reached yet. */
  locationVeto?: string;
  /** An unlocated photo cannot start a crossing or a zone-specific recovery. */
  photoHold?: "crossing-needs-location" | "recovery-needs-location";
}

/** What the engine decided; canonical facts only, phrased later by the language layer. */
export type EngineAction = (
  | { type: "GUIDE"; checkpointId: string; instruction: string }
  | { type: "ASK"; checkpointId: string; question: string; confirmation?: TextConfirmation }
  | { type: "RECOVER"; checkpointId: string; instruction: string }
  | { type: "REANCHOR"; checkpointId: string; lookFor: string[] }
  | { type: "CONFIRM_ARRIVAL"; checkpointId: string }
) & { messageKey?: string };

export interface StepResult {
  session: SessionSnapshot;
  action: EngineAction;
  verdict: VerdictResult;
}
