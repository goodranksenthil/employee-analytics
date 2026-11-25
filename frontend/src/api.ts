import { useCallback, useEffect, useState } from "react";

// Local dev: empty → Vite proxies /api. Vercel: VITE_API_BASE_URL = Render URL (no trailing slash).
const BASE = `${((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "")}/api`;

// Set by the auth provider: the signed-in user's token, and what to do when it expires.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

// The hosted API (Render free plan) sleeps after ~15 idle minutes and takes up to a minute to
// wake. While it wakes, the proxy answers 502/503 without CORS headers, which the browser
// reports as "Failed to fetch". So: wait for /health to answer, then retry the request once.
const WAKE_TIMEOUT_MS = 90_000;
const GATEWAY_ERRORS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let waking: Promise<boolean> | null = null;

async function healthOk(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Resolves true once the API answers /health (shared by concurrent callers), false on timeout. */
export function wakeServer(): Promise<boolean> {
  if (!waking) {
    waking = (async () => {
      const deadline = Date.now() + WAKE_TIMEOUT_MS;
      for (let delay = 1000; Date.now() < deadline; delay = Math.min(delay * 2, 8000)) {
        if (await healthOk()) return true;
        await sleep(delay);
      }
      return false;
    })().finally(() => {
      waking = null;
    });
  }
  return waking;
}

// Keep the hosted API awake while someone has the app open and visible.
const HEARTBEAT_MS = 4 * 60_000;
if (typeof window !== "undefined") {
  void healthOk(); // start waking it as soon as the app loads (e.g. on the login page)
  setInterval(() => {
    if (document.visibilityState === "visible") void healthOk();
  }, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void healthOk();
  });
}

const UNREACHABLE =
  "Can't reach the server. It may be starting up; please try again in a minute.";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const send = () => fetch(`${BASE}${path}`, { ...init, headers });

  let res: Response;
  try {
    res = await send();
    if (GATEWAY_ERRORS.has(res.status)) throw new Error("gateway");
  } catch {
    // Network failure or a sleeping server: wait for it to wake, then try once more.
    if (!(await wakeServer())) throw new Error(UNREACHABLE);
    try {
      res = await send();
    } catch {
      throw new Error(UNREACHABLE);
    }
  }
  if (res.status === 401 && authToken && !path.startsWith("/auth/login")) onUnauthorized?.();
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(load, [load]);
  return { data, loading, error, reload: load };
}

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });

export const compactUsd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : usd(n);
