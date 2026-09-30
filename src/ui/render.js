// Builds and refreshes the component DOM.
import { structureCSS } from '../styles/structure.js';
import { baseCSS } from '../styles/base.js';
import { themeCSS } from '../styles/themes.js';
import { WEEKDAYS, parseTime } from '../core/time.js';
import { slotRanges, boundaryBounds, isLocked, genId, clone, resolveValues, normalizeDay } from '../core/slots.js';
import { isWeek, carrySlotFor } from '../core/week.js';
import { activeSlotAtDay } from '../core/active.js';
import { activeSlotAtWeek } from '../core/week.js';
import { validateDay } from '../core/validate.js';
import { buildLayout, pieceAt, gradientStops } from './layout.js';
import { modelPreview, modelSummary, fieldLabel } from './model.js';
import { nowOf } from './clock.js';
import { applyRendered, fillIcon, camel, classList } from './dom.js';
import { attachDrag } from './drag.js';
import { openEditor, openSaveDay, openCopy } from './dialog.js';

const CSS = structureCSS + baseCSS + themeCSS;
const REPO = 'https://github.com/MadeinTaly/dayrhythm';
const DONATE = 'https://gt.1471995.xyz';
let uidCounter = 0;
let sheet = null;

// ------------------------------------------------------------------ styles
function docStyle() {
  if (document.head.querySelector('style[data-dayrhythm]')) return;
  const s = document.createElement('style');
  s.setAttribute('data-dayrhythm', '');
  s.textContent = `@layer theme, base, dayrhythm, components, utilities;\n@layer dayrhythm{${CSS}}`;
  document.head.prepend(s);
}

function adoptDocSheets(el, sr) {
  const build = () => {
    const out = [];
    for (const ss of document.styleSheets) {
      try {
        const css = [...ss.cssRules].map((r) => r.cssText).join('\n');
        const cs = new CSSStyleSheet();
        cs.replaceSync(css);
        out.push(cs);
      } catch (e) {
        if (!el._warned.has('xs')) { el._warned.add('xs'); console.warn('[dayrhythm] inherit-styles: skipped a cross-origin or unreadable stylesheet'); }
      }
    }
    sr.adoptedStyleSheets = [sheet, ...out];
  };
  build();
  if (el._mo) el._mo.disconnect();
  el._mo = new MutationObserver(build);
  el._mo.observe(document.head, { childList: true, subtree: true, characterData: true });
}

function attachStyles(el) {
  const cfg = el.cfg;
  if (!el._renderMode) el._renderMode = cfg.render === 'light' ? 'light' : 'shadow';
  if (!el._uid) el._uid = 'dr' + ++uidCounter;
  if (el._renderMode === 'light') {
    docStyle();
    el.setAttribute('data-dr-uid', el._uid);
    return el;
  }
  const sr = el.shadowRoot || el.attachShadow({ mode: 'open' });
  if (!el._sheetDone) {
    el._sheetDone = true;
    if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in sr) {
      if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); }
      sr.adoptedStyleSheets = [sheet];
    } else {
      const s = document.createElement('style');
      s.textContent = CSS;
      sr.append(s);
    }
  }
  if (cfg.inheritStyles && 'adoptedStyleSheets' in sr) adoptDocSheets(el, sr);
  return sr;
}

function userStyles(el, root) {
  const css = el.cfg.styles;
  if (!css) return;
  const s = document.createElement('style');
  s.textContent = el._renderMode === 'light' ? `@layer components{[data-dr-uid="${el._uid}"] .dr-root{${css}}}` : css;
  root.append(s);
}

// ------------------------------------------------------------------ helpers
function region(el, name, main) {
  const r = el._mk(el._renderMode === 'light' ? 'div' : 'slot', main);
  if (el._renderMode === 'light') {
    r.classList.add('dr-region');
    for (const n of el._slotted[name] || []) r.append(n);
  } else r.setAttribute('name', name);
  return r;
}
export { region };

/** Toggle a stateful part token (part + class + user classes + data attribute). */
export function setState(el, node, token, on, dataKey) {
  if (node.part) node.part.toggle(token, !!on);
  node.classList.toggle('dr-' + token, !!on);
  for (const c of classList((el.cfg.classes || {})[camel(token)])) node.classList.toggle(c, !!on);
  if (dataKey) { if (on) node.dataset[dataKey] = ''; else delete node.dataset[dataKey]; }
}

