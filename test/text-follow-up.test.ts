import { beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import renaiJson from "../fixtures/route-renai-001.json";
import { KeywordInterpreter, type Interpreter } from "../src/interpreter.js";
import { createApp } from "../src/server.js";
import { FirestoreSessionStore, InMemorySessionStore, type DocCollection, type SessionRecord } from "../src/store.js";
import type { Route } from "../src/types.js";

const route = renaiJson as Route;
let clock: number;
let store: InMemorySessionStore;
let app: ReturnType<typeof createApp>;
const post = (path: string, body: unknown) => app.request(path, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  clock = 1000;
  store = new InMemorySessionStore();
  app = createApp({ routes: [route], store, interpreter: new KeywordInterpreter(), now: () => clock });
});
async function atCp2() {
  const start = await (await post("/api/sessions", { routeId: route.routeId })).json();
  const path = `/api/sessions/${start.sessionId}/observations`;
  await post(path, { confirm: "done" });
  return { id: start.sessionId as string, path };
}
async function pending() {
  const walk = await atCp2();
  const response = await (await post(walk.path, { text: "仁愛復興路口" })).json();
  // A missing pending confirmation is the bug, not a test setup exception.
  expect(response.action.confirmation).toMatchObject({ kind: "renai-before-second-crossing" });
  return { ...walk, confirmation: response.action.confirmation };
}

