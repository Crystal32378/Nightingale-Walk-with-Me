/**
 * Cost gate for photo reading. Every photo is a paid Vertex call, and the API is
 * anonymous, so three limits stack:
 *
 * - per walk: a session can send only so many photos (stored with the session);
 * - per client: a sliding window keyed on the caller's address;
 * - per instance: a sliding window over all callers, which bounds spend even
 *   when the client key is forged. Cloud Run max instances multiplies it.
 *
 * The windows live in instance memory: they reset on restart and are not shared
 * between instances. That is deliberate — the bound we need is on spend, and
 * `perInstance × maxInstances` is that bound.
 */
export interface PhotoLimits {
  perSession: number;
  perClient: { max: number; windowMs: number };
  perInstance: { max: number; windowMs: number };
}

export const DEFAULT_PHOTO_LIMITS: PhotoLimits = {
  perSession: 8,
  perClient: { max: 10, windowMs: 10 * 60_000 },
  perInstance: { max: 12, windowMs: 60_000 },
};

export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit and returns 0, or returns the ms to wait and records nothing. */
  take(key: string): number {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return this.windowMs - (t - recent[0]!);
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return 0;
  }

  private prune(t: number): void {
    for (const [k, v] of this.hits) if (v.every((h) => t - h >= this.windowMs)) this.hits.delete(k);
  }
}

/** First hop of X-Forwarded-For (set by the Google front end), else a shared bucket. */
export function clientKey(forwardedFor: string | undefined): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length <= 64 ? first : "unknown";
}