function nameOf(el, slot, index) { return slot.label || el.t('slotDefault', { n: index + 1 }); }
export { nameOf };

// ------------------------------------------------------------------ root
export function buildRoot(el) {
  const cfg = el.cfg;
  const host = attachStyles(el);
  const $ = el._$ = {};
  const root = el._mk('div', 'root');
  $.root = root;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', el.t(el.weekMode ? 'titleWeek' : 'title'));
  root.dataset.theme = ['organic', 'neutral', 'flat', 'none'].includes(cfg.theme) ? cfg.theme : 'organic';
  root.dataset.scheme = ['light', 'dark'].includes(cfg.colorScheme) ? cfg.colorScheme : 'auto';
  if (cfg.disabled) { root.dataset.disabled = ''; root.inert = true; }
  if (cfg.readonly) root.dataset.readonly = '';
  // native input/change events from inner controls must not leak out as if they were ours
  for (const ev of ['input', 'change']) root.addEventListener(ev, (e) => { if (!(e instanceof CustomEvent)) e.stopPropagation(); });

  $.header = region(el, 'header', 'header');
  $.weekTop = el._mk('div', 'week-bar-slot');
  $.presets = el._mk('div', 'presets');
  $.toolbar = el._mk('div', 'toolbar');
  $.spectrum = el._mk('div', 'spectrum', { attrs: { role: 'img', 'aria-label': el.t('spectrumAria') } });
  $.trackwrap = el._mk('div', 'track-wrap');
  $.track = el._mk('div', 'track', { attrs: { role: 'list' } });
  $.footer = region(el, 'footer', 'footer');
  $.weekBottom = el._mk('div', 'week-bar-slot');
  $.live = el._mk('div', 'sr', { attrs: { role: 'status', 'aria-live': 'polite' } });
  $.dialog = el._mk('dialog', 'dialog');
  attachDrag(el);

  const credits = creditsEl(el);
  root.append($.header, $.weekTop, $.presets, $.toolbar, $.spectrum, $.trackwrap, $.footer, $.weekBottom, ...(credits ? [credits] : []), $.live, $.dialog);
  userStyles(el, root);

  if (el._root && el._root.parentNode) el._root.remove();
  el._root = root;
  host.append(root);
  renderData(el);
}

function creditsEl(el) {
  const mode = el.creditsMode;
  if (mode === 'off') return null;
  const c = el._mk('div', 'credits');
  const a = el._mk('a', 'credits-link', { text: el.t('credits'), attrs: { href: REPO, target: '_blank', rel: 'noopener' } });
  c.append(a);
  if (mode === 'support') c.append(el._mk('a', 'credits-donate', { text: el.t('donate'), attrs: { href: DONATE, target: '_blank', rel: 'noopener' } }));
  return c;
}

// ------------------------------------------------------------------ data render
export function renderData(el) {
  const $ = el._$;
  if (!$.root) return;
  $.root.dataset.orient = el.resolvedOrientation;
  $.root.setAttribute('aria-busy', el._state.status === 'loading' ? 'true' : 'false');
  $.root.setAttribute('aria-label', el.t(el.weekMode ? 'titleWeek' : 'title'));
  renderWeekBar(el);
  renderPresets(el);
  renderToolbar(el);
  renderTrack(el);
  updateNow(el, true);
  if (el._focusHandle) {
    const h = $.track.querySelector(`[data-handle][data-slot-id="${CSS.escape(el._focusHandle)}"]:not([data-alias])`);
    if (h) h.focus();
    el._focusHandle = null;
  }
  if (el._focusTab) {
    const t = $.root.querySelector(`[data-day="${el._focusTab}"]`);
    if (t) t.focus();
    el._focusTab = null;
  }
}

// ------------------------------------------------------------------ week bar
function dayCarry(el, day) {
  const view = el._weekView();
  const c = carrySlotFor(view, day, el._days);
  return c;
}

function dayPieces(el, day) {
  const slots = el._slotsOf(day);
  const c = dayCarry(el, day);
  return buildLayout(slots, { cyclic: false, carry: c && c.slot }).pieces;
}

function slotColor(el, slot) {
  const m = el.modelOf(slot.model);
  const c = modelPreview(m, el.modelIndex(slot.model), slot.values, slot);
  return m && m.off ? 'color-mix(in srgb, currentColor 18%, transparent)' : c;
}

