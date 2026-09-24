import { describe, expect, it } from "vitest";
import routeJson from "../fixtures/fixture-hospital-001.json";
import { RouteError, startSession, step } from "../src/engine.js";
import { observationSchema, type Observation, type Route, type SessionSnapshot } from "../src/types.js";
import { routeVocabulary, validate } from "../src/validator.js";

const route = routeJson as Route;

const obs = (landmarks: string[], overrides: Partial<Observation> = {}): Observation => ({
  landmarks,
  signage: [],
  confidence: "medium",
  source: "text",
  ...overrides,
});

const at = (checkpointId: string, extra: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  routeId: route.routeId,
  state: "AT_CHECKPOINT",
  checkpointId,
  questionCount: 0,
  ...extra,
});

describe("session start", () => {
  it("starts at the route's start checkpoint", () => {
    expect(startSession(route)).toEqual(at("cp1"));
  });

  it("rejects a route whose start checkpoint is missing", () => {
    expect(() => startSession({ ...route, start: "nope" })).toThrow(RouteError);
  });
});

describe("normal progression", () => {
  it("advances on confirmed evidence and guides the next segment", () => {
    const { session, action, verdict } = step(route, at("cp1"), obs(["Exit 6 Sign"]));
    expect(verdict.verdict).toBe("CONFIRMED");
    expect(session).toEqual(at("cp2"));
    expect(action).toEqual({
      type: "GUIDE",
      checkpointId: "cp1",
      instruction: route.checkpoints[0]!.instruction,
    });
  });

  it("matches signage as evidence too", () => {
    const { verdict } = step(route, at("cp2"), obs([], { signage: ["green pharmacy sign"] }));
    expect(verdict.verdict).toBe("CONFIRMED");
  });
});

describe("fail-closed evidence boundary", () => {
  it("ignores landmarks not registered in the route", () => {
    const { session, action, verdict } = step(route, at("cp1"), obs(["taipei 101"]));
    expect(verdict.verdict).toBe("UNKNOWN");
    expect(verdict.unrecognized).toEqual(["taipei 101"]);
    expect(session.checkpointId).toBe("cp1");
    expect(action).toEqual({ type: "REANCHOR", checkpointId: "cp1", lookFor: ["exit 6 sign"] });
  });

  it("registers conflict and arrival evidence in the vocabulary", () => {
    const vocab = routeVocabulary(route);
    expect(vocab.has("roundabout")).toBe(true);
    expect(vocab.has("outpatient entrance sign")).toBe(true);
  });
});

describe("ambiguity: one question, then re-anchor", () => {
  it("asks the checkpoint's single discriminating question on shared evidence", () => {
    const { session, action, verdict } = step(route, at("cp5"), obs(["hospital building"]));
    expect(verdict.verdict).toBe("INSUFFICIENT");
    expect(session.state).toBe("AMBIGUOUS");
    expect(session.questionCount).toBe(1);
    expect(action).toEqual({
      type: "ASK",
      checkpointId: "cp5",
      question: route.checkpoints[4]!.ambiguity!.question,
    });
  });

  it("does not ask a second question — it re-anchors instead", () => {
    const stuck = at("cp5", { state: "AMBIGUOUS", questionCount: 1 });
    const { action } = step(route, stuck, obs(["glass doors"]));
    expect(action.type).toBe("REANCHOR");
  });
});

describe("conflict and recovery", () => {
  it("recognizes off-route evidence and re-anchors at the recovery pointer", () => {
    const { session, action, verdict } = step(route, at("cp5"), obs(["emergency red sign"]));
    expect(verdict.verdict).toBe("CONFLICT");
    expect(session.state).toBe("RECOVERING");
    expect(session.checkpointId).toBe("cp4");
    expect(action).toEqual({
      type: "RECOVER",
      checkpointId: "cp4",
      instruction: route.checkpoints[4]!.conflictLandmarks![0]!.recoveryInstruction,
    });
  });

  it("closes recovery only when the recovery checkpoint is confirmed", () => {
    const recovering = at("cp4", { state: "RECOVERING" });
    const { session, action } = step(route, recovering, obs(["blue outpatient signpost"]));
    expect(session.state).toBe("AT_CHECKPOINT");
    expect(session.checkpointId).toBe("cp5");
    expect(action.type).toBe("GUIDE");
  });

  it("stays RECOVERING on unknown evidence while recovering", () => {
    const recovering = at("cp4", { state: "RECOVERING" });
    const { session } = step(route, recovering, obs(["something else entirely"]));
    expect(session.state).toBe("RECOVERING");
  });

  it("conflict outranks confirming evidence in the same observation", () => {
    const { verdict } = step(route, at("cp5"), obs(["outpatient forecourt", "emergency red sign"]));
    expect(verdict.verdict).toBe("CONFLICT");
  });
});

describe("true arrival", () => {
  it("arrives only on arrival evidence, never on proximity", () => {
    const { session, action } = step(route, at("cp5"), obs(["outpatient entrance sign"]));
    expect(session.state).toBe("ARRIVED");
    expect(action).toEqual({ type: "CONFIRM_ARRIVAL", checkpointId: "cp5" });
  });

  it("being near the terminal checkpoint is not arrival", () => {
    const { session, action } = step(route, at("cp5"), obs(["outpatient forecourt"]));
    expect(session.state).toBe("AT_CHECKPOINT");
    expect(session.checkpointId).toBe("cp5");
    expect(action.type).toBe("GUIDE");
  });

  it("refuses to step an arrived session", () => {
    const arrived = at("cp5", { state: "ARRIVED" });
    expect(() => step(route, arrived, obs(["anything"]))).toThrow(RouteError);
  });
});

describe("untrusted LLM output", () => {
  it("rejects malformed observations", () => {
    expect(observationSchema.safeParse({ landmarks: "exit 6" }).success).toBe(false);
    expect(observationSchema.safeParse(null).success).toBe(false);
    expect(
      observationSchema.safeParse({
        landmarks: Array(11).fill("x"),
        signage: [],
        confidence: "high",
        source: "text",
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        landmarks: ["exit 6 sign"],
        signage: [],
        confidence: "certain",
        source: "text",
      }).success,
    ).toBe(false);
  });

  it("accepts a well-formed observation", () => {
    const parsed = observationSchema.safeParse({
      landmarks: ["exit 6 sign"],
      signage: ["Exit 6"],
      confidence: "high",
      source: "photo",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("route integrity errors", () => {
  it("rejects a session from another route", () => {
    const foreign = { ...at("cp1"), routeId: "other-route" };
    expect(() => step(route, foreign, obs([]))).toThrow(RouteError);
  });

  it("rejects an unknown checkpoint", () => {
    expect(() => step(route, at("cp99"), obs([]))).toThrow(RouteError);
  });

  it("rejects a conflict whose recovery pointer is missing", () => {
    const broken: Route = structuredClone(route);
    broken.checkpoints[4]!.conflictLandmarks![0]!.recoveryPointer = "cp99";
    expect(() => step(broken, at("cp5"), obs(["emergency red sign"]))).toThrow(RouteError);
  });
});

describe("validator purity", () => {
  it("is a pure function of (route, checkpoint, observation)", () => {
    const cp = route.checkpoints[0]!;
    const o = obs(["exit 6 sign"]);
    expect(validate(route, cp, o)).toEqual(validate(route, cp, o));
  });
});
