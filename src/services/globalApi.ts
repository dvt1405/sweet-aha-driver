/*
 Global API and profile store for the game.
 Scenes can import this module to access token and cached profile across the app.
*/

import {ApiError} from "next/dist/server/api-utils";

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

export const HOST = "https://apiuat.ahamove.com"
const API_URL = `${HOST}/api/v3/private/driver-buddy`;
// Supplier Profile API
export const SUPPLIER_API_URL = `${HOST}/api/v3/private/supplier/profile`;

const TOKEN_KEY = 'auth_token';
const DEBUG_KEY = 'debug_mode';
const PROFILE_STORAGE_KEY = 'cached_profile';

let _token: string | null = null;
let _profile: DriverBuddyProfile = null;
let _debug: boolean | undefined = undefined;
let _lastFetchTime: number = 0; // timestamp of last profile fetch
const PROFILE_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const listeners = new Set<(p: DriverBuddyProfile) => void>();

/**
 * Save profile to localStorage for offline/error fallback
 */
function saveProfileToStorage(profile: DriverBuddyProfile) {
    if (!isBrowser() || !profile) return;
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
    }
}

/**
 * Load profile from localStorage
 */
function loadProfileFromStorage(): DriverBuddyProfile {
    if (!isBrowser()) return null;
    try {
        const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved) as DriverBuddyProfile;
        }
    } catch {
    }
    return null;
}

/**
 * Get cached profile from localStorage (for use before API call or on error)
 */
export function getCachedProfile(): DriverBuddyProfile {
    // First check in-memory cache
    if (_profile) return _profile;
    // Then check localStorage
    return loadProfileFromStorage();
}

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
    } catch {
    }
}

function notify() {
    for (const cb of Array.from(listeners)) {
        try {
            cb(_profile);
        } catch {
        }
    }
}

export function setToken(token: string | null) {
    _token = token && token.trim().length > 0 ? token : null;
    if (isBrowser()) {
        try {
            if (_token) localStorage.setItem(TOKEN_KEY, _token);
            else localStorage.removeItem(TOKEN_KEY);
        } catch {
        }
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
        } catch {
        }
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
            console.log(buildCurl({url: API_URL, headers: reqInit.headers as Record<string, string>}));
        } catch {
        }
    }

    const res = await fetch(API_URL, reqInit);
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    _profile = await res.json();
    _lastFetchTime = Date.now();
    // Save to localStorage for offline/error fallback
    saveProfileToStorage(_profile);
    notify();
    return _profile;
}

/**
 * Fetch profile only if cache is stale (older than 5 minutes).
 * Returns cached profile if still fresh, otherwise fetches new data.
 */
export async function fetchProfileIfStale(): Promise<DriverBuddyProfile> {
    const now = Date.now();
    const isStale = !_profile || (now - _lastFetchTime) > PROFILE_CACHE_DURATION_MS;
    if (isStale) {
        return fetchProfile(true);
    }
    return _profile;
}

export function subscribe(cb: (p: DriverBuddyProfile) => void) {
    listeners.add(cb);
    // return unsubscribe
    return () => listeners.delete(cb);
}

export type RewardClaimResponse = {
    bonus_type: string;
    bonus_amount: number;
    new_balance: number;
    claim_time: number; // epoch seconds
};

export async function claimDailyCheckin(body?: {
    bonus_type?: string;
    bonus_amount?: number;
    claim_time?: number
}): Promise<RewardClaimResponse> {
    const token = getToken();
    if (!token) throw new Error('No token');
    const url = `${API_URL}/rewards?type=DAILY_CHECKIN`;
    const payload = {
        bonus_type: 'DAILY_CHECKIN',
        bonus_amount: 10,
        claim_time: Math.floor(Date.now() / 1000),
        ...(body || {}),
    };
    const reqInit: RequestInit = {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    };

    if (isDebug()) {
        try {
            console.log(
                buildCurl({method: 'POST', url, headers: reqInit.headers as Record<string, string>, body: payload})
            );
        } catch {
        }
    }

    const res = await fetch(url, reqInit);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ApiError(res.status, `Claim failed: HTTP ${res.status}${text ? ` - ${text}` : ''}`);
    }

    const data = (await res.json()) as RewardClaimResponse;
    // update local cache if new_balance present
    try {
        if (_profile && typeof data?.new_balance === 'number') {
            _profile = {..._profile, balance: data.new_balance} as DriverBuddyProfile;
            notify();
        }
    } catch {
    }
    return data;
}

export type CoinTransaction = {
    _id: string;
    transaction_type: string;
    amount: number;
    current_balance?: number;
    new_balance?: number;
    metadata?: { bonus_type?: string; description?: string };
    create_time: number; // epoch seconds
};

export type CoinHistoryListItem = { title: string; date: string; amount: number };

