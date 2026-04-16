const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Loading state ──────────────────────────────────────────────────────────

function setLoading(on) {
    document.getElementById('weekCard').classList.toggle('loading', on);
}

// state: 'syncing' | 'synced' | 'offline'
function setSync(state) {
    const el = document.getElementById('syncIndicator');
    el.classList.remove('show', 'offline');
    clearTimeout(el._hideTimer);
    if (state === 'syncing') {
        el.textContent = 'syncing…';
        el.classList.add('show');
    } else if (state === 'synced') {
        el.textContent = 'synced ✓';
        el.classList.add('show');
        el._hideTimer = setTimeout(() => el.classList.remove('show'), 2000);
    } else if (state === 'offline') {
        el.textContent = 'offline';
        el.classList.add('show', 'offline');
        // stays visible until synced
    }
}

// ── Stats ──────────────────────────────────────────────────────────────────

function renderStats(data, days) {
    const streak = calcStreak(data);
    const pct    = calcWeekPct(days);
    document.getElementById('statStreak').innerHTML = `${streak}<span class="stat-suffix">d</span>`;
    document.getElementById('statPct').innerHTML    = `${pct}<span class="stat-suffix">%</span>`;
}

// ── Day grid ───────────────────────────────────────────────────────────────

function renderGrid(days, monday, animateIdx = null) {
    const grid  = document.getElementById('daysGrid');
    grid.innerHTML = '';

    const ti    = todayIndex();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    DAYS.forEach((name, i) => {
        const date   = new Date(monday); date.setDate(date.getDate() + i);
        const future = date > today;
        const state  = days[i];

        const cell = document.createElement('div');
        cell.className = 'day-cell';

        const label = document.createElement('div');
        label.className = 'day-name';
        label.textContent = name;

        const btn = document.createElement('button');
        const classes = ['day-btn'];
        if (state === STATE_WALKED) classes.push('walked');
        if (state === STATE_REST)   classes.push('rest');
        if (i === ti)               classes.push('today');
        if (future)                 classes.push('future');
        if (i === animateIdx)       classes.push('pop');
        btn.className = classes.join(' ');
        btn.disabled  = future;

        if (!future) btn.addEventListener('click', () => onDayTap(i));

        cell.appendChild(label);
        cell.appendChild(btn);
        grid.appendChild(cell);
    });
}

// ── Week complete glow ─────────────────────────────────────────────────────

function renderWeekComplete(days) {
    const ti    = todayIndex();
    const card  = document.getElementById('weekCard');
    const msg   = document.getElementById('doneMsg');
    const slice = days.slice(0, ti + 1);

    const allAccountedFor = slice.every(s => s === STATE_WALKED || s === STATE_REST);
    const anyWalked       = slice.some(s => s === STATE_WALKED);
    const complete        = allAccountedFor && anyWalked && ti >= 4;

    msg.classList.toggle('show', complete);
    if (complete && !card.classList.contains('glow')) {
        card.classList.add('glow');
        setTimeout(() => card.classList.remove('glow'), 2000);
    }
}

// ── History panel ──────────────────────────────────────────────────────────

function renderHistory() {
    const { data } = getState();
    const past     = getPastWeeks(data, 4);
    const list     = document.getElementById('historyList');
    list.innerHTML = '';

    if (past.length === 0) {
        list.innerHTML = '<div class="history-empty">No past weeks yet — keep walking!</div>';
        return;
    }

    past.forEach(({ monday, days }) => {
        const walked = days.filter(s => s === STATE_WALKED).length;
        const rest   = days.filter(s => s === STATE_REST).length;
        const active = 7 - rest;
        const pct    = active === 0 ? 0 : Math.round((walked / active) * 100);

        const row = document.createElement('div');
        row.className = 'history-row';

        const meta = document.createElement('div');
        meta.className = 'history-meta';

        const range = document.createElement('div');
        range.className = 'history-range';
        range.textContent = formatWeekRange(monday);

        const stat = document.createElement('div');
        stat.className = 'history-stat';
        stat.textContent = `${walked}/${active} · ${pct}%`;

        meta.appendChild(range);
        meta.appendChild(stat);

        const dots = document.createElement('div');
        dots.className = 'history-dots';
        days.forEach(s => {
            const dot = document.createElement('div');
            dot.className = 'history-dot ' + (s === STATE_WALKED ? 'walked' : s === STATE_REST ? 'rest' : 'none');
            dots.appendChild(dot);
        });

        row.appendChild(meta);
        row.appendChild(dots);
        list.appendChild(row);
    });
}

function openHistory() {
    renderHistory();
    document.getElementById('historyPanel').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeHistory() {
    document.getElementById('historyPanel').classList.remove('open');
    document.body.style.overflow = '';
}

// ── Main render ────────────────────────────────────────────────────────────

function render(animateIdx = null) {
    const { data, monday, wk } = getState();
    const days = data.weeks[wk];

    document.getElementById('weekLabel').textContent = formatWeekRange(monday);
    renderStats(data, days);
    renderGrid(days, monday, animateIdx);
    renderWeekComplete(days);
}

async function onDayTap(dayIndex) {
    setSync('syncing');
    const { state, synced } = await cycleDay(dayIndex);
    render(state === STATE_WALKED ? dayIndex : null);
    setSync(synced ? 'synced' : 'offline');
}

// ── History listeners ──────────────────────────────────────────────────────

document.getElementById('historyBtn').addEventListener('click', openHistory);
document.getElementById('historyClose').addEventListener('click', closeHistory);
document.getElementById('historyPanel').addEventListener('click', e => {
    if (e.target === document.getElementById('historyPanel')) closeHistory();
});

// ── Boot ───────────────────────────────────────────────────────────────────

async function init() {
    setLoading(true);
    render(); // render from cache immediately
    setSync('syncing');

    let ok;
    if (hasPendingSync()) {
        // Offline changes exist — flush them before loading server state
        ok = await syncFlushPending();
    } else {
        ok = await syncLoad();
    }

    render();
    setLoading(false);
    setSync(ok ? 'synced' : 'offline');
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') init();
});

window.addEventListener('online',  init);
window.addEventListener('offline', () => setSync('offline'));

init();