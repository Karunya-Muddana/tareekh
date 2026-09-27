"use client";

// A small stale-while-revalidate cache for backend reads.
// - Screens draw at once from the last known data (kept in memory, and in localStorage for `persist` keys),
//   then refresh in the background.
// - Identical requests in flight are shared, so the sidebar, Today and a chat never fetch /health three times.
// - Data refreshes when the tab comes back into view.

import { useCallback, useEffect, useSyncExternalStore } from "react";

type Entry = { data?: unknown; error?: Error; at: number; promise?: Promise<unknown> };

const store = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const STORAGE_PREFIX = "tareekh:c1:";

const emit = (key: string) => listeners.get(key)?.forEach((l) => l());

function read(key: string, persist: boolean): Entry | undefined {
  let e = store.get(key);
  if (!e && persist && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      // at: 0 marks it stale, so it shows immediately and refreshes right away
      if (raw) store.set(key, (e = { data: JSON.parse(raw), at: 0 }));
    } catch {}
  }
  return e;
}

function write(key: string, data: unknown, persist: boolean) {
  const prev = store.get(key);
  store.set(key, { data, at: Date.now(), promise: prev?.promise });
  if (persist) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    } catch {}
  }
  emit(key);
}

export type CacheOpts = { maxAge?: number; persist?: boolean };

/** Fetch through the cache: returns fresh data without a request, otherwise one shared request. */
export function load<T>(key: string, fetcher: () => Promise<T>, { maxAge = 30_000, persist = false }: CacheOpts = {}): Promise<T> {
  const e = read(key, persist);
  if (e?.promise) return e.promise as Promise<T>;
  if (e && "data" in e && e.data !== undefined && Date.now() - e.at < maxAge) return Promise.resolve(e.data as T);
  const promise = fetcher()
    .then((data) => {
      write(key, data, persist);
      return data;
    })
    .catch((error: Error) => {
      const cur = store.get(key);
      store.set(key, { ...cur, error, at: cur?.at ?? 0, promise: undefined });
      emit(key);
      throw error;
    })
    .finally(() => {
      const cur = store.get(key);
      if (cur?.promise === promise) store.set(key, { ...cur, promise: undefined });
    });
  store.set(key, { ...(e ?? { at: 0 }), promise, error: undefined });
  return promise;
}

/** Warm the cache ahead of navigation (e.g. on hover). */
export const prefetch = <T>(key: string, fetcher: () => Promise<T>, opts?: CacheOpts) => load(key, fetcher, opts).catch(() => {});

/** Replace or update cached data locally (optimistic updates). */
export function mutate<T>(key: string, next: T | ((cur: T | undefined) => T), persist = false) {
  const cur = store.get(key)?.data as T | undefined;
  write(key, typeof next === "function" ? (next as (c: T | undefined) => T)(cur) : next, persist);
}

/** Mark keys stale; mounted screens refetch on their next render. */
export function invalidate(prefix: string) {
  for (const [k, e] of store) {
    if (k.startsWith(prefix)) {
      store.set(k, { ...e, at: 0 });
      emit(k);
    }
  }
}

export function forget(key: string) {
  store.delete(key);
}

export function useCached<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  { maxAge = 30_000, persist = false, refreshInterval }: CacheOpts & { refreshInterval?: number } = {},
) {
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!key) return () => {};
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(cb);
      return () => set!.delete(cb);
    },
    [key],
  );
  // The server never has cached data; the client snapshot takes over right after hydration.
  const entry = useSyncExternalStore(subscribe, () => (key ? read(key, persist) : undefined), () => undefined);

  const revalidate = useCallback(
    (force = false) => {
      if (!key) return Promise.resolve(undefined);
      if (force) invalidate(key);
      return load(key, fetcher, { maxAge, persist }).catch(() => undefined);
    },
    // fetcher is intentionally not a dependency: callers pass inline arrows keyed by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, maxAge, persist],
  );

  const stale = !entry || Date.now() - entry.at >= maxAge;
  useEffect(() => {
    if (stale && !entry?.promise) revalidate();
  }, [stale, entry?.promise, revalidate]);

  useEffect(() => {
    if (!key) return;
    const onVisible = () => document.visibilityState === "visible" && revalidate();
    document.addEventListener("visibilitychange", onVisible);
    let t: ReturnType<typeof setInterval> | undefined;
    if (refreshInterval) t = setInterval(() => document.visibilityState === "visible" && revalidate(true), refreshInterval);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (t) clearInterval(t);
    };
  }, [key, refreshInterval, revalidate]);

  return {
    data: entry?.data as T | undefined,
    error: entry?.data === undefined ? entry?.error : undefined,
    loading: entry?.data === undefined && !entry?.error,
    reload: () => revalidate(true),
  };
}