/**
 * Fetch raw transactions of driver-buddy.
 */
export async function fetchCoinTransactions(): Promise<CoinTransaction[]> {
    const token = getToken();
    if (!token) throw new Error('No token');
    const url = `${API_URL}/transactions`;
    const reqInit: RequestInit = {
        headers: {Authorization: `Bearer ${token}`},
    };
    if (isDebug()) {
        try {
            console.log(buildCurl({url, headers: reqInit.headers as Record<string, string>}));
        } catch {
        }
    }
    const res = await fetch(url, reqInit);
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    return await res.json();
}

/**
 * Convenience helper returning mapped items for UI popup list.
 */
export async function fetchCoinHistoryItems(): Promise<CoinHistoryListItem[]> {
    const raw = await fetchCoinTransactions();
    const fmt = (ts: number) => {
        try {
            const d = new Date((ts || 0) * 1000);
            const dd = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            return dd;
        } catch {
            return '';
        }
    };
    const mapTitle = (t?: string, bonus?: string, desc?: string) => {
        if (desc && desc.trim().length) return desc;
        switch (t) {
            case 'DAILY_BONUS':
                if (bonus === 'DAILY_CHECKIN') return 'Điểm danh mỗi ngày';
                return 'Thưởng hằng ngày';
            case 'ORDER_COMPLETED':
                return 'Hoàn thành đơn';
            case 'UPGRADE_BUDDY':
            case 'UPGRADE':
                return 'Nâng cấp xe';
            case 'SHARE_SOCIAL':
                return 'Chia sẻ mạng xã hội';
            default:
                return 'Giao dịch';
        }
    };
    return raw.map((r) => ({
        title: mapTitle(r.transaction_type, r.metadata?.bonus_type, r.metadata?.description),
        date: fmt(r.create_time),
        amount: r.amount,
    }));
}

export type UpgradeBuddyResponse = {
    new_level: number;
    upgrade_cost: number;
    new_balance: number;
    is_max_level: boolean;
};

/**
 * Upgrade driver buddy level.
 * PATCH /level
 */
export async function upgradeBuddyLevel(): Promise<UpgradeBuddyResponse> {
    const token = getToken();
    if (!token) throw new Error('No token');
    const url = `${API_URL}/level`;
    const reqInit: RequestInit = {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
    if (isDebug()) {
        try {
            console.log(buildCurl({method: 'PATCH', url, headers: reqInit.headers as Record<string, string>}));
        } catch {
        }
    }
    const res = await fetch(url, reqInit);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ApiError(res.status, `Upgrade failed: HTTP ${res.status}${text ? ` - ${text}` : ''}`);
    }
    const data = await res.json() as UpgradeBuddyResponse;
    // Update cached profile balance optimistically if returned
    try {
        if (_profile && typeof data?.new_balance === 'number') {
            _profile = {..._profile, balance: data.new_balance} as DriverBuddyProfile;
            notify();
        }
    } catch {
    }
    return data;
}

export type SupplierProfile = {
    _id?: string;
    name?: string;
    mobile?: string;
    avatar?: string;
    files: {
        avatar?: {
            size128?: string;
            origin?: string;
        };
    };
} | null;

// Raw API response structure
type SupplierProfileResponse = {
    supplier?: {
        _id?: string;
        name?: string;
        mobile?: string;
        avatar?: string;
    };
};

let _supplierProfile: SupplierProfile = null;

/**
 * Fetch supplier profile to get driver name and avatar.
 * GET /api/v3/private/supplier/profile?token={token}
 */
export async function fetchSupplierProfile(force: boolean = false): Promise<SupplierProfile> {
    if (!force && _supplierProfile) return _supplierProfile;
    const token = getToken();
    if (!token) throw new Error('No token');
    const url = `${SUPPLIER_API_URL}?token=${token}`;
    const reqInit: RequestInit = {
        method: 'GET',
    };
    if (isDebug()) {
        try {
            console.log(buildCurl({url}));
        } catch {
        }
    }
    const res = await fetch(url, reqInit);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ApiError(res.status, `Supplier profile failed: HTTP ${res.status}${text ? ` - ${text}` : ''}`);
    }
    const data = await res.json() as SupplierProfileResponse;
    // Extract the nested supplier object from the response
    _supplierProfile = data?.supplier ?? null;
    return _supplierProfile;
}

export function getSupplierProfile(): SupplierProfile {
    return _supplierProfile;
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
    initFromUrlOrStorage,
    getToken,
    setToken,
    fetchProfile,
    fetchProfileIfStale,
    getProfile,
    subscribe,
    claimDailyCheckin,
    fetchCoinTransactions,
    fetchCoinHistoryItems,
    upgradeBuddyLevel,
    fetchSupplierProfile,
    getSupplierProfile,
};
