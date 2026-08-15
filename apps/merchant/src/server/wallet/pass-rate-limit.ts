/**
 * In-process sliding-window rate limiter for the PassKit web service (spec 0033).
 *
 * Keyed by the pass **serial** (or device library id), NOT by IP: consumers sit
 * behind carrier NAT and the fetches are fired by iOS itself, so an IP key would
 * punish innocents and fight the OS polling (decision of 0033, coherent with 0028).
 * This limit is **anti-DoS, not authorization** — the endpoints only return the pass
 * the bearer already holds. It is per-instance/best-effort: on a multi-instance
 * deploy each process keeps its own window; that is acceptable for a DoS guard.
 *
 * The clock and the store are injectable so it is deterministically unit-testable.
 */
export interface RateLimiter {
  /** Records a hit for `key` and returns true when it is within the limit. */
  check(key: string, now?: number): boolean;
}

export function createSlidingWindowLimiter(opts: {
  max: number;
  windowMs: number;
  store?: Map<string, number[]>;
}): RateLimiter {
  const store = opts.store ?? new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()): boolean {
      const since = now - opts.windowMs;
      const hits = (store.get(key) ?? []).filter((t) => t > since);
      hits.push(now);
      store.set(key, hits);
      return hits.length <= opts.max;
    },
  };
}

/** Max PassKit requests per serial within the window before a `429`. */
export const PASS_RATE_LIMIT_MAX = Number(
  process.env.WALLET_PASSKIT_RATE_MAX ?? 60,
);
/** Trailing window for the PassKit rate limit, in ms (default 1 minute). */
export const PASS_RATE_LIMIT_WINDOW_MS = Number(
  process.env.WALLET_PASSKIT_RATE_WINDOW_MS ?? 60_000,
);

// Process-wide limiter shared by the PassKit routes.
export const passKitLimiter = createSlidingWindowLimiter({
  max: PASS_RATE_LIMIT_MAX,
  windowMs: PASS_RATE_LIMIT_WINDOW_MS,
});
