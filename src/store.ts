import type { EngineAction, SessionSnapshot } from "./types.js";

export interface SessionRecord {
  session: SessionSnapshot;
  lastAction: EngineAction;
}

/** Firestore later; same interface. */
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