function renderWeekBar(el) {
  const { weekTop, weekBottom } = el._$;
  weekTop.replaceChildren(); weekBottom.replaceChildren();
  weekTop.hidden = weekBottom.hidden = true;
  if (!el.weekMode) return;
  const pos = el.cfg.week === 'bottom' ? weekBottom : weekTop;
  pos.hidden = false;
  pos.replaceChildren(weekBar(el));
}

function weekBar(el) {
  const cfg = el.cfg, t = el.t;
  const bar = el._mk('div', 'week-bar');
  const prev = el._mk('button', 'week-prev', { generic: ['button'], text: '‹', attrs: { 'aria-label': t('prevDay') } });
  const next = el._mk('button', 'week-next', { generic: ['button'], text: '›', attrs: { 'aria-label': t('nextDay') } });
  prev.onclick = () => el.prevDay();
  next.onclick = () => el.nextDay();
  const tabs = el._mk('div', 'week-tablist', { attrs: { role: 'tablist', 'aria-label': t('weekLabel') } });
  const nowDay = el.nowDay;
  const order = el.dayOrder;
  for (const d of order) {
    const selected = d === el._sel;
    const slots = el._slotsOf(d);
    const ref = isWeek(el._value) && el._value.week[d] && el._value.week[d].ref;
    const linked = ref ? el._days.find((x) => x.id === ref) : null;
    const states = [];
    if (selected) states.push('week-tab-selected');
    if (d === nowDay) states.push('week-tab-today');
    if (ref) states.push('week-tab-linked');
    if (!slots.length) states.push('week-tab-empty');
    const summary = slots.length ? slots.slice(0, 4).map((s) => `${el.fmt(parseTime(s.time))} ${el.label(el.modelOf(s.model), s.model)}`).join(', ') + (slots.length > 4 ? '...' : '') : t('empty');
    const tab = el._mk('button', 'week-tab', {
      states,
      attrs: {
        role: 'tab', id: `${el._uid}-tab-${d}`, 'aria-selected': selected ? 'true' : 'false', 'aria-controls': `${el._uid}-panel`,
        tabindex: selected ? '0' : '-1', 'aria-label': t('weekTabAria', { day: el.dayName(d), summary }), 'data-day': d,
        title: linked ? t('linkedTo', { name: linked.name }) : null,
      },
    });
    if (d === nowDay) tab.setAttribute('aria-current', 'date');
    if (d === nowDay) tab.dataset.today = '';
    if (!slots.length) tab.dataset.empty = '';
    if (ref) tab.dataset.linked = '';
    const custom = el._renderer('weekTab', { day: d, label: el.dayName(d, 'short'), slots: clone(slots), selected, today: d === nowDay, linked: linked ? clone(linked) : undefined });
    if (!applyRendered(tab, custom)) {
      tab.append(
        el._mk('span', 'week-tab-long', { class: 'dr-tab-long', text: el.dayName(d, 'short') }),
        el._mk('span', 'week-tab-short', { class: 'dr-tab-short', text: el.dayName(d, 'narrow') }),
      );
      if (cfg.weekPreview) {
        const pv = el._mk('span', 'week-tab-preview');
        const stops = gradientStops(dayPieces(el, d), (s) => slotColor(el, s));
        if (stops) pv.style.background = `linear-gradient(90deg,${stops})`;
        tab.append(pv);
      }
    }
    tab.onclick = () => el.selectDay(d);
    tabs.append(tab);
  }
  tabs.onkeydown = (e) => {
    const i = order.indexOf(el._sel);
    let n = null;
    if (e.key === 'ArrowRight') n = order[(i + 1) % 7];
    else if (e.key === 'ArrowLeft') n = order[(i + 6) % 7];
    else if (e.key === 'Home') n = order[0];
    else if (e.key === 'End') n = order[6];
    if (n) { e.preventDefault(); el._focusTab = n; el.selectDay(n); }
  };
  bar.append(prev, tabs, next);
  if (cfg.weekCopy && !cfg.readonly) {
    const cp = el._mk('button', 'week-copy', { generic: ['button'], text: t('copyDayTo') });
    cp.onclick = () => openCopy(el);
    bar.append(cp);
  }
  bar.append(region(el, 'week-extra', 'week-extra'));
  return bar;
}

