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

  const walk = async (app = makeApp()) => {
    const post = client(app);
    const { sessionId } = await post("/api/sessions", { routeId: route.routeId });
    const send = (body: unknown) => post(`/api/sessions/${sessionId}/observations`, body);
    return {
      observe: (text: string, zone?: string) => send(zone ? { text, location: { zone } } : { text }),
      crossed: () => send({ confirm: "crossed" }),
      send,
    };
  };

  it("walks exit 2 ground level to the lobby, one job per step, crossings confirmed by the walker", async () => {
    const { observe, crossed } = await walk();

    let r = await observe("我在出口2外面，後面是SOGO復興館", "exit2");
    expect(r.action).toMatchObject({ type: "GUIDE", instruction: "出口2出來，往右轉。" });
    expect(r.session.checkpointId).toBe("cp2");

    r = await observe("前面路口有YouBike", "yb");
    expect(r.action.instruction).toBe("等綠燈，過復興南路。");
    expect(r.expects).toBe("walker");

    // While crossing, nothing but the walker's own "done" moves the walk on.
    r = await observe("我看到仁愛路");
    expect(r.session.checkpointId).toBe("cp2x");
    expect(r.action.type).toBe("REANCHOR");
    r = await crossed();
    expect(r.action.instruction).toBe("過完馬路，往右轉。");
    expect(r.expects).toBe("evidence");

    r = await observe("到仁愛路口了，對面是福華飯店", "renai_fuxing");
    expect(r.action.instruction).toBe("等綠燈，過仁愛路。");
    r = await crossed();
    expect(r.action.instruction).toBe("過完左轉，醫院在這一側。");

    r = await observe("我看到紅色的急診跟一個P的車道", "er");
    expect(r.session.checkpointId).toBe("cp5");

    // The hospital name is printed all along the way: it only asks.
    r = await observe("掛牌寫臺北市立聯合醫院", "lobby");
    expect(r.action.type).toBe("ASK");

    r = await observe("門口有復康巴士的牌子", "lobby");
    expect(r.action.type).toBe("CONFIRM_ARRIVAL");
    expect(r.session.state).toBe("ARRIVED");
  });

  it("never speaks or shows signal seconds: timings are field notes, marked unstable", () => {
    for (const cp of route.checkpoints) {
      expect(cp.instruction).not.toMatch(/秒/);
      for (const o of cp.observations ?? []) expect(o.stable).toBe(false);
    }
    expect(JSON.stringify(route)).not.toMatch(/7-Eleven|7-11|小七|輪椅專用道|自行車標線/);
  });

  it("location vetoes a corner the walker cannot have reached, without inventing a place", async () => {
    const { observe } = await walk();
    await observe("出口2", "exit2");
    const r = await observe("我看到YouBike", "exit2");
    expect(r.verdict.locationVeto).toBe("exit2");
    expect(r.action.type).toBe("REANCHOR");
    expect(r.session.checkpointId).toBe("cp2");
  });

  it("an unknown location asks once at the lobby, then lets the lobby's own evidence arrive", async () => {
    const { observe, crossed } = await walk();
    await observe("出口2");
    await observe("YouBike");
    await crossed();
    await observe("仁愛路");
    await crossed();
    await observe("急診車道");
    let r = await observe("看到復康巴士臨時停車區的牌子");
    expect(r.action.type).toBe("ASK");
    r = await observe("看到復康巴士臨時停車區的牌子");
    expect(r.session.state).toBe("ARRIVED");
  });

  it("a known zone short of the lobby holds arrival back", async () => {
    const { observe, crossed } = await walk();
    await observe("出口2");
    await observe("YouBike");
    await crossed();
    await observe("仁愛路");
    await crossed();
    await observe("急診車道");
    const r = await observe("看到排班計程車的牌子", "renai_fuxing");
    expect(r.verdict.locationVeto).toBe("renai_fuxing");
    expect(r.session.state).not.toBe("ARRIVED");
  });

  it("recovers from the Daan Rd side straight back to the lobby", async () => {
    const { observe, crossed } = await walk();
    await observe("出口2");
    await observe("YouBike");
    await crossed();
    await observe("仁愛路");
    await crossed();
    await observe("急診車道");
    let r = await observe("我走到大安路了");
    expect(r.action.type).toBe("RECOVER");
    expect(r.session.checkpointId).toBe("cp5");
    r = await observe("門口掛牌是黃色直式掛牌", "lobby");
    expect(r.session.state).toBe("ARRIVED");
  });

  it("an emergency sign at the lobby step means keep walking; conflict beats arrival", async () => {
    const { observe, crossed } = await walk();
    await observe("出口2");
    await observe("YouBike");
    await crossed();
    await observe("仁愛路");
    await crossed();
    await observe("急診車道");
    const r = await observe("牌子寫復康巴士，旁邊寫急診", "lobby");
    expect(r.verdict.verdict).toBe("CONFLICT");
    expect(r.session.state).not.toBe("ARRIVED");
  });

  it("rejects a zone the route does not have", async () => {
    const { send } = await walk();
    const res = await send({ text: "出口2", location: { zone: "moon" } });
    expect(res.error).toBe("invalid location");
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

  it("keeps recovery pointers, next ids and zones inside the route", () => {
    const ids = new Set(route.checkpoints.map((c) => c.id));
    const zones = new Set((route.zones ?? []).map((z) => z.id));
    for (const cp of route.checkpoints) {
      if (cp.next) expect(ids.has(cp.next)).toBe(true);
      for (const c of cp.conflictLandmarks ?? []) expect(ids.has(c.recoveryPointer)).toBe(true);
      for (const z of [...(cp.zones?.allow ?? []), ...(cp.zones?.ask ?? [])]) expect(zones.has(z), `${cp.id}:${z}`).toBe(true);
      if (cp.confirmBy === "walker") expect(cp.expectedLandmarks).toEqual([]);
    }
    const terminals = route.checkpoints.filter((c) => c.arrivalEvidence);
    expect(terminals.map((c) => c.id)).toEqual(["cp5"]);
    // Arrival needs lobby-only evidence; the hospital name is shared everywhere.
    const cp5 = terminals[0]!;
    expect(cp5.arrivalEvidence).not.toContain("臺北市立聯合醫院");
    expect(cp5.ambiguity?.sharedEvidence).toContain("臺北市立聯合醫院");
    expect(routeVocabulary(route).size).toBeGreaterThan(10);
  });
});
