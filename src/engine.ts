import type {
  Checkpoint,
  Observation,
  Route,
  SessionSnapshot,
  StepResult,
} from "./types.js";
import { validate } from "./validator.js";

/**
 * One clarifying question per stuck checkpoint, then fall back to re-anchoring
 * on the canonical instruction. The question budget is engine law, not LLM mood.
 */
const MAX_QUESTIONS = 1;

export class RouteError extends Error {}

export function startSession(route: Route): SessionSnapshot {
  if (!findCheckpoint(route, route.start)) {
    throw new RouteError(`route ${route.routeId} has no start checkpoint ${route.start}`);
  }
  return {
    routeId: route.routeId,
    state: "AT_CHECKPOINT",
    checkpointId: route.start,
    questionCount: 0,
  };
}

function findCheckpoint(route: Route, id: string): Checkpoint | undefined {
  return route.checkpoints.find((cp) => cp.id === id);
}

/**
 * Session semantics: `checkpointId` is the checkpoint the engine expects the
 * user to confirm next. A checkpoint's `instruction` is the canonical fact for
 * the segment that starts once that checkpoint is confirmed.
 *
 * Deterministic: (route, session, observation) → (session', action).
 * The observation must already have passed `observationSchema`.
 */
export function step(
  route: Route,
  session: SessionSnapshot,
  observation: Observation,
): StepResult {
  if (session.routeId !== route.routeId) {
    throw new RouteError(`session route ${session.routeId} does not match ${route.routeId}`);
  }
  if (session.state === "ARRIVED") {
    throw new RouteError("session already arrived");
  }
  const cp = findCheckpoint(route, session.checkpointId);
  if (!cp) {
    throw new RouteError(`unknown checkpoint ${session.checkpointId}`);
  }

  const verdict = validate(route, cp, observation);

  switch (verdict.verdict) {
    case "CONFLICT": {
      const conflict = verdict.matchedConflict!;
      const target = findCheckpoint(route, conflict.recoveryPointer);
      if (!target) {
        throw new RouteError(`recovery pointer ${conflict.recoveryPointer} not in route`);
      }
      return {
        verdict,
        session: {
          ...session,
          state: "RECOVERING",
          checkpointId: conflict.recoveryPointer,
          questionCount: 0,
        },
        action: {
          type: "RECOVER",
          checkpointId: conflict.recoveryPointer,
          instruction: conflict.recoveryInstruction,
        },
      };
    }

    case "CONFIRMED": {
      // True arrival requires arrival evidence, never GPS, never proximity.
      if (cp.arrivalEvidence && verdict.matchedArrival.length > 0) {
        return {
          verdict,
          session: { ...session, state: "ARRIVED", questionCount: 0 },
          action: { type: "CONFIRM_ARRIVAL", checkpointId: cp.id },
        };
      }
      // Confirmed this checkpoint (recovery included): guide the next segment.
      const nextId = cp.next ?? cp.id;
      return {
        verdict,
        session: {
          ...session,
          state: "AT_CHECKPOINT",
          checkpointId: nextId,
          questionCount: 0,
        },
        action: { type: "GUIDE", checkpointId: cp.id, instruction: cp.instruction },
      };
    }

    case "INSUFFICIENT": {
      if (cp.ambiguity && session.questionCount < MAX_QUESTIONS) {
        return {
          verdict,
          session: {
            ...session,
            state: "AMBIGUOUS",
            questionCount: session.questionCount + 1,
          },
          action: { type: "ASK", checkpointId: cp.id, question: cp.ambiguity.question },
        };
      }
      return reanchor(session, cp, verdict);
    }

    case "UNKNOWN":
      return reanchor(session, cp, verdict);
  }
}

/**
 * No invented directions when lost: restate what evidence to look for at the
 * expected checkpoint, phrased later by the language layer.
 */
function reanchor(
  session: SessionSnapshot,
  cp: Checkpoint,
  verdict: StepResult["verdict"],
): StepResult {
  const lookFor = [...cp.expectedLandmarks, ...(cp.arrivalEvidence ?? [])];
  return {
    verdict,
    session: { ...session, state: session.state === "RECOVERING" ? "RECOVERING" : "AT_CHECKPOINT" },
    action: { type: "REANCHOR", checkpointId: cp.id, lookFor },
  };
}