// ------------------------------------------------------------------ presets / saved days
function renderPresets(el) {
  const box = el._$.presets;
  box.replaceChildren();
  const cfg = el.cfg;
  const showP = cfg.showPresets && (cfg.presets || []).length > 0 && !cfg.readonly;
  const showD = el.hasDaysArea && !cfg.readonly;
  box.hidden = !(showP || showD);
  if (box.hidden) return;
  const t = el.t;
  if (showP) {
    box.append(el._mk('div', 'presets-label', { text: t('presetsLabel') }));
    const groups = new Map();
    for (const p of cfg.presets) { const g = p.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); }
    for (const [g, list] of groups) {
      const row = el._mk('div', 'presets-group');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center';
      if (g) row.append(el._mk('span', 'presets-label', { text: t.has('group.' + g) ? t('group.' + g) : g }));
      for (const p of list) row.append(presetChip(el, p));
      box.append(row);
    }
  }
  if (showD) {
    box.append(el._mk('div', 'presets-label', { text: t('daysLabel') }));
    const row = el._mk('div', 'presets-group');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center';
    for (const d of el._days) row.append(dayChip(el, d));
    if (!el._days.length) row.append(el._mk('span', 'presets-label', { text: '-' }));
    box.append(row);
  }
}

function presetChip(el, p) {
  const busy = el._busy && el._busy.has(p.id);
  const b = el._mk('button', 'preset', { states: busy ? ['preset-busy'] : [], attrs: { 'aria-busy': busy ? 'true' : 'false', 'data-preset': p.id } });
  const custom = el._renderer('preset', { preset: p, busy: !!busy });
  if (!applyRendered(b, custom)) {
    if (p.icon) { const i = el._mk('span', 'model-icon'); fillIcon(i, p.icon); b.append(i); }
    b.append(document.createTextNode(el.t.has('preset.' + p.id) ? el.t('preset.' + p.id) : p.label || p.id));
  }
  b.onclick = () => applyPreset(el, p);
  return b;
}

function dayChip(el, d) {
  const wrap = el._mk('span', 'preset-row');
  wrap.style.cssText = 'display:inline-flex;gap:.2rem;align-items:center;flex-wrap:wrap';
  if (el._confirmDel === d.id) {
    wrap.append(el._mk('span', 'error', { text: el.t('deleteDayConfirm', { name: d.name }) }));
    const yes = el._mk('button', 'button', { generic: ['button', 'button-danger'], text: el.t('confirm') });
    const no = el._mk('button', 'button', { generic: ['button'], text: el.t('cancel') });
    yes.onclick = () => { el._confirmDel = null; el._deleteDay(d); };
    no.onclick = () => { el._confirmDel = null; el._schedule('data'); };
    wrap.append(yes, no);
    queueMicrotask(() => no.focus());
    return wrap;
  }
  const b = el._mk('button', 'preset', { attrs: { 'data-day-id': d.id } });
  b.textContent = d.name;
  b.onclick = () => applySlots(el, 'day', d.id, d.slots);
  const x = el._mk('button', 'preset-delete', { attrs: { 'aria-label': `${el.t('deleteDay')}: ${d.name}` }, text: '×' });
  x.onclick = () => { el._confirmDel = d.id; el._schedule('data'); };
  wrap.append(b, x);
  return wrap;
}

async function applyPreset(el, p) {
  el._busy = el._busy || new Set();
  if (el._busy.has(p.id)) return;
  el._busy.add(p.id);
  renderPresets(el);
  let slots;
  try {
    if (typeof p.slots === 'function') slots = await p.slots();
    else if (Array.isArray(p.slots)) slots = p.slots;
    else if (p.slotsUrl) {
      const r = await fetch(p.slotsUrl);
      if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
      slots = await r.json();
    } else slots = [];
  } catch (error) {
    el._fire('error', { source: 'preset', error });
    el._say(el.t('presetFailed'));
    slots = null;
  }
  el._busy.delete(p.id);
  renderPresets(el);
  if (slots) applySlots(el, 'preset', p.id, slots);
}

function applySlots(el, kind, id, slots) {
  const weekly = el.weekMode;
  const ev = el._fire('dayselect', { kind, id, slots: clone(slots), ...(weekly ? { day: el._sel } : {}) }, true);
  if (ev.defaultPrevented) return;
  if (weekly && kind === 'day' && el.cfg.linkDays) { el.assignDay(el._sel, { ref: id }); return; }
  const fresh = (slots || []).filter((s) => s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)).map((s) => {
    const n = { ...clone(s), id: genId() };
    const rv = resolveValues(n, el.models);
    if (rv) n.values = rv;
    return n;
  });
  el._edit(weekly ? el._sel : null, () => ({ slots: normalizeDay(fresh) }), { source: kind });
}

