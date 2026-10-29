// Strip track, cards, handles, rows and now-line updates.
import { parseTime } from '../../core/time.js';
import { slotRanges, boundaryBounds, isLocked, clone } from '../../core/slots.js';
import { validateDay } from '../../core/validate.js';
import { isWeek, carrySlotFor, activeSlotAtWeek } from '../../core/week.js';
import { activeSlotAtDay } from '../../core/active.js';
import { buildLayout, pieceAt } from '../layout.js';
import { modelPreview, modelSummary } from '../model.js';
import { nowOf } from '../clock.js';
import { applyRendered, fillIcon, camel, classList } from '../dom.js';
import { openEditor } from '../dialog.js';
import { region } from './root.js';
import { slotColor } from './weekbar.js';
import { renderDial, updateDial } from '../dial.js';

export function setState(el, node, token, on, dataKey) {
  if (node.part) node.part.toggle(token, !!on);
  node.classList.toggle('dr-' + token, !!on);
  for (const c of classList((el.cfg.classes || {})[camel(token)])) node.classList.toggle(c, !!on);
  if (dataKey) { if (on) node.dataset[dataKey] = ''; else delete node.dataset[dataKey]; }
}

export function nameOf(el, slot, index) { return slot.label || el.t('slotDefault', { n: index + 1 }); }

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
  card.style.setProperty('--dr-slot-color', preview);
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

function fillTrack(el, track, slots, layout, { weekly, day, carry, orient }) {
  const cfg = el.cfg;
  const ranges = slotRanges(slots, { cyclic: !weekly });
  const issues = new Set(validateDay(slots, { minGap: el._minGap, cyclic: !weekly }).map((i) => i.id));
  const bounds = {};
  for (const s of slots) bounds[s.id] = boundaryBounds(slots, s.id, { minGap: el._minGap, cyclic: !weekly });
  const pieceEls = new Map();
  track.replaceChildren();
  track.dataset.orient = orient;
  track.style.setProperty('--n', layout.pieces.length);
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
    pieceEls.set(p.key, card);
    frag.append(card);
  });
  track.append(frag);
  return pieceEls;
}

export function renderTrack(el, o = {}) {
  const $ = el._$;
  const cfg = el.cfg;
  const weekly = el.weekMode;
  const orient = el.resolvedOrientation;
  el._pieceEls = new Map();
  el._rows = null;
  $.trackwrap.removeAttribute('role');
  delete $.trackwrap.dataset.rows;
  if (el._state.status !== 'idle') {
    $.spectrum.hidden = true;
    $.trackwrap.replaceChildren(stateBox(el, el._state.status));
    el._dial = null;
    $.dial = null;
    return;
  }
  if (cfg.layout === 'dial') { renderDial(el); return; }
  el._dial = null;
  $.dial = null;
  if (el.weekRows) { renderRows(el); return; }
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
  const track = $.track;
  track.setAttribute('aria-label', el.t(weekly ? 'titleWeek' : 'title'));
  el._pieceEls = fillTrack(el, track, slots, layout, { weekly, day, carry, orient });
  $.trackwrap.replaceChildren(track);
  $.spectrum.replaceChildren(...layout.pieces.map((p, i, all) => {
    const seg = el._mk('span', 'spectrum-segment');
    const color = slotColor(el, p.slot);
    seg.style.flex = `${p.dur} 1 0`;
    seg.style.background = color;
    seg.style.setProperty('--dr-slot-color', color);
    seg.style.setProperty('--dr-next-color', slotColor(el, all[(i + 1) % all.length].slot));
    seg.dataset.piece = p.key;
    seg.dataset.slotId = p.slot.id;
    if ((el.modelOf(p.slot.model) || {}).off) seg.dataset.off = '';
    return seg;
  }));
  el._segEls = new Map([...$.spectrum.children].map((s) => [s.dataset.piece, s]));
  track.onclick = (e) => {
    const b = e.target.closest && e.target.closest('[data-open]');
    if (b) openEditor(el, b.dataset.open);
  };
}

