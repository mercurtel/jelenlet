/* Jelenléti ív és szabadság-nyilvántartó – webes felület */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const ACTIVE = ['Függőben', 'Jóváhagyva', 'Rögzítve'];
  const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus',
    'szeptember', 'október', 'november', 'december'];
  const MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
  const DOW = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const DOW_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
  const STORE_KEY = 'jelenlet.session';
  const STATUS_CLASS = { 'Függőben': 'warn', 'Jóváhagyva': 'ok', 'Rögzítve': 'info', 'Elutasítva': 'bad', 'Visszavonva': 'muted' };

  const S = {
    session: null, boot: null, types: {},
    monthCache: {}, listCache: {}, balCache: {},
    pick: null, calMonth: null, ivMonth: null, listYear: null, listFilter: 'tavollet', keretYear: null,
    form: null, installPrompt: null, busy: 0,
  };
  const ACT = {};
  const CHANGE = {};

  // ------------------------------------------------------------------
  // Segédfüggvények
  // ------------------------------------------------------------------

  const $ = (sel, root) => (root || document).querySelector(sel);
  const app = () => document.getElementById('app');
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const toUTC = s => { const p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
  const fromUTC = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  const addDays = (s, n) => fromUTC(toUTC(s) + n * 864e5);
  const dow = s => new Date(toUTC(s)).getUTCDay();
  const addMonths = (m, n) => {
    let y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n;
    y += Math.floor(mo / 12);
    mo = ((mo % 12) + 12) % 12;
    return y + '-' + pad(mo + 1);
  };
  const monthTitle = m => m.slice(0, 4) + '. ' + MONTHS[+m.slice(5, 7) - 1];
  const thisYear = () => +S.boot.today.slice(0, 4);

  function fmtD(s, withDow) {
    if (!s) return '';
    const y = s.slice(0, 4);
    const t = (S.boot && y !== S.boot.today.slice(0, 4) ? y + '. ' : '') + MONTHS_SHORT[+s.slice(5, 7) - 1] + ' ' + (+s.slice(8)) + '.';
    return withDow ? t + ', ' + DOW[dow(s)] : t;
  }
  const fmtRange = (a, b) => a === b ? fmtD(a, true) : fmtD(a) + ' – ' + fmtD(b);
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const firstName = n => String(n || '').trim().split(/\s+/).slice(-1)[0];
  const T = code => S.types[code] || { code: code, name: code, short: code, color: '#94a3b8', group: 'tavollet' };
  const placeTypes = () => S.boot.types.filter(t => t.group === 'hely');

  function store(v) {
    try { v ? localStorage.setItem(STORE_KEY, v) : localStorage.removeItem(STORE_KEY); } catch (e) { /* privát mód */ }
  }
  function stored() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
    print: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  };
  const icon = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';

  // ------------------------------------------------------------------
  // Szerver
  // ------------------------------------------------------------------

  async function api(action, params) {
    const body = Object.assign({ action: action, session: S.session }, params || {});
    setBusy(1);
    try {
      let res;
      if (window.MOCK_BACKEND) {
        res = await window.MOCK_BACKEND(body);
      } else {
        // text/plain törzs: így nincs CORS előkérés az Apps Script felé.
        const r = await fetch(CFG.API_URL, { method: 'POST', body: JSON.stringify(body) });
        if (!r.ok) throw new Error('Hálózati hiba (' + r.status + '). Próbáld újra.');
        res = await r.json();
      }
      if (!res.ok) {
        const err = new Error(res.error || 'Ismeretlen hiba.');
        err.code = res.code;
        if (res.code === 'AUTH' && action !== 'login') logout(res.error);
        throw err;
      }
      return res.data;
    } catch (err) {
      if (err instanceof TypeError) throw new Error('Nem sikerült elérni a szervert. Van internetkapcsolat?');
      throw err;
    } finally {
      setBusy(-1);
    }
  }

  function setBusy(d) {
    S.busy = Math.max(0, S.busy + d);
    const el = document.getElementById('busy');
    if (el) el.hidden = S.busy === 0;
  }

  async function run(fn) {
    try {
      return await fn();
    } catch (err) {
      if (err.code !== 'AUTH') toast(err.message, true);
    }
  }

  function applyBoot(b) {
    S.boot = b;
    S.types = {};
    b.types.forEach(t => { S.types[t.code] = t; });
    const badge = document.getElementById('badge-pending');
    if (badge) {
      badge.textContent = b.pendingCount || '';
      badge.hidden = !b.pendingCount;
    }
  }

  function invalidate() {
    S.monthCache = {};
    S.listCache = {};
    S.balCache = {};
  }

  /** Írás: a szerver a friss kezdőadatokat is visszaküldi. */
  async function write(action, params) {
    const res = await api(action, Object.assign({ refresh: true }, params));
    if (res.bootstrap) applyBoot(res.bootstrap);
    invalidate();
    return res;
  }

  async function monthData(month, all) {
    const key = month + (all ? '*' : '');
    if (!S.monthCache[key]) S.monthCache[key] = await api('month', { month: month, all: !!all });
    return S.monthCache[key];
  }

  async function ensureCal(y) {
    if (!S.boot.calendars[y]) {
      const r = await api('calendar', { year: y });
      S.boot.calendars[y] = r.calendar;
    }
    return S.boot.calendars[y];
  }

  function isWorkday(d) {
    const cal = S.boot.calendars[d.slice(0, 4)];
    if (cal && cal.work[d]) return true;
    if (cal && cal.off[d]) return false;
    const w = dow(d);
    return w >= 1 && w <= 5;
  }

  function holidayName(d) {
    const cal = S.boot.calendars[d.slice(0, 4)];
    return cal ? (cal.off[d] || cal.work[d] || '') : '';
  }

  function countWorkdays(a, b) {
    let n = 0;
    for (let t = toUTC(a), e = toUTC(b); t <= e; t += 864e5) if (isWorkday(fromUTC(t))) n++;
    return n;
  }

  const isLocked = d => (S.boot.locked || []).indexOf(d.slice(0, 7)) >= 0;

  async function balancesOf(email, year) {
    const own = !email || email === S.boot.me.email;
    if (own && year === thisYear()) return S.boot.balances;
    const key = (own ? '' : email) + '|' + year;
    if (!S.balCache[key]) {
      const r = await api('entries', { year: year, email: own ? undefined : email });
      S.balCache[key] = r.balances;
      if (own) S.listCache[year] = r.entries;
    }
    return S.balCache[key];
  }

  // ------------------------------------------------------------------
  // Felugró elemek
  // ------------------------------------------------------------------

  let toastTimer = null;
  function toast(msg, isError) {
    const el = document.getElementById('toast') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast', className: 'toast' }));
    el.textContent = msg;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, isError ? 6000 : 3500);
  }

  function openSheet(html) {
    closeSheet();
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.id = 'sheet';
    wrap.innerHTML = '<div class="sheet-backdrop" data-act="sheet-close"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true"><button class="icon-btn sheet-x" data-act="sheet-close" aria-label="Bezárás">' +
      icon('close') + '</button>' + html + '</div>';
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    return wrap;
  }

  function closeSheet() {
    const el = document.getElementById('sheet');
    if (el) el.remove();
    document.body.classList.remove('no-scroll');
  }
  ACT['sheet-close'] = closeSheet;

  function confirmSheet(title, text, okLabel, danger) {
    return new Promise(resolve => {
      const w = openSheet('<h2>' + esc(title) + '</h2><p>' + text + '</p><div class="actions">' +
        '<button class="btn ghost" data-r="0">Mégse</button>' +
        '<button class="btn ' + (danger ? 'danger' : 'primary') + '" data-r="1">' + esc(okLabel) + '</button></div>');
      w.addEventListener('click', ev => {
        const b = ev.target.closest('[data-r]');
        if (b) { closeSheet(); resolve(b.dataset.r === '1'); }
        else if (ev.target.closest('[data-act="sheet-close"]')) resolve(false);
      });
    });
  }

  function promptSheet(title, label, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      const w = openSheet('<h2>' + esc(title) + '</h2><form class="form" id="prompt-form"><label>' + esc(label) +
        (opts.multiline
          ? '<textarea name="v" rows="3" placeholder="' + esc(opts.placeholder || '') + '"></textarea>'
          : '<input name="v" autocomplete="on" placeholder="' + esc(opts.placeholder || '') + '" value="' + esc(opts.value || '') + '">') +
        '</label><div class="actions"><button type="button" class="btn ghost" data-r="0">Mégse</button>' +
        '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" type="submit">' + esc(opts.ok || 'Rendben') + '</button></div></form>');
      const f = $('#prompt-form', w);
      const input = f.elements.v;
      setTimeout(() => input.focus(), 50);
      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const v = input.value.trim();
        if (opts.required && !v) { input.focus(); return; }
        closeSheet();
        resolve(v);
      });
      w.addEventListener('click', ev => {
        if (ev.target.closest('[data-r="0"]') || ev.target.closest('[data-act="sheet-close"]')) { closeSheet(); resolve(null); }
      });
    });
  }

  // ------------------------------------------------------------------
  // Bejelentkezés
  // ------------------------------------------------------------------

  function waitForGoogle() {
    return new Promise((resolve, reject) => {
      let n = 0;
      (function check() {
        if (window.google && google.accounts && google.accounts.id) return resolve(window.google);
        if (++n > 100) return reject(new Error('timeout'));
        setTimeout(check, 100);
      })();
    });
  }

  function showLogin(msg) {
    closeSheet();
    const name = CFG.CEG_NEV || 'Jelenlét';
    app().innerHTML = '<div class="login"><div class="login-card">' +
      '<div class="logo big">' + icon('cal') + '</div><h1>' + esc(name) + '</h1>' +
      '<p class="muted">Jelenléti ív és szabadság-nyilvántartás</p>' +
      (msg ? '<p class="error-box">' + esc(msg) + '</p>' : '') +
      '<div id="gbtn" class="gbtn"></div>' +
      '<p class="muted small">Jelentkezz be azzal a Google-fiókkal, amelyet az ügyvezetésnek megadtál.</p></div></div>';
    const el = document.getElementById('gbtn');
    if (window.MOCK_LOGIN) return window.MOCK_LOGIN(el, onCredential);
    if (!CFG.CLIENT_ID || !CFG.API_URL) {
      el.innerHTML = '<p class="error-box">A config.js nincs kitöltve (API_URL, CLIENT_ID).</p>';
      return;
    }
    waitForGoogle().then(g => {
      g.accounts.id.initialize({
        client_id: CFG.CLIENT_ID, callback: onCredential, auto_select: true,
        cancel_on_tap_outside: false, use_fedcm_for_prompt: true,
      });
      g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'hu', width: 260 });
      if (!msg) g.accounts.id.prompt();
    }).catch(() => {
      el.innerHTML = '<p class="error-box">A Google-bejelentkezés nem töltődött be. Ellenőrizd az internetkapcsolatot, majd frissítsd az oldalt.</p>';
    });
  }

  async function onCredential(resp) {
    try {
      const data = await api('login', { idToken: resp.credential });
      S.session = data.session;
      store(data.session);
      start(data.bootstrap);
    } catch (err) {
      showLogin(err.message);
    }
  }

  function logout(msg) {
    store(null);
    S.session = null;
    S.boot = null;
    invalidate();
    try { google.accounts.id.disableAutoSelect(); } catch (e) { /* nincs betöltve */ }
    showLogin(msg);
  }

  // ------------------------------------------------------------------
  // Váz és útválasztás
  // ------------------------------------------------------------------

  function navItems() {
    const m = S.boot.me.manager;
    const items = [
      { id: 'ma', label: 'Ma', icon: 'home' },
      { id: 'uj', label: 'Új', icon: 'plus' },
    ];
    if (m) {
      items.push({ id: 'jovahagyas', label: 'Jóváhagyás', icon: 'check', badge: true });
      items.push({ id: 'iv', label: 'Jelenléti ív', icon: 'grid' });
      items.push({ id: 'tobb', label: 'Több', icon: 'more' });
    } else {
      items.push({ id: 'naptar', label: 'Naptár', icon: 'cal' });
      items.push({ id: 'lista', label: 'Bejegyzések', icon: 'list' });
    }
    return items;
  }

  const VIEWS = {
    ma: viewMa, uj: viewUj, naptar: viewNaptar, lista: viewLista,
    jovahagyas: viewJovahagyas, iv: viewIv, keretek: viewKeretek, tobb: viewTobb,
  };
  const MANAGER_VIEWS = ['jovahagyas', 'iv', 'keretek', 'tobb'];
  const MORE_VIEWS = { naptar: 1, lista: 1, keretek: 1 };

  function shell() {
    const me = S.boot.me;
    app().innerHTML =
      '<div id="busy" class="busy" hidden></div>' +
      '<header class="top"><div class="brand"><span class="logo">' + icon('cal') + '</span><div>' +
      '<div class="brand-name">' + esc(S.boot.company || CFG.CEG_NEV || 'Jelenlét') + '</div>' +
      '<div class="brand-sub">Jelenlét és szabadság</div></div></div>' +
      '<button class="avatar" data-act="profile" aria-label="Profil: ' + esc(me.name) + '">' + esc(initials(me.name)) + '</button></header>' +
      '<nav class="nav">' + navItems().map(n => '<a href="#' + n.id + '" data-view="' + n.id + '">' + icon(n.icon) +
        '<span>' + n.label + '</span>' + (n.badge ? '<b class="badge" id="badge-pending"' + (S.boot.pendingCount ? '' : ' hidden') + '>' +
        (S.boot.pendingCount || '') + '</b>' : '') + '</a>').join('') + '</nav>' +
      '<main id="view" class="view"></main><div id="toast" class="toast" role="status" aria-live="polite"></div>';
  }

  function route() {
    if (!S.boot) return;
    closeSheet();
    let v = location.hash.replace('#', '') || 'ma';
    if (!VIEWS[v] || (MANAGER_VIEWS.indexOf(v) >= 0 && !S.boot.me.manager)) v = 'ma';
    document.querySelectorAll('.nav a').forEach(a => {
      const on = a.dataset.view === v || (a.dataset.view === 'tobb' && S.boot.me.manager && MORE_VIEWS[v]);
      a.classList.toggle('active', !!on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const view = document.getElementById('view');
    view.dataset.view = v;
    run(() => VIEWS[v](view));
  }

  function rerender() { route(); }

  function start(boot) {
    applyBoot(boot);
    S.pick = null;
    S.loadedAt = Date.now();
    shell();
    route();
  }

  // ------------------------------------------------------------------
  // Közös építőelemek
  // ------------------------------------------------------------------

  function badge(code, extraClass) {
    const t = T(code);
    return '<i class="tbadge ' + (extraClass || '') + '" style="--c:' + esc(t.color) + '" title="' + esc(t.name) + '">' + esc(t.short) + '</i>';
  }

  function pill(status) {
    return '<span class="pill ' + (STATUS_CLASS[status] || '') + '">' + esc(status) + '</span>';
  }

  function decisionText(e) {
    if (e.status === 'Jóváhagyva' && e.decidedBy) return 'Jóváhagyta: ' + esc(e.decidedBy) + ' · ' + esc(e.decidedAt);
    if (e.status === 'Elutasítva') return 'Elutasította: ' + esc(e.decidedBy) + (e.reason ? ' – „' + esc(e.reason) + '”' : '');
    if (e.status === 'Visszavonva') return 'Visszavonta: ' + esc(e.withdrawnBy) + ' · ' + esc(e.withdrawnAt);
    if (e.status === 'Függőben') return 'Beadva: ' + esc(e.submittedAt) + ' · jóváhagyásra vár';
    return '';
  }

  function entryItem(e, opts) {
    opts = opts || {};
    const meta = [fmtRange(e.start, e.end)];
    if (e.group === 'tavollet') meta.push(e.days + ' munkanap');
    if (e.place) meta.push(esc(e.place));
    const dec = decisionText(e);
    return '<li class="entry">' + badge(e.type) + '<div class="entry-main">' +
      '<div class="entry-top"><b>' + (opts.showName ? esc(e.name) + ' · ' : '') + esc(e.typeName) + '</b>' + pill(e.status) + '</div>' +
      '<div class="muted">' + meta.join(' · ') + '</div>' +
      (e.note ? '<div class="note">' + esc(e.note) + '</div>' : '') +
      (dec ? '<div class="muted small">' + dec + '</div>' : '') +
      (e.canWithdraw ? '<div class="entry-actions"><button class="btn small ghost danger" data-act="withdraw" data-id="' + esc(e.id) + '">Visszavonás</button></div>' : '') +
      (opts.extra || '') + '</div></li>';
  }

  ACT.withdraw = el => run(async () => {
    const ok = await confirmSheet('Visszavonás', 'Biztosan visszavonod ezt a bejegyzést? Az ügyvezetők értesítést kapnak, ha távollétről van szó.', 'Visszavonás', true);
    if (!ok) return;
    await write('withdraw', { id: el.dataset.id });
    toast('Visszavonva.');
    rerender();
  });

  /** Egy nap a saját (vagy ügyvezetőként más) szemszögéből: távollét, hely, alapértelmezés. */
  function dayInfo(d) {
    const own = S.boot.entries.filter(e => ACTIVE.indexOf(e.status) >= 0 && e.start <= d && e.end >= d);
    const absences = own.filter(e => e.group === 'tavollet');
    const absence = absences.find(e => e.status !== 'Függőben') || absences[0] || null;
    const place = own.find(e => e.group === 'hely') || null;
    return {
      workday: isWorkday(d), holiday: holidayName(d), absence: absence, place: place,
      current: place ? place.type : S.boot.me.defaultPlace,
    };
  }

  function placeButtons(d, current, isDefault, email) {
    return '<div class="place-btns">' + placeTypes().map(t =>
      '<button class="place-btn' + (t.code === current ? ' on' : '') + '" style="--c:' + esc(t.color) + '" data-act="setplace" data-type="' +
      esc(t.code) + '" data-date="' + d + '"' + (email ? ' data-email="' + esc(email) + '"' : '') + '>' +
      '<b>' + esc(t.short) + '</b><span>' + esc(t.name) + '</span>' +
      (t.code === current ? '<small>' + (isDefault ? 'alapértelmezett' : 'rögzítve') + '</small>' : '') + '</button>').join('') + '</div>';
  }

  ACT.setplace = el => run(async () => {
    const type = el.dataset.type, d = el.dataset.date, email = el.dataset.email;
    let place = '';
    if (type === 'HELYSZIN') {
      let last = '';
      try { last = localStorage.getItem('jelenlet.lastPlace') || ''; } catch (e) { /* nincs tár */ }
      place = await promptSheet('Helyszíni munkavégzés', 'Hol dolgozol? (ügyfél, cím)', { value: last, required: true, ok: 'Rögzítés' });
      if (!place) return;
      try { localStorage.setItem('jelenlet.lastPlace', place); } catch (e) { /* nincs tár */ }
    }
    await write('create', { type: type, start: d, end: d, place: place, email: email });
    closeSheet();
    toast('Rögzítve: ' + T(type).name + ', ' + fmtD(d) + (email ? ' – ' + nameOf(email) : ''));
    rerender();
  });

  function nameOf(email) {
    const p = (S.boot.people || []).find(x => x.email === email);
    return p ? p.name : email;
  }

  function monthHead(title, prevAct, nextAct) {
    return '<div class="month-head"><button class="icon-btn" data-act="' + prevAct + '" aria-label="Előző hónap">' + icon('left') + '</button>' +
      '<h1>' + esc(title) + '</h1><button class="icon-btn" data-act="' + nextAct + '" aria-label="Következő hónap">' + icon('right') + '</button></div>';
  }

  function legend(codes) {
    const list = codes || S.boot.types.map(t => t.code);
    return '<div class="legend">' + list.map(c => '<span>' + badge(c) + esc(T(c).name) + '</span>').join('') +
      '<span><i class="tbadge pending" style="--c:#94a3b8">?</i>jóváhagyásra vár</span>' +
      '<span><i class="tbadge alap" style="--c:#94a3b8">I</i>alapértelmezett hely</span></div>';
  }

  // ------------------------------------------------------------------
  // Ma
  // ------------------------------------------------------------------

  function viewMa(view) {
    const b = S.boot, me = b.me;
    const d = S.pick || b.today;
    const info = dayInfo(d);
    const sz = b.balances.find(x => x.detail) || null;
    const others = b.balances.filter(x => x !== sz);
    const upcoming = b.entries.filter(e => e.group === 'tavollet' && ACTIVE.indexOf(e.status) >= 0 && e.end >= b.today)
      .sort((x, y) => x.start.localeCompare(y.start)).slice(0, 6);
    const tomorrow = addDays(b.today, 1);

    let placeBody;
    if (!info.workday) {
      placeBody = '<p class="muted">Ez a nap nem munkanap' + (info.holiday ? ' (' + esc(info.holiday) + ')' : '') + '.</p>';
    } else if (info.absence) {
      placeBody = '<div class="status-line">' + badge(info.absence.type, info.absence.status === 'Függőben' ? 'pending' : '') +
        '<div><b>' + esc(info.absence.typeName) + '</b> ' + pill(info.absence.status) + '<div class="muted small">' +
        fmtRange(info.absence.start, info.absence.end) + '</div></div></div>' +
        '<p class="muted small">Erre a napra távollét van bejegyezve. Ha mégis dolgozol, előbb vond vissza a Bejegyzések között.</p>';
    } else if (isLocked(d)) {
      placeBody = '<div class="status-line">' + badge(info.current) + '<b>' + esc(T(info.current).name) + '</b></div>' +
        '<p class="muted small">Ez a hónap le van zárva, nem módosítható.</p>';
    } else {
      placeBody = placeButtons(d, info.current, !info.place) +
        (info.place && info.place.place ? '<p class="muted small">Helyszín: ' + esc(info.place.place) + '</p>' : '') +
        '<p class="muted small">Ha a megszokott helyeden dolgozol, nem kell semmit rögzítened.</p>';
    }

    view.innerHTML =
      (me.manager && b.pendingCount ? '<a class="banner" href="#jovahagyas">' + icon('check') + '<span><b>' + b.pendingCount +
        ' kérelem</b> vár jóváhagyásra</span>' + icon('right') + '</a>' : '') +
      '<h1 class="hello">Szia, ' + esc(firstName(me.name)) + '!</h1>' +
      '<section class="card"><div class="card-head"><h2>Hol dolgozol?</h2></div>' +
      '<div class="chips"><button class="chip' + (d === b.today ? ' on' : '') + '" data-act="pick" data-date="' + b.today + '">Ma</button>' +
      '<button class="chip' + (d === tomorrow ? ' on' : '') + '" data-act="pick" data-date="' + tomorrow + '">Holnap</button>' +
      '<label class="chip date-chip"><input type="date" value="' + d + '" data-change="pickdate" aria-label="Más nap"></label></div>' +
      '<p class="day-label">' + fmtD(d, true) + '</p>' + placeBody + '</section>' +
      (sz ? balanceCard(sz) : '') +
      others.map(x => '<section class="card mini">' + badge(x.type) + '<div><b>' + esc(x.name) + ' ' + x.year + '</b><div class="muted small">' +
        (x.used + x.planned) + ' / ' + x.total + ' nap felhasználva' + (x.pending ? ', ' + x.pending + ' függőben' : '') + '</div></div></section>').join('') +
      '<section class="card"><div class="card-head"><h2>Közelgő távollétek</h2><a class="btn small primary" href="#uj" data-act="new-leave">Szabadság kérése</a></div>' +
      (upcoming.length ? '<ul class="entries">' + upcoming.map(e => entryItem(e)).join('') + '</ul>' : '<p class="muted">Nincs bejegyzett távollét.</p>') +
      '</section>';
  }

  ACT.pick = el => { S.pick = el.dataset.date; rerender(); };
  CHANGE.pickdate = el => { if (el.value) { S.pick = el.value; ensureCalThen(el.value.slice(0, 4)); } };
  function ensureCalThen(y) { run(async () => { await ensureCal(y); rerender(); }); }
  ACT['new-leave'] = () => { S.form = null; location.hash = '#uj'; };

  function balanceCard(x) {
    const tot = Math.max(x.total, 1);
    const seg = (n, cls) => n > 0 ? '<i class="' + cls + '" style="width:' + (100 * n / tot).toFixed(2) + '%"></i>' : '';
    return '<section class="card balance"><div class="bal-top"><div><h2>' + esc(x.name) + ' ' + x.year + '</h2>' +
      '<p class="muted">Éves keret: <b>' + x.total + '</b> nap</p></div>' +
      '<div class="bal-big' + (x.remaining < 0 ? ' neg' : '') + '"><span>' + x.remaining + '</span><small>nap maradt</small></div></div>' +
      '<div class="bar">' + seg(x.used, 'used') + seg(x.planned, 'planned') + seg(x.pending, 'pend') + '</div>' +
      '<ul class="bar-legend"><li><i class="used"></i>Kivett: <b>' + x.used + '</b></li><li><i class="planned"></i>Jóváhagyott, jövőbeni: <b>' + x.planned +
      '</b></li><li><i class="pend"></i>Függőben: <b>' + x.pending + '</b></li></ul>' +
      (x.detail ? '<button class="link" data-act="keret-info" data-year="' + x.year + '">Hogyan jön ki a keret?</button>' : '') + '</section>';
  }

  function keretDetailHtml(x) {
    const d = x.detail;
    if (!d) return '';
    const rows = [['Alapszabadság', d.base], ['Életkor szerinti pótszabadság', d.age], ['Gyermek után járó pótszabadság', d.kids]];
    if (d.extra) rows.push(['Egyéb pótszabadság', d.extra]);
    return '<table class="kv">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + ' nap</td></tr>').join('') +
      (d.prorated ? '<tr><td>Időarányosítva (év közbeni belépés vagy kilépés)</td><td>' + d.computed + ' nap</td></tr>' : '') +
      (d.override !== null ? '<tr><td>Kézi felülírás (ügyvezetés)</td><td>' + d.override + ' nap</td></tr>' : '') +
      (d.carried ? '<tr><td>Előző évről áthozott</td><td>' + d.carried + ' nap</td></tr>' : '') +
      '<tr class="total"><td>Összesen</td><td>' + d.total + ' nap</td></tr></table>';
  }

  ACT['keret-info'] = el => {
    const x = S.boot.balances.find(b => b.detail && b.year === +el.dataset.year);
    openSheet('<h2>Szabadságkeret ' + x.year + '</h2>' + keretDetailHtml(x) +
      '<p class="muted small">A keretet a Munka törvénykönyve szerint számoljuk. Ha valami nem stimmel, szólj az ügyvezetésnek.</p>');
  };

  // ------------------------------------------------------------------
  // Új bejegyzés
  // ------------------------------------------------------------------

  function viewUj(view) {
    const b = S.boot, me = b.me;
    if (!S.form) S.form = { email: me.email, type: 'SZABADSAG', start: b.today, end: b.today, place: '', note: '' };
    if (!S.types[S.form.type]) S.form.type = b.types.find(t => t.group === 'tavollet').code;
    const f = S.form;
    const typeOpt = t => '<label class="type-opt"><input type="radio" name="type" value="' + esc(t.code) + '"' + (t.code === f.type ? ' checked' : '') + '>' +
      '<span>' + badge(t.code) + esc(t.name) + '</span></label>';
    view.innerHTML = '<h1>Új bejegyzés</h1><form id="f-new" class="card form" novalidate>' +
      (me.manager ? '<label>Munkatárs<select name="email">' + (b.people || []).map(p =>
        '<option value="' + esc(p.email) + '"' + (p.email === f.email ? ' selected' : '') + '>' + esc(p.name) + (p.email === me.email ? ' (én)' : '') + '</option>').join('') +
        '</select></label>' : '') +
      '<fieldset><legend>Távollét</legend><div class="type-grid">' + b.types.filter(t => t.group === 'tavollet').map(typeOpt).join('') + '</div></fieldset>' +
      '<fieldset><legend>Munkavégzés helye</legend><div class="type-grid">' + placeTypes().map(typeOpt).join('') + '</div></fieldset>' +
      '<div class="row2"><label>Első nap<input type="date" name="start" value="' + f.start + '" required></label>' +
      '<label>Utolsó nap<input type="date" name="end" value="' + f.end + '" required></label></div>' +
      '<label id="place-wrap"' + (f.type === 'HELYSZIN' ? '' : ' hidden') + '>Helyszín<input name="place" value="' + esc(f.place) + '" placeholder="pl. ügyfél neve, címe"></label>' +
      '<label>Megjegyzés <span class="muted small">(nem kötelező)</span><textarea name="note" rows="2">' + esc(f.note) + '</textarea></label>' +
      '<div class="calc" id="calc"></div>' +
      '<button class="btn primary big" type="submit">Beküldés</button></form>';
    const form = $('#f-new', view);
    form.addEventListener('input', () => readForm(form));
    form.addEventListener('change', () => readForm(form));
    form.addEventListener('submit', ev => { ev.preventDefault(); submitNew(form); });
    updateCalc();
  }

  function readForm(form) {
    const f = S.form, el = form.elements;
    if (el.email) f.email = el.email.value;
    f.type = (form.querySelector('input[name=type]:checked') || {}).value || f.type;
    const startChanged = el.start.value !== f.start;
    f.start = el.start.value;
    if (startChanged && (!f.end || f.end < f.start)) { f.end = f.start; el.end.value = f.start; }
    f.end = el.end.value;
    f.place = el.place.value;
    f.note = el.note.value;
    $('#place-wrap').hidden = f.type !== 'HELYSZIN';
    updateCalc();
  }

  let calcSeq = 0;
  async function updateCalc() {
    const box = document.getElementById('calc');
    if (!box) return;
    const f = S.form, t = T(f.type), me = S.boot.me;
    if (!f.start || !f.end) { box.innerHTML = ''; return; }
    if (f.end < f.start) { box.innerHTML = '<p class="warn-box">Az utolsó nap nem lehet korábbi az elsőnél.</p>'; return; }
    const seq = ++calcSeq;
    try {
      await ensureCal(f.start.slice(0, 4));
      await ensureCal(f.end.slice(0, 4));
    } catch (e) { /* offline: hétköznapokkal számolunk */ }
    const n = countWorkdays(f.start, f.end);
    const lines = ['<p><b>' + n + ' munkanap</b> · ' + fmtRange(f.start, f.end) + '</p>'];
    if (!n) lines.push('<p class="warn-box">Ebben az időszakban nincs munkanap.</p>');
    if (t.group === 'hely') {
      lines.push('<p class="muted small">Naponként rögzül, és felülírja az adott napra korábban megadott helyet. Jóváhagyás nem kell.</p>');
    } else {
      if (t.quota !== null && n) {
        try {
          const y = +f.start.slice(0, 4);
          const bal = (await balancesOf(f.email, y)).find(x => x.type === t.code);
          if (seq !== calcSeq) return;
          if (bal && f.start.slice(0, 4) === f.end.slice(0, 4)) {
            const after = bal.remaining - n;
            lines.push(after >= 0
              ? '<p>Maradék a kérés után: <b>' + after + ' nap</b> (' + y + ')</p>'
              : '<p class="warn-box">Nincs elég keret: ' + bal.remaining + ' nap maradt, a kérés ' + n + ' munkanap.</p>');
          }
        } catch (e) { /* a szerver úgyis ellenőrzi */ }
      }
      if (t.approval && !me.manager) lines.push('<p class="muted small">Jóváhagyásra kerül, az ügyvezetők e-mailt kapnak. Az eredményt a Bejegyzések között látod.</p>');
      else if (t.approval) lines.push('<p class="muted small">Ügyvezetőként rögzítve: azonnal jóváhagyott, a többi ügyvezető értesítést kap.</p>');
      else lines.push('<p class="muted small">Jóváhagyás nem kell, az ügyvezetők értesítést kapnak.</p>');
    }
    if (seq === calcSeq) box.innerHTML = lines.join('');
  }

  function submitNew(form) {
    run(async () => {
      readForm(form);
      const f = S.form, t = T(f.type), me = S.boot.me;
      if (!f.start || !f.end) return toast('Add meg a dátumokat.', true);
      if (t.code === 'HELYSZIN' && !f.place.trim()) { form.elements.place.focus(); return toast('Add meg a helyszínt.', true); }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const res = await write('create', {
          email: f.email !== me.email ? f.email : undefined, type: f.type, start: f.start, end: f.end, place: f.place, note: f.note,
        });
        const st = res.created[0] && res.created[0].status;
        toast(st === 'Függőben' ? 'Elküldve, jóváhagyásra vár.' : 'Rögzítve.');
        const other = f.email !== me.email;
        S.form = null;
        location.hash = other ? '#iv' : (t.group === 'hely' ? '#naptar' : '#lista');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------------
  // Saját naptár
  // ------------------------------------------------------------------

  async function viewNaptar(view) {
    const month = S.calMonth || S.boot.today.slice(0, 7);
    view.innerHTML = monthHead(monthTitle(month), 'cal-prev', 'cal-next') + '<div class="card skeleton">Betöltés…</div>';
    const data = await monthData(month, false);
    if (view.dataset.view !== 'naptar') return;
    const row = data.rows[0];
    const first = data.days[0].date;
    const lead = (dow(first) + 6) % 7;
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="cday empty"></div>';
    data.days.forEach(day => {
      const c = row.cells[day.date];
      const cls = ['cday'];
      if (!day.workday) cls.push('off');
      if (day.date === data.today) cls.push('today');
      cells += '<button class="' + cls.join(' ') + '" data-act="cal-day" data-date="' + day.date + '"' + (day.holiday ? ' title="' + esc(day.holiday) + '"' : '') + '>' +
        '<span class="dnum">' + (+day.date.slice(8)) + '</span>' +
        (c ? badge(c.t, c.s === 'fuggo' ? 'pending' : c.s === 'alap' ? 'alap' : '') : '') +
        (day.holiday && !day.workday ? '<span class="hol">' + esc(day.holiday) + '</span>' : '') + '</button>';
    });
    const sumCodes = Object.keys(row.summary);
    view.innerHTML = monthHead(monthTitle(month), 'cal-prev', 'cal-next') +
      (data.locked ? '<p class="info-box">' + icon('lock') + ' Ez a hónap le van zárva.</p>' : '') +
      '<div class="card cal-card"><div class="cal-grid">' + ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(x => '<div class="cdow">' + x + '</div>').join('') + cells + '</div></div>' +
      '<section class="card"><h2>Havi összesítés</h2><div class="sumchips">' +
      (sumCodes.length ? sumCodes.map(c => '<span>' + badge(c) + esc(T(c).name) + ': <b>' + row.summary[c] + '</b></span>').join('') : '<span class="muted">Nincs munkanap.</span>') +
      '</div>' + (row.pendingDays ? '<p class="muted small" style="margin:10px 0 0">Ebből ' + row.pendingDays +
        ' nap távollét jóváhagyásra vár (addig a munkavégzési helynél számoljuk).</p>' : '') + '</section>' + legend();
    S.calData = data;
  }

  ACT['cal-prev'] = () => { S.calMonth = addMonths(S.calMonth || S.boot.today.slice(0, 7), -1); rerender(); };
  ACT['cal-next'] = () => { S.calMonth = addMonths(S.calMonth || S.boot.today.slice(0, 7), 1); rerender(); };

  ACT['cal-day'] = el => {
    const data = S.calData;
    const d = el.dataset.date;
    const day = data.days.find(x => x.date === d);
    const row = data.rows[0];
    openSheet(dayDetailHtml(data, row, day, null));
  };

  /** Egy nap részletei (saját naptár és jelenléti ív közös panelje). */
  function dayDetailHtml(data, row, day, email) {
    const d = day.date, c = row.cells[d];
    const ids = c ? [c.id].concat(Object.keys(row.entries).filter(id => {
      const e = row.entries[id];
      return e.start <= d && e.end >= d && id !== c.id;
    })) : [];
    const list = ids.filter(Boolean).map(id => row.entries[id]).filter(Boolean);
    let html = '<h2>' + (email ? esc(row.name) + '<br><small class="muted">' + fmtD(d, true) + '</small>' : fmtD(d, true)) + '</h2>';
    if (day.holiday) html += '<p class="muted">' + esc(day.holiday) + '</p>';
    if (!c) return html + '<p class="muted">' + (day.workday ? 'Nincs munkaviszonyban ezen a napon.' : 'Nem munkanap.') + '</p>';
    if (c.s === 'alap') html += '<div class="status-line">' + badge(c.t, 'alap') + '<b>' + esc(T(c.t).name) + '</b><span class="muted small">alapértelmezett hely</span></div>';
    if (list.length) html += '<ul class="entries">' + list.map(e => entryItem(e, {
      extra: S.boot.me.manager && e.status === 'Függőben' ? '<div class="actions"><button class="btn ghost danger" data-act="reject" data-id="' + esc(e.id) +
        '">Elutasítás</button><button class="btn primary" data-act="approve" data-id="' + esc(e.id) + '">Jóváhagyás</button></div>' : '',
    })).join('') + '</ul>';
    const approvedAbsence = list.find(e => e.group === 'tavollet' && e.status !== 'Függőben');
    const pendingAbsence = list.find(e => e.group === 'tavollet' && e.status === 'Függőben');
    if (!data.locked && !approvedAbsence && !pendingAbsence) {
      const placeEntry = list.find(e => e.group === 'hely');
      html += '<h3>Munkavégzés helye</h3>' + placeButtons(d, c.t, !placeEntry, email || undefined);
    }
    if (!data.locked && !approvedAbsence && !pendingAbsence) {
      html += '<div class="actions"><button class="btn ghost" data-act="absence-on" data-date="' + d + '"' + (email ? ' data-email="' + esc(email) + '"' : '') +
        '>Távollét rögzítése erre a napra</button></div>';
    }
    if (data.locked) html += '<p class="info-box">' + icon('lock') + ' A hónap le van zárva.</p>';
    return html;
  }

  ACT['absence-on'] = el => {
    S.form = {
      email: el.dataset.email || S.boot.me.email, type: 'SZABADSAG', start: el.dataset.date, end: el.dataset.date, place: '', note: '',
    };
    closeSheet();
    location.hash = '#uj';
  };

  // ------------------------------------------------------------------
  // Bejegyzéseim
  // ------------------------------------------------------------------

  async function viewLista(view) {
    const year = S.listYear || thisYear();
    const head = '<h1>Bejegyzéseim</h1><div class="chips">' + [thisYear() - 1, thisYear(), thisYear() + 1].map(y =>
      '<button class="chip' + (y === year ? ' on' : '') + '" data-act="list-year" data-year="' + y + '">' + y + '</button>').join('') +
      '</div><div class="chips">' + [['tavollet', 'Távollétek'], ['hely', 'Munkavégzés helye'], ['all', 'Mind']].map(p =>
      '<button class="chip' + (S.listFilter === p[0] ? ' on' : '') + '" data-act="list-filter" data-f="' + p[0] + '">' + p[1] + '</button>').join('') + '</div>';
    let entries;
    if (year === thisYear()) {
      entries = S.boot.entries;
    } else {
      view.innerHTML = head + '<div class="card skeleton">Betöltés…</div>';
      if (!S.listCache[year]) {
        const r = await api('entries', { year: year });
        S.listCache[year] = r.entries;
        S.balCache['|' + year] = r.balances;
      }
      entries = S.listCache[year];
    }
    if (view.dataset.view !== 'lista') return;
    const shown = entries.filter(e => S.listFilter === 'all' || e.group === S.listFilter);
    view.innerHTML = head + '<section class="card">' + (shown.length
      ? '<ul class="entries">' + shown.map(e => entryItem(e)).join('') + '</ul>'
      : '<p class="muted">Nincs bejegyzés.</p>') + '</section>';
  }

  ACT['list-year'] = el => { S.listYear = +el.dataset.year; rerender(); };
  ACT['list-filter'] = el => { S.listFilter = el.dataset.f; rerender(); };

  // ------------------------------------------------------------------
  // Jóváhagyás (ügyvezetés)
  // ------------------------------------------------------------------

  async function viewJovahagyas(view) {
    view.innerHTML = '<h1>Jóváhagyásra vár</h1><div class="card skeleton">Betöltés…</div>';
    const list = await api('pending');
    if (view.dataset.view !== 'jovahagyas') return;
    S.boot.pendingCount = list.length;
    applyBoot(S.boot);
    view.innerHTML = '<h1>Jóváhagyásra vár</h1>' + (list.length ? list.map(e =>
      '<section class="card pending-card"><div class="entry-top">' + badge(e.type) + '<div><b>' + esc(e.name) + '</b><div>' + esc(e.typeName) + '</div></div></div>' +
      '<p class="big-range">' + fmtRange(e.start, e.end) + ' · <b>' + e.days + ' munkanap</b></p>' +
      (e.note ? '<p class="note">' + esc(e.note) + '</p>' : '') +
      (e.balance ? '<p class="muted small">Keret ' + e.balance.year + ': ' + e.balance.total + ' nap · a kérés jóváhagyása után ' + e.balance.remaining + ' nap marad</p>' : '') +
      (e.overlaps && e.overlaps.length ? '<p class="warn-box small">Ugyanekkor távol: ' + e.overlaps.map(esc).join('; ') + '</p>' : '') +
      '<p class="muted small">Beadva: ' + esc(e.submittedAt) + '</p>' +
      '<div class="actions"><button class="btn ghost danger" data-act="reject" data-id="' + esc(e.id) + '">Elutasítás</button>' +
      '<button class="btn primary" data-act="approve" data-id="' + esc(e.id) + '">Jóváhagyás</button></div></section>').join('')
      : '<section class="card empty-state">' + icon('check') + '<p>Nincs jóváhagyásra váró kérelem.</p></section>');
  }

  ACT.approve = el => run(async () => {
    el.disabled = true;
    await write('decide', { id: el.dataset.id, decision: 'approve' });
    toast('Jóváhagyva, a munkatárs értesítést kapott.');
    rerender();
  });

  ACT.reject = el => run(async () => {
    const reason = await promptSheet('Elutasítás', 'Indoklás (a munkatárs megkapja e-mailben)', { multiline: true, ok: 'Elutasítás', danger: true });
    if (reason === null) return;
    await write('decide', { id: el.dataset.id, decision: 'reject', reason: reason });
    toast('Elutasítva, a munkatárs értesítést kapott.');
    rerender();
  });

  // ------------------------------------------------------------------
  // Jelenléti ív (ügyvezetés)
  // ------------------------------------------------------------------

  async function viewIv(view) {
    const month = S.ivMonth || S.boot.today.slice(0, 7);
    view.innerHTML = monthHead(monthTitle(month), 'iv-prev', 'iv-next') + '<div class="card skeleton">Betöltés…</div>';
    const data = await monthData(month, true);
    if (view.dataset.view !== 'iv') return;
    S.ivData = data;
    const used = {};
    data.rows.forEach(r => Object.keys(r.summary).forEach(c => { used[c] = 1; }));
    const sumCols = S.boot.types.filter(t => used[t.code]);
    const head = '<tr><th class="name">Név</th>' + data.days.map(d =>
      '<th class="' + (d.workday ? '' : 'off') + (d.date === data.today ? ' today' : '') + '"' + (d.holiday ? ' title="' + esc(d.holiday) + '"' : '') + '>' +
      '<span>' + (+d.date.slice(8)) + '</span><small>' + DOW_SHORT[d.dow] + '</small></th>').join('') +
      sumCols.map(t => '<th class="sum" title="' + esc(t.name) + '">' + esc(t.short) + '</th>').join('') +
      '<th class="sum" title="Szabadság maradék">Marad</th></tr>';
    const body = data.rows.map((r, ri) => {
      const sz = r.balances.find(x => x.detail);
      return '<tr><th class="name" data-act="iv-person" data-ri="' + ri + '">' + esc(r.name) + '</th>' + data.days.map(d => {
        const c = r.cells[d.date];
        if (!c) return '<td class="' + (d.workday ? 'none' : 'off') + '"></td>';
        const t = T(c.t);
        const cls = 'c' + (c.s === 'fuggo' ? ' pending' : c.s === 'alap' ? ' alap' : '') + (d.date === data.today ? ' today' : '');
        return '<td class="' + cls + '" style="--c:' + esc(t.color) + '" data-act="iv-cell" data-ri="' + ri + '" data-date="' + d.date + '">' +
          esc(t.short) + (c.s === 'fuggo' ? '?' : '') + '</td>';
      }).join('') + sumCols.map(t => '<td class="sum">' + (r.summary[t.code] || '') + '</td>').join('') +
        '<td class="sum">' + (sz ? sz.remaining : '') + '</td></tr>';
    }).join('');
    view.innerHTML = monthHead(monthTitle(month), 'iv-prev', 'iv-next') +
      '<div class="toolbar">' +
      '<button class="btn small ' + (data.locked ? 'warn' : 'ghost') + '" data-act="iv-lock">' + icon(data.locked ? 'lock' : 'unlock') +
      (data.locked ? 'Lezárva – feloldás' : 'Hónap lezárása') + '</button>' +
      '<button class="btn small ghost" data-act="iv-export">' + icon('sheet') + 'Táblázatba</button>' +
      '<button class="btn small ghost" data-act="iv-print">' + icon('print') + 'Nyomtatás</button></div>' +
      '<div class="print-title">' + esc(S.boot.company || '') + ' – Jelenléti ív, ' + esc(monthTitle(month)) + '</div>' +
      '<div class="iv-wrap card"><table class="iv"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      legend() + '<p class="muted small">Koppints egy cellára a részletekért vagy módosításért, a névre a keret és a bejegyzések megtekintéséhez.</p>';
  }

  ACT['iv-prev'] = () => { S.ivMonth = addMonths(S.ivMonth || S.boot.today.slice(0, 7), -1); rerender(); };
  ACT['iv-next'] = () => { S.ivMonth = addMonths(S.ivMonth || S.boot.today.slice(0, 7), 1); rerender(); };
  ACT['iv-print'] = () => window.print();

  ACT['iv-cell'] = el => {
    const data = S.ivData, row = data.rows[+el.dataset.ri];
    const day = data.days.find(x => x.date === el.dataset.date);
    openSheet(dayDetailHtml(data, row, day, row.email));
  };

  ACT['iv-person'] = el => run(async () => {
    const row = S.ivData.rows[+el.dataset.ri];
    await personSheet(row.email, row.name, +S.ivData.month.slice(0, 4));
  });

  ACT['iv-lock'] = () => run(async () => {
    const data = S.ivData;
    const ok = await confirmSheet(data.locked ? 'Hónap feloldása' : 'Hónap lezárása',
      data.locked ? 'Feloldás után a ' + esc(monthTitle(data.month)) + ' hónap bejegyzései ismét módosíthatók.'
        : 'Lezárás után a ' + esc(monthTitle(data.month)) + ' hónapra senki nem rögzíthet és nem vonhat vissza (pl. bérszámfejtés előtt). Később feloldható.',
      data.locked ? 'Feloldás' : 'Lezárás');
    if (!ok) return;
    await write('lock', { month: data.month, locked: !data.locked });
    toast(data.locked ? 'Hónap feloldva.' : 'Hónap lezárva.');
    rerender();
  });

  ACT['iv-export'] = () => run(async () => {
    const r = await api('exportMonth', { month: S.ivData.month });
    openSheet('<h2>Exportálva</h2><p>A jelenléti ív elkészült a nyilvántartó táblázat „' + esc(r.sheet) + '” lapján. ' +
      'Onnan PDF-be is letölthető (Fájl → Letöltés → PDF).</p><div class="actions"><a class="btn primary" href="' + esc(r.url) +
      '" target="_blank" rel="noopener">Megnyitás a táblázatban</a></div>');
  });

  // ------------------------------------------------------------------
  // Keretek (ügyvezetés)
  // ------------------------------------------------------------------

  async function viewKeretek(view) {
    const year = S.keretYear || thisYear();
    const head = '<h1>Szabadságkeretek</h1><div class="chips">' + [thisYear() - 1, thisYear(), thisYear() + 1].map(y =>
      '<button class="chip' + (y === year ? ' on' : '') + '" data-act="keret-year" data-year="' + y + '">' + y + '</button>').join('') + '</div>';
    view.innerHTML = head + '<div class="card skeleton">Betöltés…</div>';
    const data = await api('balances', { year: year });
    if (view.dataset.view !== 'keretek') return;
    S.keretData = data;
    const quotaTypes = S.boot.types.filter(t => t.quota !== null && t.quota !== 'SZAMITOTT');
    view.innerHTML = head + '<div class="card table-wrap"><table class="grid-table"><thead><tr><th>Név</th><th>Keret</th><th>Kivett</th>' +
      '<th>Tervezett</th><th>Függő</th><th>Maradék</th>' + quotaTypes.map(t => '<th>' + esc(t.name) + '</th>').join('') + '</tr></thead><tbody>' +
      data.rows.map((r, i) => {
        const sz = r.balances.find(x => x.detail) || {};
        return '<tr data-act="keret-person" data-i="' + i + '"><th>' + esc(r.name) + '</th><td>' + (sz.total ?? '') + '</td><td>' + (sz.used ?? '') +
          '</td><td>' + (sz.planned ?? '') + '</td><td>' + (sz.pending || '') + '</td><td class="' + (sz.remaining < 0 ? 'neg' : 'strong') + '">' +
          (sz.remaining ?? '') + '</td>' + quotaTypes.map(t => {
            const x = r.balances.find(b => b.type === t.code);
            return '<td>' + (x ? (x.used + x.planned) + ' / ' + x.total : '') + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="muted small">Koppints egy névre a keret részleteiért és a bejegyzésekért. ' +
      'A kereteket (születési év, gyermekek, áthozott napok) a nyilvántartó táblázatban lehet módosítani.</p>';
  }

  ACT['keret-year'] = el => { S.keretYear = +el.dataset.year; rerender(); };
  ACT['keret-person'] = el => run(async () => {
    const r = S.keretData.rows[+el.dataset.i];
    await personSheet(r.email, r.name, S.keretData.year);
  });

  async function personSheet(email, name, year) {
    const r = await api('entries', { email: email, year: year });
    const sz = r.balances.find(x => x.detail);
    const absences = r.entries.filter(e => e.group === 'tavollet');
    openSheet('<h2>' + esc(name) + ' · ' + year + '</h2>' + (sz ? keretDetailHtml(sz) +
      '<p>Kivett: <b>' + sz.used + '</b> · tervezett: <b>' + sz.planned + '</b> · függő: <b>' + sz.pending + '</b> · maradék: <b>' + sz.remaining + '</b></p>' : '') +
      '<h3>Távollétek</h3>' + (absences.length ? '<ul class="entries">' + absences.map(e => entryItem(e)).join('') + '</ul>' : '<p class="muted">Nincs.</p>') +
      '<div class="actions"><button class="btn primary" data-act="absence-on" data-date="' + S.boot.today + '" data-email="' + esc(email) + '">Új bejegyzés neki</button></div>');
  }

  // ------------------------------------------------------------------
  // Több / profil
  // ------------------------------------------------------------------

  function viewTobb(view) {
    view.innerHTML = '<h1>Több</h1><nav class="card menu">' +
      '<a href="#keretek">' + icon('users') + '<span>Szabadságkeretek</span>' + icon('right') + '</a>' +
      '<a href="#naptar">' + icon('cal') + '<span>Saját naptáram</span>' + icon('right') + '</a>' +
      '<a href="#lista">' + icon('list') + '<span>Saját bejegyzéseim</span>' + icon('right') + '</a>' +
      '</nav>' + installHtml() +
      '<div class="actions"><button class="btn ghost" data-act="logout">Kijelentkezés</button></div>';
  }

  function installHtml() {
    const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
    if (standalone) return '';
    return '<section class="card"><h2>Telepítés a telefonra</h2>' +
      (S.installPrompt ? '<button class="btn primary" data-act="install">Alkalmazás telepítése</button>' : '') +
      '<p class="muted small"><b>iPhone:</b> Safariban a Megosztás gomb → „Főképernyőhöz adás”.<br>' +
      '<b>Android:</b> Chrome menü (⋮) → „Alkalmazás telepítése” vagy „Hozzáadás a kezdőképernyőhöz”.</p></section>';
  }

  ACT.profile = () => {
    const me = S.boot.me;
    openSheet('<div class="profile"><span class="avatar big">' + esc(initials(me.name)) + '</span><div><h2>' + esc(me.name) + '</h2>' +
      '<p class="muted">' + esc(me.email) + '<br>' + (me.manager ? 'Ügyvezető' : 'Munkavállaló') + ' · alapértelmezett hely: ' +
      esc(T(me.defaultPlace).name) + '</p></div></div>' + installHtml() +
      '<div class="actions"><button class="btn ghost" data-act="logout">Kijelentkezés</button></div>');
  };

  ACT.logout = () => logout();

  ACT.install = () => run(async () => {
    if (!S.installPrompt) return;
    S.installPrompt.prompt();
    await S.installPrompt.userChoice;
    S.installPrompt = null;
    closeSheet();
  });

  // ------------------------------------------------------------------
  // Indítás
  // ------------------------------------------------------------------

  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== 'A' || el.dataset.act !== 'new-leave') ev.preventDefault();
    fn(el, ev);
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-change]');
    if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el);
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeSheet(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); S.installPrompt = ev; });
  // Visszatéréskor (pl. telefonon az app újranyitásakor) friss adatok.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !S.boot || !S.session || document.getElementById('sheet')) return;
    if (Date.now() - (S.loadedAt || 0) < 60000) return;
    run(async () => { applyBoot(await api('bootstrap')); S.loadedAt = Date.now(); invalidate(); rerender(); });
  });

  if ('serviceWorker' in navigator && !window.MOCK_BACKEND && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* nem kötelező */ });
  }

  function init() {
    S.session = stored();
    if (!S.session) return showLogin();
    app().innerHTML = '<div class="boot">Betöltés…</div>';
    api('bootstrap').then(b => { S.loadedAt = Date.now(); start(b); }).catch(err => {
      if (err.code !== 'AUTH') showLogin(err.message);
    });
  }

  init();
})();