// ------------------------------------------------------------------ toolbar
function renderToolbar(el) {
  const box = el._$.toolbar;
  box.replaceChildren();
  const cfg = el.cfg, t = el.t;
  const main = el._mk('div', 'toolbar-main');
  if (!cfg.readonly) {
    if (cfg.add) {
      const b = el._mk('button', 'add', { generic: ['button'], text: '+ ' + t('add') });
      b.disabled = el._badWeek;
      b.onclick = () => { const s = el.addSlot(); if (s) queueMicrotask(() => el.focusSlot(s.id)); };
      main.append(b);
    }
    if (cfg.randomize) {
      const b = el._mk('button', 'randomize', { generic: ['button'], text: t('randomize') });
      b.onclick = () => el.randomize();
      main.append(b);
    }
    if (el.hasDaysArea) {
      const b = el._mk('button', 'preset-save', { generic: ['button'], text: t('saveDay') });
      b.onclick = () => openSaveDay(el);
      main.append(b);
    }
  }
  box.append(main, region(el, 'toolbar', 'toolbar-extra'));
  box.hidden = !cfg.add && !cfg.randomize && !el.hasDaysArea && !(el._slotted.toolbar || []).length;
  if (cfg.readonly && !(el._slotted.toolbar || []).length) box.hidden = true;
}

// ------------------------------------------------------------------ track
function handleFor(el, slot, index, seam, bounds, orient) {
  const time = el.fmt(parseTime(slot.time));
  const name = nameOf(el, slot, index);
  const h = el._mk('div', 'handle', { states: seam ? ['handle-seam'] : [] });
  h.setAttribute('role', 'slider');
  h.tabIndex = 0;
  h.setAttribute('aria-orientation', orient);
  if (bounds) {
    h.setAttribute('aria-valuemin', bounds.lo);
    h.setAttribute('aria-valuemax', bounds.hi);
  }
  h.setAttribute('aria-valuenow', parseTime(slot.time));
  h.setAttribute('aria-valuetext', time);
  h.setAttribute('aria-label', seam ? el.t('seamHandle', { time }) : el.t('slotStartOf', { name }));
  h.setAttribute('aria-description', el.t('slotHandleHint', { snap: el._snap }));
  h.dataset.handle = '';
  h.dataset.slotId = slot.id;
  const grip = el._mk('span', 'handle-grip');
  grip.setAttribute('aria-hidden', 'true');
  const bubble = el._mk('span', 'handle-time', { text: time });
  bubble.setAttribute('aria-hidden', 'true');
  h.append(grip, bubble);
  return h;
}

function slotCtx(el, slot, range, index, count, day, extra) {
  const model = el.modelOf(slot.model) || { id: slot.model, label: el.t('unknownModel', { id: slot.model }), unknown: true };
  return {
    slot: clone(slot), model, values: slot.values, index, count, start: el.fmt(range.start), end: el.fmt(range.end), duration: range.duration,
    day, active: el._active === slot.id, invalid: !!extra.invalid, readonly: !!el.cfg.readonly, t: el.t, preview: extra.preview,
  };
}

