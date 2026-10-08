import type { EngineAction, PendingTextContinuation, SessionSnapshot } from "./types.js";

export interface SessionRecord {
  session: SessionSnapshot;
  lastAction: EngineAction;
  /** Photos this walk has sent to the reader; absent means none. */
  photoCount?: number;
  /** Numeric cost counter only; no audio or unconfirmed transcript is stored. */
  audioCount?: number;
  pendingTextContinuation?: PendingTextContinuation;
}

export function isPendingTextContinuation(v: unknown): v is PendingTextContinuation {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return p.kind === "renai-before-second-crossing" && typeof p.id === "string" && p.id.length > 0 && p.id.length <= 80
    && typeof p.expiresAt === "number" && Number.isFinite(p.expiresAt)
    && Array.isArray(p.evidence) && p.evidence.length > 0 && p.evidence.length <= 10
    && p.evidence.every(x => typeof x === "string" && x.length > 0 && x.length <= 80);
}

/** In-memory for tests and local runs; Firestore in production. */
export interface SessionStore {
  get(id: string): Promise<SessionRecord | undefined>;
  put(id: string, record: SessionRecord): Promise<void>;
  /** Atomically replaces an existing record. The synchronous mutator must be pure:
   * Firestore can retry it. Do not perform I/O or mutate the supplied record. */
  update<T>(id: string, mutate: (current: SessionRecord) => { record: SessionRecord; value: T }): Promise<T | undefined>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();

  async get(id: string): Promise<SessionRecord | undefined> {
    return this.records.get(id);
  }

  async put(id: string, record: SessionRecord): Promise<void> {
    this.records.set(id, record);
  }

  async update<T>(id: string, mutate: (current: SessionRecord) => { record: SessionRecord; value: T }): Promise<T | undefined> {
    // No await between read and replacement: concurrent requests cannot share
    // an obsolete snapshot during this synchronous critical section.
    const current = this.records.get(id);
    if (!current) return undefined;
    const { record, value } = mutate(current);
    this.records.set(id, record);
    return value;
  }
}

/** The slice of a Firestore collection this store needs — lets tests use a fake. */
export interface DocCollection {
  doc(id: string): {
    get(): Promise<{ exists: boolean; data(): unknown }>;
    set(data: Record<string, unknown>): Promise<unknown>;
  };
}

export interface DocTransaction {
  get(id: string): Promise<{ exists: boolean; data(): unknown }>;
  set(id: string, data: Record<string, unknown>): void;
}

export type TransactionRunner = <T>(operation: (transaction: DocTransaction) => Promise<T>) => Promise<T>;

const SESSION_STATES = new Set(["AT_CHECKPOINT", "AMBIGUOUS", "RECOVERING", "ARRIVED"]);

function isRecord(v: unknown): v is SessionRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  const s = r.session as Record<string, unknown> | undefined;
  const a = r.lastAction as Record<string, unknown> | undefined;
  return (
    typeof s?.routeId === "string" &&
    typeof s.state === "string" &&
    SESSION_STATES.has(s.state) &&
    typeof s.checkpointId === "string" &&
    typeof s.questionCount === "number" &&
    typeof a?.type === "string" &&
    typeof a.checkpointId === "string"
  );
}

function readRecord(data: unknown): SessionRecord | undefined {
  if (!isRecord(data)) return undefined;
  const { session, lastAction, photoCount, audioCount, pendingTextContinuation } = data;
  return { session, lastAction,
    ...(typeof photoCount === "number" ? { photoCount } : {}),
    ...(typeof audioCount === "number" ? { audioCount } : {}),
    ...(isPendingTextContinuation(pendingTextContinuation) ? { pendingTextContinuation } : {}),
  };
}

function writeRecord(record: SessionRecord): Record<string, unknown> {
  return {
    session: record.session,
    lastAction: record.lastAction,
    ...(record.photoCount !== undefined ? { photoCount: record.photoCount } : {}),
    ...(record.audioCount !== undefined ? { audioCount: record.audioCount } : {}),
    ...(record.pendingTextContinuation ? { pendingTextContinuation: record.pendingTextContinuation } : {}),
    updatedAt: new Date(),
    // Firestore TTL policy on this field removes abandoned walks after a day.
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

/**
 * Sessions survive instance restarts and scale-out: a walk that starts on one
 * Cloud Run instance can continue on another. A stored document that does not
 * look like a session is treated as missing — the engine never resumes from a
 * state it cannot vouch for.
 */
export class FirestoreSessionStore implements SessionStore {
  constructor(private readonly collection: DocCollection, private readonly runTransaction?: TransactionRunner) {}

  async update<T>(id: string, mutate: (current: SessionRecord) => { record: SessionRecord; value: T }): Promise<T | undefined> {
    if (!this.runTransaction) throw new Error("Firestore transaction runner is not configured");
    return this.runTransaction(async transaction => {
      const snap = await transaction.get(id);
      const current = snap.exists ? readRecord(snap.data()) : undefined;
      if (!current) return undefined;
      const { record, value } = mutate(current);
      transaction.set(id, writeRecord(record));
      return value;
    });
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    const snap = await this.collection.doc(id).get();
    if (!snap.exists) return undefined;
    return readRecord(snap.data());
  }

  async put(id: string, record: SessionRecord): Promise<void> {
    await this.collection.doc(id).set(writeRecord(record));
  }
}
