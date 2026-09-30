// Playground: JSON config editor on the left, live <day-rhythm> on the right.
import './site.js';

const P = window.DR_PATHS;
const [lib, packMod, validateMod, schema] = await Promise.all([
  import(P.lib), import(P.packs), import(P.validate), fetch(P.schema).then((r) => r.json()),
]);
const { core } = lib;
const { packs } = packMod;
const { validate } = validateMod;

const $ = (id) => document.getElementById(id);
const el = $('dr');
const editor = $('editor');
const gutter = $('gutter');
const errBox = $('errors');
const outPre = $('out');
const active = $('active');
const hostStatus = $('host-status');
const applyBtn = $('host-apply');
const params = new URLSearchParams(location.search);

const CONTROLS = {
  theme: $('c-theme'), colorScheme: $('c-scheme'), orientation: $('c-orient'), week: $('c-week'), locale: $('c-lang'), timeFormat: $('c-fmt'),
};
const DEFAULT_CFG = { theme: 'organic', colorScheme: 'auto', orientation: 'auto', week: 'auto', locale: 'en', timeFormat: '24h' };

let cfg = {};
let lastValueKey = '';
let outMode = 'value';
let applied = null;
let lastGoodText = '';

// ------------------------------------------------------------------ JSON with offsets (for inline errors)
function parseLoc(text) {
  const locs = new Map();
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const fail = (m) => { const e = new SyntaxError(m); e.pos = i; throw e; };
  const str = () => {
    const start = i;
    if (text[i] !== '"') fail('Expected a string');
    i++;
    while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; if (text[i] === '\n') fail('Unterminated string'); i++; }
    if (i >= text.length) fail('Unterminated string');
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const val = (path) => {
    ws();
    locs.set(path || '/', i);
    const c = text[i];
    if (c === '{') {
      i++; ws();
      const o = {};
      if (text[i] === '}') { i++; return o; }
      for (;;) {
        ws();
        const kpos = i;
        const k = str();
        locs.set(`${path}/${k}`, kpos);
        ws();
        if (text[i] !== ':') fail(`Expected ":" after "${k}"`);
        i++;
        o[k] = val(`${path}/${k}`);
        ws();
        if (text[i] === ',') { i++; ws(); if (text[i] === '}') fail('Trailing comma'); continue; }
        if (text[i] === '}') { i++; return o; }
        fail('Expected "," or "}"');
      }
    }
    if (c === '[') {
      i++; ws();
      const a = [];
      if (text[i] === ']') { i++; return a; }
      for (;;) {
        a.push(val(`${path}/${a.length}`));
        ws();
        if (text[i] === ',') { i++; ws(); if (text[i] === ']') fail('Trailing comma'); continue; }
        if (text[i] === ']') { i++; return a; }
        fail('Expected "," or "]"');
      }
    }
    if (c === '"') return str();
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (!m) fail(i >= text.length ? 'Unexpected end of JSON' : `Unexpected character "${c}"`);
    i += m[0].length;
    return JSON.parse(m[0]);
  };
  const v = val('');
  ws();
  if (i < text.length) fail('Unexpected content after the JSON value');
  return { value: v, locs };
}

const lineOf = (text, pos) => text.slice(0, pos).split('\n').length;
const colOf = (text, pos) => pos - text.lastIndexOf('\n', pos - 1);

// ------------------------------------------------------------------ rendering of editor state
function showErrors(list, text) {
  errBox.replaceChildren();
  const bad = new Set();
  if (!list.length) {
    errBox.className = 'errors ok';
    errBox.innerHTML = '<li>Config is valid.</li>';
  } else {
    errBox.className = 'errors';
    for (const e of list) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e.pos != null ? `Line ${lineOf(text, e.pos)}, col ${colOf(text, e.pos)}` : e.path;
      b.addEventListener('click', () => { editor.focus(); if (e.pos != null) editor.setSelectionRange(e.pos, e.pos + 1); });
      li.append(b, document.createTextNode(` ${e.path && e.pos != null && e.path !== '/' ? e.path + ' ' : ''}${e.message}`));
      errBox.append(li);
      if (e.pos != null) bad.add(lineOf(text, e.pos));
    }
  }
  drawGutter(text, bad);
}

