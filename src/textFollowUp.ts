import { RouteError, step } from "./engine.js";
import { isPendingTextContinuation, type SessionRecord } from "./store.js";
import type { LocationFix, Observation, PendingTextContinuation, Route, StepResult } from "./types.js";
import { englishObservation, isEnglishBike, isEnglishCaution } from "./englishInput.js";

const EMPTY_TEXT: Observation = { landmarks: [], signage: [], confidence: "low", source: "text" };
const compact = (text: string) => text.trim().replace(/[\s，。！？,.!?]/g, "").toLowerCase();
const INTERSECTION = /^(?:(?:我(?:現在)?在|我到了|到了|現在在))?(?:仁愛(?:路)?(?:與|和|跟|×)?復興(?:南路)?|復興(?:南路)?(?:與|和|跟|×)?仁愛(?:路)?)(?:路口|交叉口)$/;
const BIKE = /^(?:(?:我(?:現在)?(?:在|看到)|看到|這裡是))?(?:youbike|ubike|微笑單車)(?:站)?$/;
const NOT_BEFORE_RENAI = /已(?:經)?(?:走)?過(?:了)?仁愛路|過完仁愛路|不在|不確定|不是|沒看到|沒有看到|還沒到/;

/** One field-reported intersection alias, mapped to existing route vocabulary, text only. */
export function withTextAlias(route: Route, text: string, observation: Observation): Observation {
  if (route.routeId !== "renai-001") return observation;
  const english = englishObservation(text, route);
  if (english) return english;
  // Generic bike stations are not location evidence, even if the interpreter guessed a street.
  if (BIKE.test(compact(text))) return { ...EMPTY_TEXT };
  if (!INTERSECTION.test(compact(text))) return observation;
  if (!route.checkpoints.find(cp => cp.id === "cp3")?.expectedLandmarks.includes("仁愛路")) return observation;
  return { landmarks: ["仁愛路"], signage: [], confidence: "high", source: "text" };
}

/** Invoked only by the actual free-text API branch, never by image or structured input. */
export function textFollowUp(route: Route, record: SessionRecord, result: StepResult, observation: Observation,
  text: string, now: number, id: string): { result: StepResult; pending?: PendingTextContinuation } {
  if (route.routeId !== "renai-001" || record.session.checkpointId !== "cp2"
    || result.action.type !== "REANCHOR" || result.verdict.verdict !== "UNKNOWN") return { result };
  const cp = route.checkpoints.find(c => c.id === "cp2")!;
  if (BIKE.test(compact(text)) || isEnglishBike(text)) {
    return { result: { ...result, action: { type: "ASK", checkpointId: cp.id, messageKey: "ask.youbike",
      question: `YouBike 旁邊的路牌寫什麼？找找「${cp.expectedLandmarks.join("」或「")}」。` } } };
  }
  if (NOT_BEFORE_RENAI.test(compact(text)) || isEnglishCaution(text)) return { result };
  const target = route.checkpoints.find(c => c.id === "cp3");
  const observed = [...observation.landmarks, ...observation.signage].map(compact);
  const evidence = target?.expectedLandmarks.filter(term => observed.includes(compact(term))) ?? [];
  if (!evidence.length) return { result };
  const confirmation = { id, kind: "renai-before-second-crossing" as const };
  return {
    pending: { ...confirmation, evidence, expiresAt: now + 120_000 },
    result: { ...result, action: { type: "ASK", checkpointId: "cp2", confirmation, messageKey: "ask.crossing-history",
      question: "你已經過復興南路，現在安全站在仁愛路口的人行道上，而且還沒有過仁愛路，對嗎？" } },
  };
}

export function withoutTextContinuation(record: SessionRecord): SessionRecord {
  const { pendingTextContinuation: _pending, ...clean } = record;
  if (clean.lastAction.type === "ASK") {
    const { confirmation: _confirmation, ...action } = clean.lastAction;
    return { ...clean, lastAction: action };
  }
  return clean;
}

/** Separate from ordinary crossing 'done': requires the current, unexpired server question. */
export function confirmTextContinuation(route: Route, record: SessionRecord,
  answer: { id: string; answer: "confirm" | "cancel" }, location: LocationFix | undefined, now: number): StepResult {
  const p = record.pendingTextContinuation;
  const target = route.checkpoints.find(c => c.id === "cp3");
  if (route.routeId !== "renai-001" || record.session.checkpointId !== "cp2"
    || !isPendingTextContinuation(p) || p.id !== answer.id || p.expiresAt <= now
    || record.lastAction.type !== "ASK" || record.lastAction.checkpointId !== "cp2"
    || record.lastAction.confirmation?.id !== p.id || record.lastAction.confirmation.kind !== p.kind
    || !target || !p.evidence.every(term => target.expectedLandmarks.includes(term))) {
    throw new RouteError("confirmation expired or no longer current");
  }
  const held = step(route, record.session, EMPTY_TEXT, location);
  if (answer.answer === "cancel") return held;
  const confirmed = step(route, { ...record.session, checkpointId: "cp3", state: "AT_CHECKPOINT", questionCount: 0 },
    { landmarks: p.evidence, signage: [], confidence: "high", source: "text" }, location);
  if (confirmed.verdict.locationVeto) {
    return { ...held, action: { type: "ASK", checkpointId: "cp2", messageKey: "ask.location-veto",
      question: "目前定位和路口對不上。請再看看附近路牌，告訴我上面的路名。" } };
  }
  return confirmed;
}