function cardFor(el, p, info) {
  const { ranges, index, count, day, invalid, carry } = info;
  const slot = p.slot;
  const model = el.modelOf(slot.model);
  const preview = modelPreview(model, el.modelIndex(slot.model), slot.values, slot);
  const states = [];
  if (p.kind === 'tail') states.push('slot-tail');
  if (p.kind === 'carry') states.push('slot-carry');
  const active = el._active === slot.id;
  if (active) states.push('slot-active');
  if (invalid || !model) states.push('slot-invalid');
  if (p.kind === 'main' && isLocked(slot, 'time') && isLocked(slot, 'remove')) states.push('slot-locked');
  const card = el._mk(p.kind === 'carry' ? 'button' : 'div', 'slot', { states, class: model && model.classes });
  card.dataset.slotId = slot.id;
  card.dataset.piece = p.key;
  if (active) card.dataset.active = '';
  if (invalid || !model) card.dataset.invalid = '';
  if (model && model.off) card.dataset.off = '';
  card.style.flex = `${p.dur} 1 0`;
  if (p.dur <= 0) card.dataset.zero = '';

  const tint = el._mk('span', 'slot-tint');
  tint.style.background = preview;
  card.append(tint);

  if (p.kind === 'tail') { card.setAttribute('aria-hidden', 'true'); return card; }
  const content = el._mk('div', 'slot-content');
  if (p.kind === 'carry') {
    const dn = el.dayName(carry.day);
    card.setAttribute('aria-label', el.t('goToDay', { day: dn }) + ': ' + el.t('carryFrom', { day: dn }));
    const ic = el._mk('span', 'slot-icon');
    fillIcon(ic, model && model.icon);
    content.append(ic, el._mk('span', 'slot-label', { text: el.t('carryFrom', { day: dn }) }));
    card.append(content);
    card.onclick = () => el.selectDay(carry.day);
    return card;
  }
  const r = ranges.find((x) => x.slot.id === slot.id);
  const ctx = slotCtx(el, slot, r, index, count, day, { invalid: invalid || !model, preview });
  const mname = el.label(model, slot.model);
  const summary = modelSummary(model, slot.values, slot, el.t);
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-label', el.t('slotAria', { name: nameOf(el, slot, index), start: el.fmt(r.start), end: el.fmt(r.end), model: mname }));
  if (active) card.setAttribute('aria-current', 'true');
  if (!applyRendered(content, el._renderer('slotContent', ctx))) {
    const time = el._mk('span', 'slot-time', { text: el.fmt(r.start), attrs: { 'data-dr': 'time' } });
    const label = el._mk('span', 'slot-label');
    if (!applyRendered(label, el._renderer('slotLabel', ctx))) label.textContent = nameOf(el, slot, index);
    const ro = el.cfg.readonly;
    const mb = el._mk(ro ? 'span' : 'button', 'slot-model', { attrs: ro ? {} : { 'aria-label': `${nameOf(el, slot, index)}: ${el.t('changeModel')} (${mname})`, 'data-open': slot.id } });
    const ic = el._mk('span', 'slot-icon');
    if (!applyRendered(ic, el._renderer('modelIcon', ctx))) fillIcon(ic, model && model.icon);
    mb.append(ic, el._mk('span', 'slot-model-name', { text: mname }));
    if (summary) mb.append(el._mk('span', 'slot-summary', { text: summary }));
    content.append(time, label, mb);
  }
  card.append(content);
  if (el.cfg.readonly) card.tabIndex = 0;
  return card;
}

function stateBox(el, kind) {
  const b = el._mk('div', 'state', { attrs: { role: kind === 'error' ? 'alert' : 'status' } });
  if (kind === 'loading') b.textContent = el.t('loading');
  else if (kind === 'error') {
    b.append(el._mk('span', 'error', { text: el.t('loadFailed', { error: (el._state.error && el._state.error.message) || '' }) }));
    const r = el._mk('button', 'button', { generic: ['button'], text: el.t('retry') });
    r.onclick = () => el.reloadData();
    b.append(r);
  } else {
    b.append(document.createTextNode(el.t('empty')));
    if (!el.cfg.readonly && el.cfg.add && !el._badWeek) {
      const a = el._mk('button', 'add', { generic: ['button'], text: '+ ' + el.t('add') });
      a.onclick = () => el.addSlot();
      b.append(a);
    } else b.append(region(el, 'empty', 'empty'));
  }
  return b;
}

