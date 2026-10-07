import { describe, expect, it } from "vitest";
import routeJson from "../fixtures/route-renai-001.json";
import saved from "../eval/reviews/trip2-2026-10-07/saved-readings.json";
import { step } from "../src/engine.js";
import type { Observation, Route, SessionSnapshot } from "../src/types.js";

const route = routeJson as Route;
const at = (checkpointId: string, questionCount = 0): SessionSnapshot => ({
  routeId: route.routeId, state: "AT_CHECKPOINT", checkpointId, questionCount,
});
const photo = (...signage: string[]): Observation => ({ landmarks: [], signage, confidence: "high", source: "photo" });
const reading = (file: string, variant: string): Observation => {
  const value = saved.readings.find(r => r.file === file && r.variant === variant);
  if (!value) throw new Error(`Missing regression evidence: ${file}:${variant}`);
  return value.observation as Observation;
};

describe("photo context guards at crossings and recovery", () => {
  it.each([
    ["第二趟/jpg/IMG_5591.jpg", "small", "cp2"],
    ["第二趟/frames/IMG_5600_f1.jpg", "crop", "cp2"],
    ["S__121634854_0.jpg", "orig", "cp3"],
    ["S__121634854_0.jpg", "small", "cp3"],
  ])("holds the saved premature crossing %s %s on every repeated photo", (file, variant, checkpoint) => {
    for (const location of [undefined, { zone: "unknown" }]) {
      let session = at(checkpoint, 1);
      for (let repeat = 0; repeat < 4; repeat++) {
        const result = step(route, session, reading(file, variant), location);
        expect(result.action.type).toBe("REANCHOR");
        expect(result.session.checkpointId).toBe(checkpoint);
        session = result.session;
      }
    }
  });

  it.each([
    ["S__121634865_0.jpg", "crop"],
    ["S__121634868_0.jpg", "crop"],
    ["S__121634867_0.jpg", "orig"],
  ])("does not send a person inside toward the ER from %s %s", (file, variant) => {
    for (const location of [undefined, { zone: "unknown" }]) {
      let session = at("cp5");
      for (let repeat = 0; repeat < 4; repeat++) {
        const result = step(route, session, reading(file, variant), location);
        expect(result.action.type).toBe("REANCHOR");
        expect(result.session.checkpointId).toBe("cp5");
        // A context hold must not consume the entrance question and unlock arrival later.
        expect(result.session.questionCount).toBe(0);
        session = result.session;
      }
    }
  });

  it("still requires actual landmark evidence when the zone is compatible", () => {
    expect(step(route, at("cp2"), photo(), { zone: "lane" }).action.type).toBe("REANCHOR");
    expect(step(route, at("cp2"), photo("大安路一段116巷"), { zone: "lane" }).action.type).toBe("GUIDE");
    expect(step(route, at("cp3"), photo("福華飯店"), { zone: "renai_fuxing" }).action.type).toBe("GUIDE");
    expect(step(route, at("cp3"), photo("福華飯店"), { zone: "exit2" }).action.type).toBe("REANCHOR");
  });

  it("permits a matching recovery photo with a known compatible zone, never a lobby fix", () => {
    expect(step(route, at("cp5"), photo("急診"), { zone: "er" }).action.type).toBe("RECOVER");
    expect(step(route, at("cp5"), photo("急診"), { zone: "lobby" }).action.type).toBe("ASK");
    expect(step(route, at("cp5"), photo("綠色頂棚走廊"), { zone: "daan" }).action.type).toBe("RECOVER");
  });

  it("allows a text follow-up without location and still waits for the walker to cross", () => {
    const held = step(route, at("cp2"), photo("大安路一段116巷"));
    expect(held.session.checkpointId).toBe("cp2");
    const followup = step(route, held.session, { ...photo("大安路一段116巷"), source: "text" });
    expect(followup.action).toMatchObject({ type: "GUIDE", checkpointId: "cp2" });
    expect(followup.session.checkpointId).toBe("cp2x");
    const picture = step(route, followup.session, photo("仁愛路"), { zone: "renai_fuxing" });
    expect(picture.session.checkpointId).toBe("cp2x");
    const crossed = step(route, picture.session, { ...photo(), source: "walker" });
    expect(crossed.action).toMatchObject({ type: "GUIDE", checkpointId: "cp2x" });
    expect(crossed.session.checkpointId).toBe("cp3");
  });

  it("does not spend the entrance question on an uncertain recovery photo", () => {
    const held = step(route, at("cp5"), photo("急診"));
    expect(held.session.questionCount).toBe(0);
    const entrance = step(route, held.session, photo("復康巴士"));
    expect(entrance.action.type).toBe("ASK");
    expect(entrance.session.state).not.toBe("ARRIVED");
  });
});