function drawGutter(text, bad = new Set()) {
  const n = text.split('\n').length;
  gutter.replaceChildren();
  for (let l = 1; l <= n; l++) {
    const s = document.createElement('span');
    s.textContent = l;
    if (bad.has(l)) { s.className = 'err'; s.title = 'Problem on this line'; }
    s.style.display = 'block';
    gutter.append(s);
  }
  gutter.scrollTop = editor.scrollTop;
}

function validateText(text) {
  const errors = [];
  let parsed = null;
  try {
    const r = parseLoc(text);
    parsed = r.value;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push({ path: '/', pos: 0, message: 'The config must be a JSON object.' });
      parsed = null;
    } else {
      for (const e of validate(schema, parsed)) {
        const key = e.path === '/' ? '/' : e.path;
        let p = key;
        while (p && !r.locs.has(p)) p = p.slice(0, p.lastIndexOf('/'));
        errors.push({ path: e.path, message: e.message, pos: r.locs.get(p || '/') ?? 0 });
      }
    }
  } catch (e) {
    errors.push({ path: '', pos: e.pos ?? 0, message: e.message.replace(/ in JSON at position \d+.*$/, '') });
  }
  return { errors, parsed };
}

// ------------------------------------------------------------------ apply config to the element
function syncControls() {
  for (const [k, c] of Object.entries(CONTROLS)) {
    const v = cfg[k] ?? DEFAULT_CFG[k];
    if ([...c.options].some((o) => o.value === v)) c.value = v;
  }
  $('c-readonly').checked = !!cfg.readonly;
  $('c-credits').checked = cfg.credits === 'support';
}

function pushToElement() {
  const { value, ...rest } = cfg;
  el.config = rest;
  if (value !== undefined) {
    const key = JSON.stringify(value);
    if (key !== lastValueKey) { lastValueKey = key; el.value = value; applied = null; refreshOut(); }
  }
  syncControls();
}

function setText(text) {
  editor.value = text;
  lastGoodText = text;
  const { errors, parsed } = validateText(text);
  showErrors(errors, text);
  if (parsed && !errors.length) { cfg = parsed; pushToElement(); }
}

let timer = 0;
editor.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const text = editor.value;
    const { errors, parsed } = validateText(text);
    showErrors(errors, text);
    if (parsed && !errors.length) { cfg = parsed; lastGoodText = text; pushToElement(); syncUrl(); }
  }, 250);
  drawGutter(editor.value);
});
editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) return; // keep Tab for keyboard navigation
});

function writeCfg(mut) {
  // controls edit the JSON (single source of truth)
  const { errors, parsed } = validateText(editor.value);
  const base = parsed && !errors.length ? parsed : cfg;
  const next = { ...base };
  mut(next);
  setText(JSON.stringify(next, null, 2));
  syncUrl();
}

for (const [k, c] of Object.entries(CONTROLS)) {
  c.addEventListener('change', () => writeCfg((o) => { if (c.value === DEFAULT_CFG[k] && k !== 'locale') delete o[k]; else o[k] = c.value; }));
}
$('c-readonly').addEventListener('change', (e) => writeCfg((o) => { if (e.target.checked) o.readonly = true; else delete o.readonly; }));
$('c-credits').addEventListener('change', (e) => writeCfg((o) => { if (e.target.checked) o.credits = 'support'; else delete o.credits; }));

const packSel = $('c-pack');
packSel.append(new Option('Default (on / off)', ''));
for (const p of Object.values(packs)) packSel.append(new Option(p.title, p.id));
packSel.addEventListener('change', () => {
  const p = packs[packSel.value];
  const keep = {};
  for (const k of ['theme', 'colorScheme', 'orientation', 'locale', 'timeFormat', 'readonly', 'credits']) if (cfg[k] !== undefined) keep[k] = cfg[k];
  const base = p ? JSON.parse(JSON.stringify(p)) : {};
  setText(JSON.stringify({ ...base, ...keep }, null, 2));
  lastValueKey = '';
  pushToElement();
  syncUrl();
});

