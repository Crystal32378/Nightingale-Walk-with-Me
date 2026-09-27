import { describe, expect, it } from "vitest";
import { FirestoreSessionStore, type DocCollection, type SessionRecord } from "../src/store.js";

function fakeCollection(seed: Record<string, unknown> = {}): DocCollection & { docs: Record<string, unknown> } {
  const docs: Record<string, unknown> = { ...seed };
  return {
    docs,
    doc: (id: string) => ({
      get: async () => ({ exists: id in docs, data: () => docs[id] }),
      set: async (data: Record<string, unknown>) => { docs[id] = data; },
    }),
  };
}

const record: SessionRecord = {
  session: { routeId: "renai-001", state: "AT_CHECKPOINT", checkpointId: "cp2", questionCount: 0 },
  lastAction: { type: "GUIDE", checkpointId: "cp1", instruction: "walk on" },
};

describe("FirestoreSessionStore", () => {
  it("round-trips a session and stamps an expiry for the TTL policy", async () => {
    const col = fakeCollection();
    const store = new FirestoreSessionStore(col);
    await store.put("s1", record);
    expect(await store.get("s1")).toEqual(record);
    const raw = col.docs.s1 as Record<string, unknown>;
    expect(raw.expiresAt).toBeInstanceOf(Date);
  });

  it("returns undefined for a missing session", async () => {
    expect(await new FirestoreSessionStore(fakeCollection()).get("nope")).toBeUndefined();
  });

  it("treats a malformed stored document as missing", async () => {
    const store = new FirestoreSessionStore(
      fakeCollection({ bad: { session: { state: "TELEPORTED" }, lastAction: {} } }),
    );
    expect(await store.get("bad")).toBeUndefined();
  });
});
