'use client';
import { useCallback, useEffect, useState } from 'react';
export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const form = body instanceof FormData;
  const res = await fetch('/api/' + path, {
    method,
    headers: body && !form ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401 && path !== 'auth/login') window.location.replace('/giris');
    throw new Error(data.error || 'İşlem tamamlanamadı.');
  }
  return data as T;
}
export function useResource<T>(path: string) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    api<T>(path)
      .then((v) => {
        if (live) {
          setData(v);
          setError('');
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, revision]);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  return { data, error, loading, refresh };
}
export type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