$('reset').addEventListener('click', () => { packSel.value = ''; packSel.dispatchEvent(new Event('change')); });

// ------------------------------------------------------------------ copy buttons
async function copy(text, note) {
  try { await navigator.clipboard.writeText(text); } catch (e) {
    const t = document.createElement('textarea');
    t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  $('copy-status').textContent = note;
  setTimeout(() => { $('copy-status').textContent = ''; }, 2500);
}
function currentConfig() {
  const c = { ...cfg };
  if ($('c-include').checked) c.value = el.value;
  return c;
}
$('copy-config').addEventListener('click', () => copy(JSON.stringify(currentConfig(), null, 2), 'Config copied to the clipboard.'));
$('copy-html').addEventListener('click', () => {
  const json = JSON.stringify(currentConfig(), null, 2).replace(/<\//g, '<\\/').split('\n').map((l) => '    ' + l).join('\n');
  const html = `<script type="module" src="https://cdn.jsdelivr.net/npm/dayrhythm"><\/script>\n\n<day-rhythm>\n  <script type="application/json">\n${json}\n  <\/script>\n</day-rhythm>\n`;
  copy(html, 'HTML snippet copied to the clipboard.');
});

// ------------------------------------------------------------------ output panel + host-side apply demo
function refreshOut() {
  const v = el.value;
  const weekly = core.isWeek(v);
  outPre.textContent = JSON.stringify(outMode === 'resolved' && weekly ? el.getWeek({ resolve: true }) : outMode === 'resolved' ? v : v, null, 2);
  const s = el.activeSlot ? el.activeSlot() : null;
  if (s) {
    const m = (cfg.models || el.models).find((x) => x.id === s.model);
    let info = '';
    try {
      const at = weekly ? { day: el.nowDay, time: el.now } : el.now;
      const nx = core.nextChange(v, at, { days: el.days });
      if (nx) info = `, next change in ${Math.round(nx.inMinutes / 60 * 10) / 10} h`;
    } catch (e) { /* ignore */ }
    active.textContent = `Active now: ${s.label || (m && (m.label || m.id)) || s.model} (${s.model}, starts ${s.time})${info}`;
  } else active.textContent = 'Active now: none';
  const dirty = JSON.stringify(v) !== applied;
  applyBtn.disabled = !dirty;
  hostStatus.textContent = dirty ? (applied === null ? 'Not applied yet.' : 'Changes not applied yet.') : hostStatus.dataset.done || '';
}
for (const ev of ['input', 'change', 'dayview']) el.addEventListener(ev, refreshOut);
el.addEventListener('ready', refreshOut);
el.addEventListener('error', (e) => {
  if (e.detail.source === 'config') {
    const li = document.createElement('li');
    li.textContent = `Component: ${e.detail.error.message}`;
    errBox.append(li);
  }
});
setInterval(refreshOut, 5000);
document.querySelectorAll('[data-out]').forEach((b) => b.addEventListener('click', () => {
  outMode = b.dataset.out;
  document.querySelectorAll('[data-out]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  refreshOut();
}));

// The apply button below belongs to this demo page (the "host app"), not to the library.
applyBtn.addEventListener('click', async () => {
  applyBtn.disabled = true;
  hostStatus.textContent = 'Sending...';
  const v = el.value;
  const body = core.isWeek(v) ? el.getWeek({ resolve: true }) : v;
  await new Promise((r) => setTimeout(r, 600)); // pretend network call
  applied = JSON.stringify(v);
  const n = Array.isArray(body) ? body.length : Object.values(body).reduce((s, d) => s + d.length, 0);
  hostStatus.dataset.done = `Applied ${n} slot${n === 1 ? '' : 's'} at ${new Date().toLocaleTimeString()}.`;
  refreshOut();
});

// ------------------------------------------------------------------ url state + start
function syncUrl() {
  const u = new URL(location.href);
  u.search = '';
  if (packSel.value) u.searchParams.set('pack', packSel.value);
  history.replaceState(null, '', u);
}

const start = i;
    if (text[i] !== '"') fail('Expected a string');
    i++;
    while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; if (text[i] === '\n') fail('Unterminated string'); i++; }
    if (i >= text.length) fail('Unterminated string');
    i++;
    return JSON.parse(text.slice(start, i));
  };
  const val = (path) => {
    ws();
    locs.set(path || '/', i);
    const c = text[i];
    if (c === '{') {
      i++; ws();
      const o = {};
      if (text[i] === '}') { i++; return o; }
      for (;;) {
        ws();
        const kpos = i;
        const k = str();
        locs.set(`${path}/${k}`, kpos);
        ws();
        if (text[i] !== ':') fail(`Expected ":" after "${k}"`);
        i++;
        o[k] = val(`${path}/${k}`);
        ws();
        if (text[i] === ',') { i++; ws(); if (text[i] === '}') fail('Trailing comma'); continue; }
        if (text[i] === '}') { i++; return o; }
        fail('Expected "," or "}"');
      }
    }
    if (c === '[') {
      i++; ws();
      const a = [];
      if (text[i] === ']') { i++; return a; }
      for (;;) {
        a.push(val(`${path}/${a.length}`));
        ws();
        if (text[i] === ',') { i++; ws(); if (text[i] === ']') fail('Trailing comma'); continue; }
        if (text[i] === ']') { i++; return a; }
        fail('Expected "," or "]"');
      }
    }
    if (c === '"') return str();
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (!m) fail(i >= text.length ? 'Unexpected end of JSON' : `Unexpected character "${c}"`);
    i += m[0].length;
    return JSON.parse(m[0]);
  };
  const v = val('');
  ws();
  if (i < text.length) fail('Unexpected content after the JSON value');
  return { value: v, locs };
}

