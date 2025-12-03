/*
 Global API and profile store for the game.
 Scenes can import this module to access token and cached profile across the app.
*/

export type DriverBuddyProfile = {
  _id: string;
  balance: number;
  buddy?: {
    level?: number;
    model_name?: string;
    upgrade_cost?: number;
    img_url?: string;
  };
  next_level_buddy?: {
    level?: number;
    model_name?: string;
    upgrade_cost?: number;
    img_url?: string;
  };
  can_upgrade?: boolean;
} | null;

const API_URL = 'https://apistg.ahamove.com/api/v3/private/driver-buddy';
const TOKEN_KEY = 'auth_token';
const DEBUG_KEY = 'debug_mode';

let _token: string | null = null;
let _profile: DriverBuddyProfile = null;
let _debug: boolean | undefined = undefined;
const listeners = new Set<(p: DriverBuddyProfile) => void>();

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

function cleanTokenFromUrl() {
  try {
    if (!isBrowser()) return;
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.has('token')) {
      url.searchParams.delete('token');
      changed = true;
    }
    if (url.searchParams.has('debug')) {
      url.searchParams.delete('debug');
      changed = true;
    }
    if (changed) {
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch {}
}

function notify() {
  for (const cb of Array.from(listeners)) {
    try { cb(_profile); } catch {}
  }
}

export function setToken(token: string | null) {
  _token = token && token.trim().length > 0 ? token : null;
  if (isBrowser()) {
    try {
      if (_token) localStorage.setItem(TOKEN_KEY, _token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
}

export function getToken(): string | null {
  if (_token) return _token;
  if (!isBrowser()) return null;
  try {
    const saved = localStorage.getItem(TOKEN_KEY);
    _token = saved && saved.length > 0 ? saved : null;
    return _token;
  } catch {
    return null;
  }
}

export function setDebug(on: boolean) {
  _debug = !!on;
  if (isBrowser()) {
    try {
      localStorage.setItem(DEBUG_KEY, _debug ? '1' : '0');
    } catch {}
  }
}

export function getDebug(): boolean {
  if (_debug !== undefined) return _debug;
  if (!isBrowser()) return false;
  try {
    const v = localStorage.getItem(DEBUG_KEY);
    _debug = v === '1' || v === 'true';
    return _debug;
  } catch {
    return false;
  }
}

export function isDebug(): boolean {
  return !!_debug;
}

export function initFromUrlOrStorage(): string | null {
  if (!isBrowser()) return null;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const debugParam = url.searchParams.get('debug');
    if (debugParam !== null) {
      const on = debugParam === '' || debugParam === '1' || debugParam.toLowerCase() === 'true';
      setDebug(on);
    } else {
      // load from storage when not present in URL
      const saved = getDebug();
      setDebug(saved);
    }
    if (token && token.trim().length > 0) {
      setToken(token);
    }
    // Clean URL of token/debug params always after processing
    cleanTokenFromUrl();

    // Return current token or from storage
    if (_token) return _token;
    return getToken();
  } catch {
    return getToken();
  }
}

export function getProfile(): DriverBuddyProfile {
  return _profile;
}

function buildCurl(opts: { method?: string; url: string; headers?: Record<string, string>; body?: any }) {
  const method = (opts.method || 'GET').toUpperCase();
  const parts: string[] = [
    `curl --location '${opts.url}'`,
    `--request ${method}`,
  ];
  const headers = opts.headers || {};
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`--header '${k}: ${v}'`);
  }
  if (opts.body !== undefined && opts.body !== null) {
    const bodyStr = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    parts.push(`--data '${bodyStr}'`);
  }
  return parts.join(' \\\n');
}

export async function fetchProfile(force = false): Promise<DriverBuddyProfile> {
  const token = getToken();
  if (!token) throw new Error('No token');
  if (_profile && !force) return _profile;

  const reqInit: RequestInit = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  if (isDebug()) {
    try {
      // Print the curl for debugging
      console.log(buildCurl({ url: API_URL, headers: reqInit.headers as Record<string, string> }));
    } catch {}
  }

  const res = await fetch(API_URL, reqInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  _profile = await res.json();
  notify();
  return _profile;
}

export function subscribe(cb: (p: DriverBuddyProfile) => void) {
  listeners.add(cb);
  // return unsubscribe
  return () => listeners.delete(cb);
}

export default {
  initFromUrlOrStorage,
  getToken,
  setToken,
  fetchProfile,
  getProfile,
  subscribe,
};
