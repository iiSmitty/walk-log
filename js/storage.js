const STORAGE_KEY  = 'walklog_v3';
const WEEK_HISTORY = 8;

const STATE_NONE   = 'none';
const STATE_WALKED = 'walked';
const STATE_REST   = 'rest';

// ── Local cache ────────────────────────────────────────────────────────────

function cacheLoad() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function cacheSave(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── GitHub API ─────────────────────────────────────────────────────────────

const GH_API   = 'https://walk-log-sync.andrez-smit.workers.dev';

async function ghRead() {
    const res = await fetch(`${GH_API}`, { method: 'GET' });
    if (!res.ok) throw new Error(`Worker read failed: ${res.status}`);
    return await res.json();
}

async function ghWrite(data, sha) {
    const res = await fetch(`${GH_API}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, sha }),
    });
    if (!res.ok) throw new Error(`Worker write failed: ${res.status}`);
    const json = await res.json();
    return json.sha;
}

// ── Sync state (held in memory during session) ─────────────────────────────

let _sha          = null;
let _data         = null;
let _pendingSync  = false;

function hasPendingSync() { return _pendingSync; }

async function syncLoad() {
    if (!navigator.onLine) {
        _data = cacheLoad();
        return false;
    }
    try {
        const { data, sha } = await ghRead();
        _sha          = sha;
        _data         = data;
        _pendingSync  = false;
        cacheSave(data);
        return true;
    } catch (e) {
        console.warn('GitHub read failed, falling back to cache:', e);
        _data = cacheLoad();
        return false;
    }
}

async function syncSave() {
    if (!navigator.onLine) {
        _pendingSync = true;
        cacheSave(_data);
        return false;
    }
    try {
        _sha         = await ghWrite(_data, _sha);
        _pendingSync = false;
        cacheSave(_data);
        return true;
    } catch (e) {
        console.warn('GitHub write failed, saved to cache only:', e);
        _pendingSync = true;
        cacheSave(_data);
        return false;
    }
}

// Push local pending changes when back online (fetch SHA first, then write)
async function syncFlushPending() {
    if (!navigator.onLine) return false;
    try {
        const { sha } = await ghRead();
        _sha          = sha;
        _sha          = await ghWrite(_data, _sha);
        _pendingSync  = false;
        cacheSave(_data);
        return true;
    } catch (e) {
        console.warn('Flush pending failed:', e);
        return false;
    }
}

// ── Date helpers ───────────────────────────────────────────────────────────

function getMonday(d) {
    const date = new Date(d);
    const day  = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    date.setHours(0, 0, 0, 0);
    return date;
}

function weekKey(monday) {
    return monday.toISOString().slice(0, 10);
}

function migrateWeek(days) {
    return days.map(v => typeof v === 'boolean' ? (v ? STATE_WALKED : STATE_NONE) : v);
}

// ── State ──────────────────────────────────────────────────────────────────

function getState() {
    const data   = _data || cacheLoad();
    const monday = getMonday(new Date());
    const wk     = weekKey(monday);

    if (!data.weeks) data.weeks = {};
    if (!data.weeks[wk]) data.weeks[wk] = Array(7).fill(STATE_NONE);
    data.weeks[wk] = migrateWeek(data.weeks[wk]);

    const keys = Object.keys(data.weeks).sort();
    if (keys.length > WEEK_HISTORY) {
        keys.slice(0, keys.length - WEEK_HISTORY).forEach(k => delete data.weeks[k]);
    }

    _data = data;
    return { data, monday, wk };
}

// Tap cycles: none → walked → rest → none
async function cycleDay(dayIndex) {
    const { data, wk } = getState();
    const cur    = data.weeks[wk][dayIndex];
    const next   = cur === STATE_NONE    ? STATE_WALKED
        : cur === STATE_WALKED  ? STATE_REST
            :                        STATE_NONE;
    data.weeks[wk][dayIndex] = next;
    _data = data;
    const synced = await syncSave();
    return { state: next, synced };
}

function todayIndex() {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
}

// ── Stats ──────────────────────────────────────────────────────────────────

function calcStreak(data) {
    const weeks = Object.keys(data.weeks).sort().reverse();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let streak  = 0;
    for (const wk of weeks) {
        const mon  = new Date(wk + 'T00:00:00');
        const days = migrateWeek(data.weeks[wk]);
        for (let i = 6; i >= 0; i--) {
            const d = new Date(mon); d.setDate(d.getDate() + i);
            if (d > today) continue;
            if (days[i] === STATE_WALKED)     streak++;
            else if (days[i] === STATE_REST)  continue;
            else                              return streak;
        }
    }
    return streak;
}

function calcWeekPct(days) {
    const ti     = todayIndex();
    const slice  = days.slice(0, ti + 1);
    const active = slice.filter(s => s !== STATE_REST).length;
    const walked = slice.filter(s => s === STATE_WALKED).length;
    return active === 0 ? 0 : Math.round((walked / active) * 100);
}

function formatWeekRange(monday) {
    const end = new Date(monday); end.setDate(end.getDate() + 6);
    const f   = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${f(monday)} – ${f(end)}`;
}

function getPastWeeks(data, n = 4) {
    const currentWk = weekKey(getMonday(new Date()));
    return Object.keys(data.weeks)
        .sort()
        .filter(k => k !== currentWk)
        .slice(-n)
        .reverse()
        .map(k => ({
            key:    k,
            monday: new Date(k + 'T00:00:00'),
            days:   migrateWeek(data.weeks[k])
        }));
}