import { describe, expect, it } from "vitest";
import { FirestoreSessionStore, InMemorySessionStore, type DocCollection, type SessionRecord,
  type SessionStore, type TransactionRunner } from "../src/store.js";

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

const pending = {
  kind: "renai-before-second-crossing" as const,
  id: "test-confirmation", expiresAt: 12345, evidence: ["仁愛路"],
};

// Emulates only the external transaction boundary: serialize operations and
// stage writes until a callback succeeds. Session normalization remains real.
function transactionalCollection(seed: Record<string, unknown> = {}) {
  const col = fakeCollection(seed);
  let tail = Promise.resolve();
  const runTransaction: TransactionRunner = <T>(operation: Parameters<TransactionRunner>[0]) => {
    const result = tail.then(async () => {
      const writes = new Map<string, Record<string, unknown>>();
      const value = await operation({
        get: async id => ({ exists: id in col.docs, data: () => structuredClone(col.docs[id]) }),
        set: (id, data) => { writes.set(id, structuredClone(data)); },
      });
      for (const [id, data] of writes) col.docs[id] = data;
      return value as T;
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
  return { col, runTransaction };
}

describe.each([
  ["in-memory", () => {
    const store = new InMemorySessionStore();
    return { writer: store, otherWriter: store };
  }],
  ["Firestore", () => {
    const { col, runTransaction } = transactionalCollection();
    return { writer: new FirestoreSessionStore(col, runTransaction), otherWriter: new FirestoreSessionStore(col, runTransaction) };
  }],
] as const)("%s atomic updates", (_name, setup) => {
  it("retains both overlapping photo allocations and returns distinct counts", async () => {
    const { writer, otherWriter } = setup();
    await writer.put("s1", record);
    const increment = (store: SessionStore) => store.update("s1", current => {
      const count = (current.photoCount ?? 0) + 1;
      return { record: { ...current, photoCount: count }, value: count };
    });
    expect(await Promise.all([increment(writer), increment(otherWriter)])).toEqual([1, 2]);
    expect((await writer.get("s1"))?.photoCount).toBe(2);
  });

  it("a concurrent confirmation sees a previously submitted cancellation", async () => {
    const { writer, otherWriter } = setup();
    await writer.put("s1", { ...record, pendingTextContinuation: pending });
    const cancel = writer.update("s1", current => {
      const { pendingTextContinuation: _pending, ...cleared } = current;
      return { record: cleared, value: "cancelled" };
    });
    const confirm = otherWriter.update("s1", current => {
      const accepted = current.pendingTextContinuation?.id === pending.id;
      return { record: accepted ? { ...current, session: { ...current.session, checkpointId: "cp3" } } : current, value: accepted };
    });
    expect(await Promise.all([cancel, confirm])).toEqual(["cancelled", false]);
    expect((await writer.get("s1"))?.session.checkpointId).toBe("cp2");
    expect((await writer.get("s1"))?.pendingTextContinuation).toBeUndefined();
  });

  it("does not invoke a mutator or create a missing session", async () => {
    const { writer } = setup();
    expect(await writer.update("missing", () => { throw Error("must not mutate missing session"); })).toBeUndefined();
    expect(await writer.get("missing")).toBeUndefined();
  });

  it("does not replace a record if its pure mutator throws", async () => {
    const { writer } = setup();
    await writer.put("s1", record);
    await expect(writer.update("s1", () => { throw Error("not accepted"); })).rejects.toThrow("not accepted");
    expect(await writer.get("s1")).toEqual(record);
  });
});

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

  it("refuses update when the transaction runner is not configured", async () => {
    const col = fakeCollection({ s1: record });
    const store = new FirestoreSessionStore(col);
    await expect(store.update("s1", current => ({ record: { ...current, photoCount: 1 }, value: true })))
      .rejects.toThrow(/transaction/i);
    expect(col.docs.s1).toEqual(record);
  });

  it("treats a malformed transactional document as missing", async () => {
    const { col, runTransaction } = transactionalCollection({ bad: { session: { state: "TELEPORTED" } } });
    const store = new FirestoreSessionStore(col, runTransaction);
    expect(await store.update("bad", () => { throw Error("must not mutate malformed session"); })).toBeUndefined();
    expect(col.docs.bad).toEqual({ session: { state: "TELEPORTED" } });
  });

  it("round-trips then removes pending continuation through transactional writes", async () => {
    const { col, runTransaction } = transactionalCollection();
    const store = new FirestoreSessionStore(col, runTransaction);
    await store.put("s1", record);
    expect(await store.update("s1", current => ({ record: { ...current, pendingTextContinuation: pending }, value: pending.id })))
      .toBe("test-confirmation");
    expect((await store.get("s1"))?.pendingTextContinuation).toEqual(pending);
    await store.update("s1", current => {
      const { pendingTextContinuation: _pending, ...cleared } = current;
      return { record: cleared, value: true };
    });
    expect((await store.get("s1"))?.pendingTextContinuation).toBeUndefined();
    expect(col.docs.s1).not.toHaveProperty("pendingTextContinuation");
    expect(col.docs.s1).toHaveProperty("expiresAt", expect.any(Date));
  });

  it("strips malformed pending continuation before invoking the mutator", async () => {
    const { col, runTransaction } = transactionalCollection({ s1: { ...record, pendingTextContinuation: { ...pending, evidence: [] } } });
    const store = new FirestoreSessionStore(col, runTransaction);
    expect(await store.update("s1", current => ({ record: current, value: current.pendingTextContinuation ?? "absent" })))
      .toBe("absent");
    expect(col.docs.s1).not.toHaveProperty("pendingTextContinuation");
  });

  it("returns the mutation from the successful transaction attempt after a retry", async () => {
    const col = fakeCollection({ s1: { ...record, photoCount: 0 } });
    const retry: TransactionRunner = async operation => {
      await operation({
        get: async () => ({ exists: true, data: () => ({ ...record, photoCount: 0 }) }),
        set: () => {}, // aborted attempt: concurrent writer won
      });
      return operation({
        get: async () => ({ exists: true, data: () => ({ ...record, photoCount: 5 }) }),
        set: (id, data) => { col.docs[id] = data; },
      });
    };
    const store = new FirestoreSessionStore(col, retry);
    expect(await store.update("s1", current => ({ record: { ...current, photoCount: current.photoCount! + 1 }, value: current.photoCount! + 1 })))
      .toBe(6);
    expect((await store.get("s1"))?.photoCount).toBe(6);
  });
});
