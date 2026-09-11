import { useEffect, useRef } from "react";

// Runs `fn` immediately, then every `ms` milliseconds.
// Safe to pass an inline closure — the ref keeps the latest one without
// restarting the interval (which would happen if fn were a dependency).
export function usePolling(fn: () => void | Promise<void>, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await ref.current();
      } catch {
        /* caller handles error state */
      }
    };
    tick();
    const id = setInterval(tick, ms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ms]);
}