export function renderTrack(el, o = {}) {
  const $ = el._$;
  const cfg = el.cfg;
  const weekly = el.weekMode;
  const orient = el.resolvedOrientation;
  el._pieceEls = new Map();
  $.trackwrap.removeAttribute('role');
  if (el._state.status !== 'idle') {
    $.spectrum.hidden = true;
    $.trackwrap.replaceChildren(stateBox(el, el._state.status));
    return;
  }
  const slots = el._displaySlots();
  const day = weekly ? el._sel : undefined;
  const carry = weekly ? carrySlotFor(el._weekView(), day, el._days) : null;
  if (!slots.length && !carry) {
    $.spectrum.hidden = true;
    $.trackwrap.replaceChildren(stateBox(el, 'empty'));
    el._layout = { origin: 0, pieces: [] };
    return;
  }
  $.spectrum.hidden = !cfg.spectrum;
  if (weekly) {
    $.trackwrap.setAttribute('role', 'tabpanel');
    $.trackwrap.id = `${el._uid}-panel`;
    $.trackwrap.setAttribute('aria-labelledby', `${el._uid}-tab-${el._sel}`);
  }
  const layout = buildLayout(slots, { cyclic: !weekly, origin: weekly ? 'midnight' : cfg.origin === 'midnight' ? 'midnight' : 'first', carry: carry && carry.slot, frozen: o.frozen });
  el._layout = layout;
  const ranges = slotRanges(slots, { cyclic: !weekly });
  const issues = new Set(validateDay(slots, { minGap: el._minGap, cyclic: !weekly }).map((i) => i.id));
  const bounds = {};
  for (const s of slots) bounds[s.id] = boundaryBounds(slots, s.id, { minGap: el._minGap, cyclic: !weekly });
  const track = $.track;
  track.replaceChildren();
  track.dataset.orient = orient;
  track.style.setProperty('--n', layout.pieces.length);
  track.setAttribute('aria-label', el.t(weekly ? 'titleWeek' : 'title'));
  const frag = document.createDocumentFragment();
  const canDrag = !cfg.readonly && !el._badWeek;
  layout.pieces.forEach((p) => {
    const idx = slots.findIndex((s) => s.id === p.slot.id);
    if (canDrag && p.kind === 'main' && !isLocked(p.slot, 'time')) {
      const seam = !weekly && idx === 0;
      if (!(seam && cfg.seamDrag === false)) frag.append(handleFor(el, p.slot, idx, seam, bounds[p.slot.id], orient));
    }
    if (canDrag && p.key === 'tail-end') {
      const h = handleFor(el, p.slot, 0, true, bounds[p.slot.id], orient);
      h.dataset.alias = '';
      h.removeAttribute('role'); h.removeAttribute('tabindex');
      h.setAttribute('aria-hidden', 'true');
      frag.append(h);
    }
    const card = cardFor(el, p, { ranges, index: idx, count: slots.length, day, invalid: issues.has(p.slot.id), carry });
    el._pieceEls.set(p.key, card);
    frag.append(card);
  });
  track.append(frag);
  $.trackwrap.replaceChildren(track);
  // spectrum
  $.spectrum.replaceChildren(...layout.pieces.map((p) => {
    const seg = el._mk('span', 'spectrum-segment');
    seg.style.flex = `${p.dur} 1 0`;
    seg.style.background = slotColor(el, p.slot);
    seg.dataset.piece = p.key;
    return seg;
  }));
  const spectrum = $.spectrum;
  el._segEls = new Map([...spectrum.children].map((s) => [s.dataset.piece, s]));
  // open editor
  track.onclick = (e) => {
    const b = e.target.closest && e.target.closest('[data-open]');
    if (b) openEditor(el, b.dataset.open);
  };
}

// ------------------------------------------------------------------ now / active
export function updateNow(el, force) {
  const $ = el._$;
  if (!$.track) return;
  const cfg = el.cfg;
  const n = nowOf(cfg);
  if (!force && el._nowDay && el._nowDay !== n.day) { el._nowDay = n.day; renderData(el); return; }
  el._nowDay = n.day;
  let info = null;
  if (isWeek(el._value)) info = activeSlotAtWeek(el._value, { day: n.day, time: n.minutes }, { days: el._days });
  else info = activeSlotAtDay(el._value, n.minutes);
  el._active = info ? info.slot.id : null;
  for (const card of $.track.querySelectorAll('.dr-slot')) {
    const on = card.dataset.slotId === el._active;
    setState(el, card, 'slot-active', on, 'active');
    if (on && card.dataset.piece && card.dataset.piece.startsWith('main:')) card.setAttribute('aria-current', 'true');
    else card.removeAttribute('aria-current');
  }
  if ($.nowLine) { $.nowLine.remove(); $.nowLine = null; }
  if (!cfg.nowLine || !el._layout || el._frozen) return;
  if (el.weekMode && el._sel !== n.day) return;
  const at = pieceAt(el._layout, n.minutes);
  const card = at && el._pieceEls && el._pieceEls.get(at.piece.key);
  if (!card) return;
  const line = el._mk('div', 'now-line', { attrs: { role: 'img', 'aria-label': el.t('nowAria', { time: el.fmt(n.minutes) }) } });
  const pct = `${(at.frac * 100).toFixed(3)}%`;
  if (el.resolvedOrientation === 'horizontal') line.style.left = pct; else line.style.top = pct;
  line.append(el._mk('span', 'now-badge', { text: el.t('nowLabel') }));
  card.append(line);
  $.nowLine = line;
}
