import { describe, expect, it } from "vitest";
import renaiJson from "../fixtures/route-renai-001.json";
import { KeywordInterpreter } from "../src/interpreter.js";
import { createApp } from "../src/server.js";
import { InMemorySessionStore } from "../src/store.js";
import { routeVocabulary } from "../src/validator.js";
import type { Route } from "../src/types.js";

const route = renaiJson as Route;

/**
 * Field-verified route: MRT Zhongxiao Fuxing Exit 2 (elevator) → Taipei City
 * Hospital Renai Branch lobby entrance (step-free). Every landmark string in
 * the fixture was photographed on site on 2026-09-26; the walk-through below
 * replays the same demo grammar as the synthetic fixture, in zh-TW.
 */
describe("renai-001 field route", () => {
  const makeApp = () =>
    createApp({
      routes: [route],
      store: new InMemorySessionStore(),
      interpreter: new KeywordInterpreter(),
    });

  const client = (app: ReturnType<typeof makeApp>) => {
    const post = async (path: string, body: unknown) => {
      const res = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    };
    return post;
  };

  it("walks exit 2 to the lobby doors on user language", async () => {
    const post = client(makeApp());
    const { sessionId } = await post("/api/sessions", { routeId: route.routeId });
    const observe = (text: string) => post(`/api/sessions/${sessionId}/observations`, { text });

    // cp1 — the accessible anchor: elevator exit, not just "an exit".
    let r = await observe("我看到出口2的牌子，SOGO復興館");
    expect(r.verdict.verdict).toBe("CONFIRMED");
    expect(r.action.type).toBe("GUIDE");
    expect(r.session.checkpointId).toBe("cp2");

    // cp2 — the convenience store confirms the straight segment.
    r = await observe("經過7-11了");
    expect(r.session.checkpointId).toBe("cp3");

    // cp3 — the eight-lane crossing; the Howard Plaza corner anchors it.
    r = await observe("我看到福華飯店，到大路口了");
    expect(r.session.checkpointId).toBe("cp4");

    // cp4 — the emergency/parking driveway confirms the hospital block,
    // and the instruction says to keep walking, so the next stop is the lobby.
    r = await observe("我看到紅色的急診跟一個P的車道");
    expect(r.verdict.verdict).toBe("CONFIRMED");
    expect(r.session.checkpointId).toBe("cp5");

    // Mode B — a glass door alone can never confirm arrival.
    r = await observe("我在一個玻璃門前面");
    expect(r.verdict.verdict).toBe("INSUFFICIENT");
    expect(r.action.type).toBe("ASK");
    expect(r.session.state).toBe("AMBIGUOUS");

    // Mode D — arrival needs the entrance's own evidence.
    r = await observe("掛牌寫臺北市立聯合醫院");
    expect(r.action.type).toBe("CONFIRM_ARRIVAL");
    expect(r.session.state).toBe("ARRIVED");
  });

  it("recovers when the user overshoots to Daan Rd", async () => {
    const post = client(makeApp());
    const { sessionId } = await post("/api/sessions", { routeId: route.routeId });
    const observe = (text: string) => post(`/api/sessions/${sessionId}/observations`, { text });

    await observe("出口2");
    await observe("小七");
    await observe("仁愛路");
    await observe("急診車道");

    // Past the lobby, the Daan Rd corner is the walked-too-far evidence.
    let r = await observe("我走到大安路了");
    expect(r.verdict.verdict).toBe("CONFLICT");
    expect(r.action.type).toBe("RECOVER");
    expect(r.session.state).toBe("RECOVERING");
    expect(r.session.checkpointId).toBe("cp4");

    // Recovery closes only on confirmed evidence, then arrival still works.
    r = await observe("回到急診的車道口了");
    expect(r.session.state).toBe("AT_CHECKPOINT");
    r = await observe("看到復康巴士臨時停車區的牌子");
    expect(r.session.checkpointId).toBe("cp5");
    r = await observe("門口掛牌是聯合醫院仁愛院區");
    expect(r.session.state).toBe("ARRIVED");
  });

  it("answers the entrance question: an emergency sign means keep walking to the lobby", async () => {
    const post = client(makeApp());
    const { sessionId } = await post("/api/sessions", { routeId: route.routeId });
    const observe = (text: string) => post(`/api/sessions/${sessionId}/observations`, { text });
    await observe("出口2");
    await observe("小七");
    await observe("福華飯店");
    await observe("急診車道");

    let r = await observe("我在一個玻璃門前面");
    expect(r.action.type).toBe("ASK");

    // "Yes, it says 急診" — still at the driveway; the lobby is a little further on.
    r = await observe("對，上面寫急診");
    expect(r.verdict.verdict).toBe("CONFLICT");
    expect(r.action.type).toBe("RECOVER");
    expect(r.session.checkpointId).toBe("cp5");

    // The emergency pylon also reads 仁愛院區 — conflict must beat arrival.
    r = await observe("牌子寫仁愛院區急診");
    expect(r.verdict.verdict).toBe("CONFLICT");
    expect(r.session.state).not.toBe("ARRIVED");

    r = await observe("黃色掛牌寫臺北市立聯合醫院");
    expect(r.session.state).toBe("ARRIVED");
  });

  it("anchors the exit by what is visible looking out, not by in-station line signs", async () => {
    const post = client(makeApp());
    const { sessionId } = await post("/api/sessions", { routeId: route.routeId });
    const observe = (text: string) => post(`/api/sessions/${sessionId}/observations`, { text });
    let r = await observe("我看到板南線的指標");
    expect(r.verdict.verdict).toBe("UNKNOWN");
    expect(r.session.checkpointId).toBe("cp1");
    // Every station map's legend prints 無障礙坡道 — reading it proves nothing about the exit.
    r = await observe("地圖下面寫無障礙坡道");
    expect(r.verdict.verdict).not.toBe("CONFIRMED");
    expect(r.session.checkpointId).toBe("cp1");
    r = await observe("出來正前方是忠孝東路跟復興南路的路口");
    expect(r.verdict.verdict).toBe("CONFIRMED");
    expect(r.session.checkpointId).toBe("cp2");
  });

  it("never treats an unregistered landmark as evidence", async () => {
    const post = client(makeApp());
    const { sessionId } = await post("/api/sessions", { routeId: route.routeId });
    const r = await post(`/api/sessions/${sessionId}/observations`, {
      text: "我看到一間很大的百貨公司跟一台紅色腳踏車",
    });
    expect(r.verdict.verdict).toBe("UNKNOWN");
    expect(r.session.checkpointId).toBe("cp1");
  });

  it("keeps recovery pointers and next ids inside the route", () => {
    const ids = new Set(route.checkpoints.map((c) => c.id));
    for (const cp of route.checkpoints) {
      if (cp.next) expect(ids.has(cp.next)).toBe(true);
      for (const c of cp.conflictLandmarks ?? []) {
        expect(ids.has(c.recoveryPointer)).toBe(true);
      }
    }
    // The terminal checkpoint declares arrival evidence; no other one does.
    const terminals = route.checkpoints.filter((c) => c.arrivalEvidence);
    expect(terminals.map((c) => c.id)).toEqual(["cp5"]);
    // Crystal's field ruling: Howard Plaza marks the Renai crossing (seeing it
    // is on-route evidence, so it is an anchor, never a conflict).
    const cp3 = route.checkpoints.find((c) => c.id === "cp3");
    expect(cp3?.expectedLandmarks).toContain("福華飯店");
    expect(cp3?.conflictLandmarks ?? []).toEqual([]);
    // Vocabulary is normalized and non-empty — the fail-closed boundary exists.
    expect(routeVocabulary(route).size).toBeGreaterThan(10);
  });
});