const lineOf = (text, pos) => text.slice(0, pos).split('\n').length;
const colOf = (text, pos) => pos - text.lastIndexOf('\n', pos - 1);

// ------------------------------------------------------------------ rendering of editor state
function showErrors(list, text) {
  errBox.replaceChildren();
  const bad = new Set();
  if (!list.length) {
    errBox.className = 'errors ok';
    errBox.innerHTML = '<li>Config is valid.</li>';
  } else {
    errBox.className = 'errors';
    for (const e of list) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e.pos != null ? `Line ${lineOf(text, e.pos)}, col ${colOf(text, e.pos)}` : e.path;
      b.addEventListener('click', () => { editor.focus(); if (e.pos != null) editor.setSelectionRange(e.pos, e.pos + 1); });
      li.append(b, document.createTextNode(` ${e.path && e.pos != null && e.path !== '/' ? e.path + ' ' : ''}${e.message}`));
      errBox.append(li);
      if (e.pos != null) bad.add(lineOf(text, e.pos));
    }
  }
  drawGutter(text, bad);
}

function drawGutter(text, bad = new Set()) {
  const n = text.split('\n').length;
  gutter.replaceChildren();
  for (let l = 1; l <= n; l++) {
    const s = document.createElement('span');
    s.textContent = l;
    if (bad.has(l)) { s.className = 'err'; s.title = 'Problem on this line'; }
    s.style.display = 'block';
    gutter.append(s);
  }
  gutter.scrollTop = editor.scrollTop;
}

function validateText(text) {
  const errors = [];
  let parsed = null;
  try {
    const r = parseLoc(text);
    parsed = r.value;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push({ path: '/', pos: 0, message: 'The config must be a JSON object.' });
      parsed = null;
    } else {
      for (const e of validate(schema, parsed)) {
        const key = e.path === '/' ? '/' : e.path;
        let p = key;
        while (p && !r.locs.has(p)) p = p.slice(0, p.lastIndexOf('/'));
        errors.push({ path: e.path, message: e.message, pos: r.locs.get(p || '/') ?? 0 });
      }
    }
  } catch (e) {
    errors.push({ path: '', pos: e.pos ?? 0, message: e.message.replace(/ in JSON at position \d+.*$/, '') });
  }
  return { errors, parsed };
}