describe("Renai text follow-up without inventing location", () => {
  it("answers YouBike with a road-sign question while holding cp2", async () => {
    const { path } = await atCp2();
    const r = await (await post(path, { text: "youbike站" })).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect(r.action.type).toBe("ASK");
    expect(r.action.question).toContain("YouBike");
    expect(r.action.question).toContain("大安路一段116巷");
    expect(r.action.confirmation).toBeUndefined();
    expect(r.expects).toBe("evidence");
  });

  it("requires the walker's crossing-history confirmation for the reported intersection", async () => {
    const { id, path } = await atCp2();
    const r = await (await post(path, { text: "仁愛復興路口" })).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect(r.action.type).toBe("ASK");
    expect(r.action.question).toContain("過復興南路");
    expect(r.action.question).toContain("還沒有過仁愛路");
    expect(r.action.confirmation?.kind).toBe("renai-before-second-crossing");
    expect((await store.get(id))?.lastAction.type).toBe("ASK");
    expect(r.expects).toBe("evidence");
  });

  it("continues to the second crossing only after explicit confirmation, then still waits for done", async () => {
    const { path, confirmation } = await pending();
    const r = await (await post(path, { confirmation: { id: confirmation.id, answer: "confirm" }, location: { zone: "renai_fuxing" } })).json();
    expect(r.session.checkpointId).toBe("cp3x");
    expect(r.action).toMatchObject({ type: "GUIDE", checkpointId: "cp3" });
    expect(r.expects).toBe("walker");
    expect((await (await post(path, { text: "急診" })).json()).session.checkpointId).toBe("cp3x");
    expect((await (await post(path, { confirm: "done" })).json()).session.checkpointId).toBe("cp4");
  });

  it("permits the established text fallback with unknown GPS after explicit confirmation", async () => {
    const { path, confirmation } = await pending();
    const r = await (await post(path, { confirmation: { id: confirmation.id, answer: "confirm" }, location: { zone: "unknown" } })).json();
    expect(r.session.checkpointId).toBe("cp3x");
  });

  it("rechecks the current known zone and holds instead of replaying an old location", async () => {
    const { path, confirmation } = await pending();
    const r = await (await post(path, { confirmation: { id: confirmation.id, answer: "confirm" }, location: { zone: "exit2" } })).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect(r.action.confirmation).toBeUndefined();
    expect(r.expects).toBe("evidence");
  });

  it.each(["cancel", "done", "new text"])("clears a pending continuation on %s without advancing", async (operation) => {
    const { path, confirmation } = await pending();
    const body = operation === "cancel" ? { confirmation: { id: confirmation.id, answer: "cancel" } }
      : operation === "done" ? { confirm: "done" } : { text: "我不確定" };
    const r = await (await post(path, body)).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect((await post(path, { confirmation: { id: confirmation.id, answer: "confirm" } })).status).toBe(409);
  });

  it("rejects absent, forged, expired and consumed confirmation IDs", async () => {
    const initial = await atCp2();
    expect((await post(initial.path, { confirmation: { id: "missing", answer: "confirm" } })).status).toBe(409);
    const { path, confirmation } = await pending();
    expect((await post(path, { confirmation: { id: "wrong", answer: "confirm" } })).status).toBe(409);
    clock += 5 * 60_000;
    expect((await post(path, { confirmation: { id: confirmation.id, answer: "confirm" } })).status).toBe(409);
    const fresh = await pending();
    expect((await post(fresh.path, { confirmation: { id: fresh.confirmation.id, answer: "confirm" } })).status).toBe(200);
    expect((await post(fresh.path, { confirmation: { id: fresh.confirmation.id, answer: "confirm" } })).status).toBe(409);
  });

  it("refuses mixed photo/text/confirmation payloads", async () => {
    const { path, confirmation } = await pending();
    expect((await post(path, { text: "仁愛路", confirmation: { id: confirmation.id, answer: "confirm" } })).status).toBe(400);
    expect((await post(path, { photo: {}, confirmation: { id: confirmation.id, answer: "confirm" } })).status).toBe(400);
  });

  it("does not open the continuation from structured observations", async () => {
    const { path } = await atCp2();
    const r = await (await post(path, { observation: { landmarks: ["仁愛路"], signage: [], confidence: "high", source: "text" } })).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect(r.action.confirmation).toBeUndefined();
  });

  it("keeps the ordinary first-crossing evidence path ahead of recovery hints", async () => {
    const { path } = await atCp2();
    const r = await (await post(path, { text: "大安路一段116巷，接著要去仁愛路" })).json();
    expect(r.session.checkpointId).toBe("cp2x");
    expect(r.action).toMatchObject({ type: "GUIDE", checkpointId: "cp2" });
    expect(r.action.confirmation).toBeUndefined();
  });

  it("does not offer a pre-crossing continuation to someone who says they already crossed Renai", async () => {
    const { path } = await atCp2();
    const r = await (await post(path, { text: "我已經過仁愛路" })).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect(r.action.confirmation).toBeUndefined();
  });

  it("understands the same intersection alias at cp3 through the normal interpreter fallback", async () => {
    const { path } = await atCp2();
    await post(path, { text: "大安路一段116巷" });
    await post(path, { confirm: "done" });
    const r = await (await post(path, { text: "仁愛復興路口" })).json();
    expect(r.session.checkpointId).toBe("cp3x");
    expect(r.action.checkpointId).toBe("cp3");
  });

  it.each(["youbike站", "仁愛復興路口"])("does not let model guesses turn the narrow hint %s into first-crossing evidence", async (text) => {
    const interpreter: Interpreter = { interpret: async () => ({ landmarks: ["大安路一段116巷"], signage: [], confidence: "high", source: "text" }) };
    app = createApp({ routes: [route], store, interpreter, now: () => clock });
    const { path } = await atCp2();
    const r = await (await post(path, { text })).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect(r.action.type).toBe("ASK");
  });

  it("photo evidence cannot open a continuation, and a new photo withdraws an old one", async () => {
    const interpreter: Interpreter = {
      interpret: (text, r) => new KeywordInterpreter().interpret(text, r),
      interpretPhoto: async () => ({ landmarks: ["仁愛路"], signage: [], confidence: "high", source: "photo" }),
    };
    app = createApp({ routes: [route], store, interpreter, now: () => clock });
    const { path, confirmation } = await pending();
    const data = (await sharp({ create: { width: 320, height: 240, channels: 3, background: "#888" } }).jpeg().toBuffer()).toString("base64");
    const r = await (await post(path, { photo: { mimeType: "image/jpeg", data }, location: { zone: "renai_fuxing" } })).json();
    expect(r.session.checkpointId).toBe("cp2");
    expect(r.action.confirmation).toBeUndefined();
    expect((await post(path, { confirmation: { id: confirmation.id, answer: "confirm" } })).status).toBe(409);
  });

  it("rejects a confirmation when the session checkpoint changed", async () => {
    const { id, path, confirmation } = await pending();
    const record = (await store.get(id))!;
    await store.put(id, { ...record, session: { ...record.session, checkpointId: "cp3" } });
    expect((await post(path, { confirmation: { id: confirmation.id, answer: "confirm" } })).status).toBe(409);
  });

  it("round-trips pending evidence through the real Firestore adapter and withdraws it after use", async () => {
    const docs = new Map<string, Record<string, unknown>>();
    const collection: DocCollection = { doc: id => ({
      get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
      set: async data => { docs.set(id, structuredClone(data)); },
    }) };
    const persisted = new FirestoreSessionStore(collection, async operation => operation({
      get: async id => ({ exists: docs.has(id), data: () => docs.get(id) }),
      set: (id, data) => { docs.set(id, structuredClone(data)); },
    }));
    app = createApp({ routes: [route], store: persisted, interpreter: new KeywordInterpreter(), now: () => clock });
    const { id, path, confirmation } = await pending();
    expect((await persisted.get(id))?.pendingTextContinuation?.evidence).toEqual(["仁愛路"]);
    const response = await post(path, { confirmation: { id: confirmation.id, answer: "confirm" } });
    expect((await response.json()).session.checkpointId).toBe("cp3x");
    expect((await persisted.get(id))?.pendingTextContinuation).toBeUndefined();
    expect(docs.get(id)?.pendingTextContinuation).toBeUndefined();
  });

  it.each(["cancel", "new observation"])("cannot resurrect a delayed confirmation after %s has returned", async (withdrawal) => {
    let release!: () => void;
    let blocked!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { blocked = resolve; });
    class RacingStore extends InMemorySessionStore {
      armed = false;
      async pause() { this.armed = false; blocked(); await gate; }
      async put(id: string, value: SessionRecord) {
        if (this.armed && value.session.checkpointId === "cp3x") await this.pause();
        return super.put(id, value);
      }
      async update<T>(id: string, mutate: (current: SessionRecord) => { record: SessionRecord; value: T }): Promise<T | undefined> {
        if (this.armed) await this.pause();
        return super.update(id, mutate);
      }
    }
    const racing = new RacingStore();
    store = racing;
    app = createApp({ routes: [route], store, interpreter: new KeywordInterpreter(), now: () => clock });
    const { id, path, confirmation } = await pending();
    racing.armed = true;
    const late = post(path, { confirmation: { id: confirmation.id, answer: "confirm" } });
    await reached;
    const cleared = await post(path, withdrawal === "cancel"
      ? { confirmation: { id: confirmation.id, answer: "cancel" } } : { text: "我不確定" });
    expect(cleared.status).toBe(200);
    release();
    expect((await late).status).toBe(409);
    expect((await store.get(id))?.session.checkpointId).toBe("cp2");
  });

  it("never applies a delayed first-crossing done to the second crossing", async () => {
    let release!: () => void;
    let blocked!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { blocked = resolve; });
    class DelayedStore extends InMemorySessionStore {
      armed = false;
      async update<T>(id: string, mutate: (current: SessionRecord) => { record: SessionRecord; value: T }): Promise<T | undefined> {
        if (this.armed) { this.armed = false; blocked(); await gate; }
        return super.update(id, mutate);
      }
    }
    const delayed = new DelayedStore();
    store = delayed;
    app = createApp({ routes: [route], store, interpreter: new KeywordInterpreter(), now: () => clock });
    const { id, path } = await atCp2();
    await post(path, { text: "大安路一段116巷" });
    delayed.armed = true;
    const oldDone = post(path, { confirm: "done" });
    await reached;
    await post(path, { confirm: "done" });
    await post(path, { text: "仁愛路" });
    release();
    expect((await oldDone).status).toBe(409);
    expect((await store.get(id))?.session.checkpointId).toBe("cp3x");
  });
});
