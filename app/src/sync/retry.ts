// Exponential backoff with jitter: 1s, 2s, 4s, 8s ... capped at 60s.
export function backoffMs(attempts: number): number {
  const base = Math.min(60_000, 1_000 * 2 ** attempts);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}