// ------------------------------------------------------------------ apply config to the element
function syncControls() {
  for (const [k, c] of Object.entries(CONTROLS)) {
    const v = cfg[k] ?? DEFAULT_CFG[k];
    if ([...c.options].some((o) => o.value === v)) c.value = v;
  }
  $('c-readonly').checked = !!cfg.readonly;
  $('c-credits').checked = cfg.credits === 'support';
}

function pushToElement() {
  const { value, ...rest } = cfg;
  el.config = rest;
  if (value !== undefined) {
    const key = JSON.stringify(value);
    if (key !== lastValueKey) { lastValueKey = key; el.value = value; applied = null; refreshOut(); }
  }
  syncControls();
}

function setText(text) {
  editor.value = text;
  lastGoodText = text;
  const { errors, parsed } = validateText(text);
  showErrors(errors, text);
  if (parsed && !errors.length) { cfg = parsed; pushToElement(); }
}

let timer = 0;
editor.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const text = editor.value;
    const { errors, parsed } = validateText(text);
    showErrors(errors, text);
    if (parsed && !errors.length) { cfg = parsed; lastGoodText = text; pushToElement(); syncUrl(); }
  }, 250);
  drawGutter(editor.value);
});
editor.addEventListener('scroll', () => { gutter.scrollTop = editor.scrollTop; });
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) return; // keep Tab for keyboard navigation
});

function writeCfg(mut) {
  // controls edit the JSON (single source of truth)
  const { errors, parsed } = validateText(editor.value);
  const base = parsed && !errors.length ? parsed : cfg;
  const next = { ...base };
  mut(next);
  setText(JSON.stringify(next, null, 2));
  syncUrl();
}

for (const [k, c] of Object.entries(CONTROLS)) {
  c.addEventListener('change', () => writeCfg((o) => { if (c.value === DEFAULT_CFG[k] && k !== 'locale') delete o[k]; else o[k] = c.value; }));
}
$('c-readonly').addEventListener('change', (e) => writeCfg((o) => { if (e.target.checked) o.readonly = true; else delete o.readonly; }));
$('c-credits').addEventListener('change', (e) => writeCfg((o) => { if (e.target.checked) o.credits = 'support'; else delete o.credits; }));

const packSel = $('c-pack');
packSel.append(new Option('Default (on / off)', ''));
for (const p of Object.values(packs)) packSel.append(new Option(p.title, p.id));
packSel.addEventListener('change', () => {
  const p = packs[packSel.value];
  const keep = {};
  for (const k of ['theme', 'colorScheme', 'orientation', 'locale', 'timeFormat', 'readonly', 'credits']) if (cfg[k] !== undefined) keep[k] = cfg[k];
  const base = p ? JSON.parse(JSON.stringify(p)) : {};
  setText(JSON.stringify({ ...base, ...keep }, null, 2));
  lastValueKey = '';
  pushToElement();
  syncUrl();
});

$('reset').addEventListener('click', () => { packSel.value = ''; packSel.dispatchEvent(new Event('change')); });

