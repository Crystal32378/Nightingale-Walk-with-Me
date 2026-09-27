import type { EngineAction, SessionSnapshot } from "./types.js";

export interface SessionRecord {
  session: SessionSnapshot;
  lastAction: EngineAction;
  /** Photos this walk has sent to the reader; absent means none. */
  photoCount?: number;
}

/** In-memory for tests and local runs; Firestore in production. */
export interface SessionStore {
  get(id: string): Promise<SessionRecord | undefined>;
  put(id: string, record: SessionRecord): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();

  async get(id: string): Promise<SessionRecord | undefined> {
    return this.records.get(id);
  }

  async put(id: string, record: SessionRecord): Promise<void> {
    this.records.set(id, record);
  }
}

/** The slice of a Firestore collection this store needs — lets tests use a fake. */
export interface DocCollection {
  doc(id: string): {
    get(): Promise<{ exists: boolean; data(): unknown }>;
    set(data: Record<string, unknown>): Promise<unknown>;
  };
}

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

/**
 * Sessions survive instance restarts and scale-out: a walk that starts on one
 * Cloud Run instance can continue on another. A stored document that does not
 * look like a session is treated as missing — the engine never resumes from a
 * state it cannot vouch for.
 */
export class FirestoreSessionStore implements SessionStore {
  constructor(private readonly collection: DocCollection) {}

  async get(id: string): Promise<SessionRecord | undefined> {
    const snap = await this.collection.doc(id).get();
    if (!snap.exists) return undefined;
    const data = snap.data();
    if (!isRecord(data)) return undefined;
    const { session, lastAction, photoCount } = data;
    return typeof photoCount === "number" ? { session, lastAction, photoCount } : { session, lastAction };
  }

  async put(id: string, record: SessionRecord): Promise<void> {
    await this.collection.doc(id).set({
      session: record.session,
      lastAction: record.lastAction,
      ...(record.photoCount !== undefined ? { photoCount: record.photoCount } : {}),
      updatedAt: new Date(),
      // Firestore TTL policy on this field removes abandoned walks after a day.
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }
}
