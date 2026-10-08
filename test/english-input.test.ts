import { describe, expect, it } from "vitest";
import renaiJson from "../fixtures/route-renai-001.json";
import { KeywordInterpreter } from "../src/interpreter.js";
import { step } from "../src/engine.js";
import { withTextAlias, textFollowUp } from "../src/textFollowUp.js";
import type { Route, SessionSnapshot } from "../src/types.js";

const route = renaiJson as Route;
const parser = new KeywordInterpreter();
const pairs = [
  ["I see Lane 116, Section 1, Da'an Road", "大安路一段116巷", "cp2"],
  ["Alley 13, Lane 123, Section 3, Renai Road", "仁愛路三段123巷13弄", "cp2"],
  ["I see Renai Road", "仁愛路", "cp3"],
  ["I see the Howard Plaza Hotel", "福華飯店", "cp3"],
  ["I see the emergency department", "急診", "cp4"],
  ["I see a rehabilitation bus", "復康巴士", "cp5"],
  ["I see queued taxis", "排班計程車", "cp5"],
  ["I see a yellow vertical plaque", "黃色直式掛牌", "cp5"],
  ["I see the green-roofed corridor", "綠色頂棚走廊", "cp5"],
] as const;
describe("English deterministic input stays inside existing route vocabulary", () => {
  it.each(["I don't see Renai Road", "I didn't reach Renai Road", "Is this Renai Road?", "Renai Road?", "Renai Road？", "I am looking for Renai Road", "I have crossed Renai Road"])("holds despite a mistaken model guess for non-affirmative speech: %s", text => {
    const guessed = { landmarks: ["仁愛路"], signage: [], confidence: "high" as const, source: "text" as const };
    const observation = withTextAlias(route, text, guessed);
    const result = step(route, { routeId: "renai-001", state: "AT_CHECKPOINT", checkpointId: "cp3", questionCount: 0 }, observation);
    expect(observation.landmarks).toEqual([]);
    expect(result.session.checkpointId).toBe("cp3");
    expect(result.action.type).toBe("REANCHOR");
  });
  it.each(pairs)("%s has the same route outcome as %s", async (english, chinese, checkpointId) => {
    const translated = await parser.interpret(english, route);
    expect(translated.landmarks).toEqual([chinese]);
    const original = await parser.interpret(chinese, route);
    const session: SessionSnapshot = { routeId: route.routeId, state: "AT_CHECKPOINT", checkpointId, questionCount: 0 };
    const en = step(route, session, translated); const zh = step(route, session, original);
    expect(en.session).toEqual(zh.session); expect(en.action).toEqual(zh.action);
  });
  it.each(["I cannot see Renai Road", "I am not at the emergency department", "Maybe I see a rehabilitation bus", "I already crossed Renai Road", "a bus", "clinic", "somewhere near Da'an Road", "Lane 116, Section 2, Da'an Road"])("does not turn uncertain or unregistered phrase into evidence: %s", async text => {
    expect((await parser.interpret(text, route)).landmarks).toEqual([]);
  });
  it("overrides a model guess for English uncertainty or a generic bike station", () => {
    const guessed = { landmarks: ["仁愛路"], signage: [], confidence: "high" as const, source: "text" as const };
    expect(withTextAlias(route, "I see a YouBike station", guessed).landmarks).toEqual([]);
    expect(withTextAlias(route, "I cannot see Renai Road", guessed).landmarks).toEqual([]);
  });
  it("asks for the real lane sign near a YouBike station without moving cp2", async () => {
    const session: SessionSnapshot = { routeId: "renai-001", state: "AT_CHECKPOINT", checkpointId: "cp2", questionCount: 0 };
    const text = "I see a YouBike station";
    const observation = withTextAlias(route, text, await parser.interpret(text, route));
    const result = textFollowUp(route, { session, lastAction: { type: "REANCHOR", checkpointId: "cp2", lookFor: [] } }, step(route, session, observation), observation, text, 1000, "q");
    expect(result.result.session.checkpointId).toBe("cp2");
    expect(result.result.action).toMatchObject({ type: "ASK", messageKey: "ask.youbike" });
    expect(result.pending).toBeUndefined();
  });
  it("requires explicit crossing-history confirmation for the English intersection alias", async () => {
    const session: SessionSnapshot = { routeId: "renai-001", state: "AT_CHECKPOINT", checkpointId: "cp2", questionCount: 0 };
    const text = "I am at the intersection of Renai Road and Fuxing South Road";
    const observation = withTextAlias(route, text, await parser.interpret(text, route));
    const result = textFollowUp(route, { session, lastAction: { type: "REANCHOR", checkpointId: "cp2", lookFor: [] } }, step(route, session, observation), observation, text, 1000, "q");
    expect(result.result.session.checkpointId).toBe("cp2");
    expect(result.result.action).toMatchObject({ type: "ASK", messageKey: "ask.crossing-history", confirmation: { id: "q" } });
    expect(result.pending?.evidence).toEqual(["仁愛路"]);
  });
  it("does not install English aliases into an unrelated route", async () => {
    expect((await parser.interpret("I see Renai Road", { ...route, routeId: "other" })).landmarks).toEqual([]);
  });
});