// ------------------------------------------------------------------ copy buttons
async function copy(text, note) {
  try { await navigator.clipboard.writeText(text); } catch (e) {
    const t = document.createElement('textarea');
    t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  $('copy-status').textContent = note;
  setTimeout(() => { $('copy-status').textContent = ''; }, 2500);
}
function currentConfig() {
  const c = { ...cfg };
  if ($('c-include').checked) c.value = el.value;
  return c;
}
$('copy-config').addEventListener('click', () => copy(JSON.stringify(currentConfig(), null, 2), 'Config copied to the clipboard.'));
$('copy-html').addEventListener('click', () => {
  const json = JSON.stringify(currentConfig(), null, 2).replace(/<\//g, '<\\/').split('\n').map((l) => '    ' + l).join('\n');
  const html = `<script type="module" src="https://cdn.jsdelivr.net/npm/dayrhythm"><\/script>\n\n<day-rhythm>\n  <script type="application/json">\n${json}\n  <\/script>\n</day-rhythm>\n`;
  copy(html, 'HTML snippet copied to the clipboard.');
});

// ------------------------------------------------------------------ output panel + host-side apply demo
function refreshOut() {
  const v = el.value;
  const weekly = core.isWeek(v);
  outPre.textContent = JSON.stringify(outMode === 'resolved' && weekly ? el.getWeek({ resolve: true }) : outMode === 'resolved' ? v : v, null, 2);
  const s = el.activeSlot ? el.activeSlot() : null;
  if (s) {
    const m = (cfg.models || el.models).find((x) => x.id === s.model);
    let info = '';
    try {
      const at = weekly ? { day: el.nowDay, time: el.now } : el.now;
      const nx = core.nextChange(v, at, { days: el.days });
      if (nx) info = `, next change in ${Math.round(nx.inMinutes / 60 * 10) / 10} h`;
    } catch (e) { /* ignore */ }
    active.textContent = `Active now: ${s.label || (m && (m.label || m.id)) || s.model} (${s.model}, starts ${s.time})${info}`;
  } else active.textContent = 'Active now: none';
  const dirty = JSON.stringify(v) !== applied;
  applyBtn.disabled = !dirty;
  hostStatus.textContent = dirty ? (applied === null ? 'Not applied yet.' : 'Changes not applied yet.') : hostStatus.dataset.done || '';
}
for (const ev of ['input', 'change', 'dayview']) el.addEventListener(ev, refreshOut);
el.addEventListener('ready', refreshOut);
el.addEventListener('error', (e) => {
  if (e.detail.source === 'config') {
    const li = document.createElement('li');
    li.textContent = `Component: ${e.detail.error.message}`;
    errBox.append(li);
  }
});
setInterval(refreshOut, 5000);
document.querySelectorAll('[data-out]').forEach((b) => b.addEventListener('click', () => {
  outMode = b.dataset.out;
  document.querySelectorAll('[data-out]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  refreshOut();
}));

// The apply button below belongs to this demo page (the "host app"), not to the library.
applyBtn.addEventListener('click', async () => {
  applyBtn.disabled = true;
  hostStatus.textContent = 'Sending...';
  const v = el.value;
  const body = core.isWeek(v) ? el.getWeek({ resolve: true }) : v;
  await new Promise((r) => setTimeout(r, 600)); // pretend network call
  applied = JSON.stringify(v);
  const n = Array.isArray(body) ? body.length : Object.values(body).reduce((s, d) => s + d.length, 0);
  hostStatus.dataset.done = `Applied ${n} slot${n === 1 ? '' : 's'} at ${new Date().toLocaleTimeString()}.`;
  refreshOut();
});

// ------------------------------------------------------------------ url state + start
function syncUrl() {
  const u = new URL(location.href);
  u.search = '';
  if (packSel.value) u.searchParams.set('pack', packSel.value);
  history.replaceState(null, '', u);
}

document.addEventListener('site-scheme', () => {
  if (!cfg.colorScheme || cfg.colorScheme === 'auto') pushToElement();
});

const start = params.get('pack') && packs[params.get('pack')] ? params.get('pack') : 'thermostat';
packSel.value = start;
{
  const p = JSON.parse(JSON.stringify(packs[start]));
  for (const k of ['theme', 'colorScheme', 'orientation', 'week', 'locale', 'timeFormat']) if (params.get(k)) p[k] = params.get(k);
  setText(JSON.stringify(p, null, 2));
}
applied = JSON.stringify(el.value);
hostStatus.dataset.done = 'Nothing to apply.';
requestAnimationFrame(refreshOut);