function renderRows(el) {
  const $ = el._$;
  $.spectrum.hidden = true;
  $.trackwrap.dataset.rows = '';
  const box = el._mk('div', 'week-rows', { attrs: { role: 'group', 'aria-label': el.t('titleWeek') } });
  const axis = el._mk('div', 'week-axis', { attrs: { 'aria-hidden': 'true' } });
  const ticks = el._mk('div', 'week-axis-ticks');
  for (const h of [0, 6, 12, 18, 24]) {
    const tk = el._mk('span', 'week-axis-tick', { text: String(h) });
    tk.style.left = `${(h / 24) * 100}%`;
    ticks.append(tk);
  }
  axis.append(el._mk('span', 'week-axis-spacer'), ticks);
  box.append(axis);
  el._rows = new Map();
  const nowDay = el.nowDay;
  const view = el._weekView();
  for (const d of el.dayOrder) {
    const selected = d === el._sel;
    const states = [];
    if (selected) states.push('week-row-selected');
    if (d === nowDay) states.push('week-row-today');
    const row = el._mk('div', 'week-row', { states });
    row.dataset.day = d;
    if (selected) row.dataset.selected = '';
    if (d === nowDay) row.dataset.today = '';
    const lab = el._mk('button', 'week-row-day', { text: el.dayName(d, 'short'), attrs: { 'aria-pressed': selected ? 'true' : 'false', 'aria-label': el.dayName(d), 'data-day': d } });
    lab.onclick = () => el.selectDay(d);
    const slots = el._slotsOf(d);
    const c = carrySlotFor(view, d, el._days);
    const track = el._mk('div', 'track', { attrs: { role: 'list', 'aria-label': el.dayName(d) } });
    track.dataset.rowDay = d;
    const layout = buildLayout(slots, { cyclic: false, carry: c && c.slot });
    const pieceEls = fillTrack(el, track, slots, layout, { weekly: true, day: d, carry: c, orient: 'horizontal' });
    el._rows.set(d, { layout, pieceEls, segEls: null });
    if (selected) { el._layout = layout; el._pieceEls = pieceEls; }
    row.append(lab, track);
    box.append(row);
  }
  box.onclick = (e) => {
    const b = e.target.closest && e.target.closest('[data-open]');
    if (!b) return;
    const row = b.closest('[data-row-day]');
    if (row && row.dataset.rowDay !== el._sel) el.selectDay(row.dataset.rowDay);
    openEditor(el, b.dataset.open);
  };
  $.trackwrap.replaceChildren(box);
}

export function updateNow(el, force) {
  const $ = el._$;
  if (!$.track) return;
  const cfg = el.cfg;
  const n = nowOf(cfg);
  if (!force && el._nowDay && el._nowDay !== n.day) { el._nowDay = n.day; el._schedule('data'); return; }
  el._nowDay = n.day;
  let info = null;
  if (isWeek(el._value)) info = activeSlotAtWeek(el._value, { day: n.day, time: n.minutes }, { days: el._days });
  else info = activeSlotAtDay(el._value, n.minutes);
  el._active = info ? info.slot.id : null;
  if ($.dial) { updateDial(el, n, info); return; }
  for (const card of $.trackwrap.querySelectorAll('.dr-slot')) {
    const on = card.dataset.slotId === el._active;
    setState(el, card, 'slot-active', on, 'active');
    if (on && card.dataset.piece && card.dataset.piece.startsWith('main:')) card.setAttribute('aria-current', 'true');
    else card.removeAttribute('aria-current');
  }
  if (el._segEls) for (const seg of el._segEls.values()) setState(el, seg, 'spectrum-segment-active', seg.dataset.slotId === el._active, 'active');
  if ($.nowLine) { $.nowLine.remove(); $.nowLine = null; }
  if (!cfg.nowLine || !el._layout || el._frozen) return;
  let layout = el._layout, pieceEls = el._pieceEls;
  if (el._rows) {
    const r = el._rows.get(n.day);
    if (!r) return;
    ({ layout, pieceEls } = r);
  } else if (el.weekMode && el._sel !== n.day) return;
  const at = pieceAt(layout, n.minutes);
  const card = at && pieceEls && pieceEls.get(at.piece.key);
  if (!card) return;
  const line = el._mk('div', 'now-line', { attrs: { role: 'img', 'aria-label': el.t('nowAria', { time: el.fmt(n.minutes) }) } });
  const pct = `${(at.frac * 100).toFixed(3)}%`;
  if (el._rows || el.resolvedOrientation === 'horizontal') line.style.left = pct; else line.style.top = pct;
  if (at.frac > 0.5) line.dataset.flip = '';
  line.append(el._mk('span', 'now-dot'), el._mk('span', 'now-badge', { text: el.t('nowLabel') }));
  card.append(line);
  $.nowLine = line;
}
