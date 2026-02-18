import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Poll a fetch function at a given interval.
 * Automatically stops when `enabled` is false.
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doFetch = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    doFetch();

    timerRef.current = setInterval(doFetch, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [doFetch, intervalMs, enabled]);

  const refresh = useCallback(() => {
    setLoading(true);
    doFetch();
  }, [doFetch]);

  return { data, error, loading, refresh };
}
