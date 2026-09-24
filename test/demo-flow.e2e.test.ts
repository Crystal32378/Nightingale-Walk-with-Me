import { describe, expect, it } from "vitest";
import routeJson from "../fixtures/fixture-hospital-001.json";
import { KeywordInterpreter } from "../src/interpreter.js";
import { createApp } from "../src/server.js";
import { InMemorySessionStore } from "../src/store.js";
import type { Route } from "../src/types.js";

const route = routeJson as Route;

/**
 * The four required demo modes, end to end over the HTTP API:
 * A normal progression, B ambiguity (one question), C conflict + recovery,
 * D true arrival — plus the honesty case: unknown input never advances.
 */
describe("demo journey (modes A–D)", () => {
  it("walks the full story on one route", async () => {
    const app = createApp({
      routes: [route],
      store: new InMemorySessionStore(),
      interpreter: new KeywordInterpreter(),
    });
    const post = async (path: string, body: unknown) => {
      const res = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    };

    const { sessionId } = await post("/api/sessions", { routeId: route.routeId });
    const observe = (text: string) => post(`/api/sessions/${sessionId}/observations`, { text });

    // Mode A — normal progression from the transit exit.
    let r = await observe("I can see the exit 6 sign");
    expect(r.action.type).toBe("GUIDE");
    r = await observe("there is a green pharmacy sign on my right");
    expect(r.session.checkpointId).toBe("cp3");

    // Honesty — an unregistered landmark never advances the route.
    r = await observe("I see a night market");
    expect(r.verdict.verdict).toBe("UNKNOWN");
    expect(r.action.type).toBe("REANCHOR");
    expect(r.session.checkpointId).toBe("cp3");

    // Mode C — conflict: the roundabout means the user overshot.
    r = await observe("I reached a big roundabout");
    expect(r.verdict.verdict).toBe("CONFLICT");
    expect(r.action.type).toBe("RECOVER");
    expect(r.session.state).toBe("RECOVERING");
    expect(r.session.checkpointId).toBe("cp2");

    // Recovery closes only on confirmed evidence.
    r = await observe("ok I am back at the green pharmacy sign");
    expect(r.session.state).toBe("AT_CHECKPOINT");
    r = await observe("I can see the footbridge ahead");
    expect(r.session.checkpointId).toBe("cp4");
    r = await observe("blue outpatient signpost");
    expect(r.session.checkpointId).toBe("cp5");

    // Mode B — shared evidence is not enough; exactly one question.
    r = await observe("I am in front of the hospital building");
    expect(r.verdict.verdict).toBe("INSUFFICIENT");
    expect(r.action.type).toBe("ASK");
    expect(r.session.state).toBe("AMBIGUOUS");

    // Mode D — arrival requires entrance evidence, not proximity.
    r = await observe("the sign above the door says outpatient entrance sign");
    expect(r.action.type).toBe("CONFIRM_ARRIVAL");
    expect(r.session.state).toBe("ARRIVED");
  });
});
