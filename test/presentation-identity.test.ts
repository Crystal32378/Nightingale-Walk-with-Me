import { describe, expect, it } from "vitest";
import renaiJson from "../fixtures/route-renai-001.json";
import { step } from "../src/engine.js";
import type { Route, SessionSnapshot } from "../src/types.js";

const route = renaiJson as Route;
const session: SessionSnapshot = { routeId: "renai-001", state: "AT_CHECKPOINT", checkpointId: "cp5", questionCount: 0 };
describe("route-authored presentation identity", () => {
  it.each([["急診", "recover.er"], ["大安路", "recover.daan"], ["綠色頂棚走廊", "recover.canopy"]])("distinguishes %s recovery without deriving identity from prose", (landmark, messageKey) => {
    const result = step(route, session, { landmarks: [landmark], signage: [], confidence: "high", source: "text" });
    expect(result.action).toMatchObject({ type: "RECOVER", checkpointId: "cp5", messageKey });
    expect(result.session).toEqual({ ...session, state: "RECOVERING" });
  });
  it("carries a stable entrance question identity while retaining the question budget", () => {
    const result = step(route, session, { landmarks: ["復康巴士"], signage: [], confidence: "high", source: "text" });
    expect(result.action).toMatchObject({ type: "ASK", messageKey: "ask.entrance" });
    expect(result.session.questionCount).toBe(1);
  });
});
