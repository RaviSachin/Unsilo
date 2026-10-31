import { useCallback, useEffect, useRef, useState } from 'react'

export class ApiError extends Error {}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  } catch {
    throw new ApiError('Backend not reachable. Is uvicorn running on port 8000?')
  }
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail
    throw new ApiError(typeof detail === 'string' ? detail : `${res.status} ${res.statusText}`)
  }
  return data as T
}

export const post = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

// Tiny stale-while-revalidate cache: pages show the last data instantly, then refresh in the background.
const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<() => void>>()

function load<T>(path: string): Promise<T> {
  let p = inflight.get(path) as Promise<T> | undefined
  if (!p) {
    p = api<T>(path).then((d) => {
      cache.set(path, d)
      listeners.get(path)?.forEach((fn) => fn())
      return d
    })
    inflight.set(path, p)
    p.finally(() => inflight.delete(path)).catch(() => undefined)
  }
  return p
}

/** Re-fetch every subscriber of a path (or of every path starting with it). */
export function invalidate(prefix: string) {
  for (const key of new Set([...cache.keys(), ...listeners.keys()])) {
    if (key.startsWith(prefix)) load(key).catch(() => undefined)
  }
}

export function useApi<T>(path: string | null, refreshMs?: number) {
  const [data, setData] = useState<T | undefined>(() => (path ? (cache.get(path) as T | undefined) : undefined))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!!path && !cache.has(path))
  const alive = useRef(true)

  const refresh = useCallback(() => {
    if (!path) return Promise.resolve()
    setLoading(!cache.has(path))
    return load<T>(path)
      .then((d) => alive.current && (setData(d), setError(null)))
      .catch((e: Error) => alive.current && setError(e.message))
      .finally(() => alive.current && setLoading(false))
  }, [path])

  useEffect(() => {
    alive.current = true
    if (!path) return
    setData(cache.get(path) as T | undefined)
    const set = listeners.get(path) ?? new Set()
    const onChange = () => alive.current && setData(cache.get(path) as T)
    set.add(onChange)
    listeners.set(path, set)
    refresh()
    const timer = refreshMs ? window.setInterval(refresh, refreshMs) : undefined
    return () => {
      alive.current = false
      set.delete(onChange)
      if (timer) window.clearInterval(timer)
    }
  }, [path, refresh, refreshMs])

  return { data, error, loading, refresh }
}
