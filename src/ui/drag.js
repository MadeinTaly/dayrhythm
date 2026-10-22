// Pointer + keyboard editing of slot start times. Arithmetic only while dragging; one rAF per frame.
import { parseTime, formatTime } from '../core/time.js';
import { moveBoundary, pushBoundary, sortSlots, boundaryBounds, slotRanges } from '../core/slots.js';
import { buildLayout } from './layout.js';

export function attachDrag(el) {
  const wrap = el._$.trackwrap;
  wrap.addEventListener('pointerdown', (e) => onDown(el, e));
  wrap.addEventListener('keydown', (e) => onKey(el, e));
}

const handleOf = (e) => (e.target.closest ? e.target.closest('[data-handle]') : null);

function setFlex(node, dur) {
  if (!node) return;
  node.style.flex = `${Math.max(0, dur)} 1 0`;
  if (dur <= 0) node.dataset.zero = ''; else delete node.dataset.zero;
}

/** Day and layout context of the track a handle belongs to (week rows have one track per day). */
function trackCtx(el, h) {
  const track = h.parentElement;
  const rowDay = track && track.dataset.rowDay;
  if (rowDay && el._rows && el._rows.has(rowDay)) return { day: rowDay, track, ...el._rows.get(rowDay) };
  return { day: el.weekMode ? el._sel : null, track: el._$.track, layout: el._layout, pieceEls: el._pieceEls, segEls: el._segEls };
}

/** Move (or push, if enabled) the start of slot `id`. */
export function shift(el, slots, id, minutes, cyclic) {
  const o = { snap: el._snap, minGap: el._minGap, cyclic };
  return el.cfg.push === false ? moveBoundary(slots, id, minutes, o) : pushBoundary(slots, id, minutes, o);
}

function onDown(el, e) {
  const h = handleOf(e);
  if (!h || h.hasAttribute('data-alias') || 'dial' in h.dataset || (e.button && e.button > 0) || el._drag || el._hold) return;
  const hold = +el.cfg.touchHold;
  if (e.pointerType !== 'touch' || !(hold > 0)) { startDrag(el, e, h); return; }
  // Touch: the edge moves only after a still press, so a tap or a swipe that lands on it leaves it alone.
  const at = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, preventDefault() {} };
  const stop = () => {
    clearTimeout(timer);
    h.removeEventListener('pointermove', move);
    h.removeEventListener('pointerup', stop);
    h.removeEventListener('pointercancel', stop);
    el._hold = null;
  };
  const move = (ev) => {
    if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 10) stop();
    else { at.clientX = ev.clientX; at.clientY = ev.clientY; }
  };
  const timer = setTimeout(() => { stop(); if (h.isConnected && !el._drag) startDrag(el, at, h); }, hold);
  el._hold = stop;
  h.addEventListener('pointermove', move);
  h.addEventListener('pointerup', stop);
  h.addEventListener('pointercancel', stop);
}

function startDrag(el, e, h) {
  const id = h.dataset.slotId;
  const weekly = el.weekMode;
  const ctx = trackCtx(el, h);
  const slots = sortSlots(el._slotsOf(ctx.day));
  const idx = slots.findIndex((s) => s.id === id);
  if (idx < 0) return;
  e.preventDefault();
  const track = ctx.track;
  const frozen = !weekly && idx === 0 && el.cfg.origin !== 'midnight';
  let handle = h;
  if (frozen) {
    el._frozen = true;
    el._renderTrack({ frozen: true });
    ctx.layout = el._layout; ctx.pieceEls = el._pieceEls; ctx.segEls = el._segEls;
    handle = track.querySelector(`[data-handle][data-slot-id="${CSS.escape(id)}"]:not([data-alias])`) || h;
  }
  const horiz = track.dataset.orient === 'horizontal';
  const carry = ctx.layout.pieces.find((p) => p.kind === 'carry');
  // The two cards next to the dragged edge (and, at the seam, the wrap-around pieces) lose their minimum size
  // while dragging, so they follow their real duration and the edge can follow the finger down to `minGap`.
  const keys = ctx.layout.pieces.map((p) => p.key);
  const loose = new Set(['main:' + id]);
  const before = keys[keys.indexOf('main:' + id) - 1];
  if (before) loose.add(before);
  if (frozen) { loose.add('tail'); loose.add('tail-end'); const k = keys[keys.indexOf('tail-end') - 1]; if (k) loose.add(k); }
  for (const k of loose) { const n = ctx.pieceEls.get(k); if (n) n.dataset.dragmin = ''; }
  const st = {
    id, weekly, day: ctx.day, ctx, slots0: slots, base: el._value, frozen, handle, horiz, keys, loose,
    opts: weekly ? { cyclic: false, carry: carry && carry.slot } : { cyclic: true, origin: el.cfg.origin === 'midnight' ? 'midnight' : 'first' },
    origin: ctx.layout.origin, pos: horiz ? e.clientX : e.clientY,
    startMin: parseTime(slots[idx].time), cur: parseTime(slots[idx].time), raf: 0,
    durs: new Map(ctx.layout.pieces.map((p) => [p.key, p.dur])),
    alias: frozen ? track.querySelector('[data-handle][data-alias]') : null,
    last: null,
  };
  measure(st);
  st.grab = st.pos - edgePixel(st, st.durs, 'main:' + id);
  el._drag = st;
  el._liveBase = el._value;
  el._$.root.dataset.dragging = '';
  handle.dataset.dragging = '';
  try { handle.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  const move = (ev) => {
    st.pos = horiz ? ev.clientX : ev.clientY;
    if (!st.raf) st.raf = requestAnimationFrame(() => frame(el, st));
  };
  const up = (ev) => end(ev.type === 'pointercancel');
  const end = (cancel) => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
    handle.removeEventListener('lostpointercapture', lost);
    finish(el, st, cancel);
  };
  const lost = () => { if (el._drag === st) end(false); };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
  handle.addEventListener('lostpointercapture', lost);
}

const sizeOf = (st, r) => (st.horiz ? r.width : r.height);
const startOf = (st, r) => (st.horiz ? r.left : r.top);

/**
 * Snapshot of the track at drag start: total length of the cards, minimum size of each card and, for each edge,
 * the distance between the handle centre and the cards before it (handles and gaps, constant while dragging).
 */
function measure(st) {
  const { pieceEls, track } = st.ctx;
  void track.offsetHeight; // apply data-dragmin before measuring
  let avail = 0, normalMin = 0;
  st.mins = new Map();
  st.pads = new Map(); // padding + border along the axis: a flex item with basis 0 still takes that much
  for (const k of st.keys) {
    const n = pieceEls.get(k);
    if (!n) continue;
    avail += sizeOf(st, n.getBoundingClientRect());
    const c = getComputedStyle(n);
    const px = (a, b, c2, d) => (parseFloat(a) || 0) + (parseFloat(b) || 0) + (parseFloat(c2) || 0) + (parseFloat(d) || 0);
    st.pads.set(k, st.horiz ? px(c.paddingLeft, c.paddingRight, c.borderLeftWidth, c.borderRightWidth)
      : px(c.paddingTop, c.paddingBottom, c.borderTopWidth, c.borderBottomWidth));
    if (!st.loose.has(k) && !('zero' in n.dataset)) {
      const cs = getComputedStyle(n);
      normalMin = Math.max(normalMin, parseFloat(st.horiz ? cs.minWidth : cs.minHeight) || 0);
    }
  }
  for (const k of st.keys) st.mins.set(k, st.loose.has(k) ? 0 : normalMin);
  st.avail = avail;
  st.delta = new Map();
  for (const k of ['main:' + st.id, 'tail-end']) {
    const card = pieceEls.get(k);
    const h = card && card.previousElementSibling;
    if (!card || !h || !h.matches('[data-handle]')) continue;
    const hr = h.getBoundingClientRect();
    const centre = startOf(st, hr) + sizeOf(st, hr) / 2;
    st.delta.set(k, centre - cardsBefore(st, st.durs, k));
  }
}

/** Card sizes as the browser lays them out: flex-grow = duration, basis 0, with minimum sizes (CSS flexbox). */
function flexSizes(st, durs) {
  const items = st.keys.map((k) => {
    const g = Math.max(0, durs.get(k) || 0), base = st.pads.get(k) || 0;
    return { g, base, min: Math.max(base, g > 0 ? st.mins.get(k) : 0), size: base, frozen: g <= 0 };
  });
  for (let pass = 0; pass <= items.length; pass++) {
    let free = st.avail, grow = 0;
    for (const it of items) { if (it.frozen) free -= it.size; else { grow += it.g; free -= it.base; } }
    if (grow <= 0) break;
    let violation = 0;
    for (const it of items) if (!it.frozen) { it.t = it.base + (Math.max(0, free) * it.g) / grow; violation += Math.max(0, it.min - it.t); }
    if (violation <= 0) { for (const it of items) if (!it.frozen) it.size = it.t; break; }
    for (const it of items) if (!it.frozen && it.t < it.min) { it.frozen = true; it.size = it.min; }
  }
  return items.map((it) => it.size);
}

/** Total size of the cards before card `key` (the dragged edge sits right after them). */
function cardsBefore(st, durs, key) {
  const sizes = flexSizes(st, durs);
  let acc = 0;
  for (let i = 0; i < st.keys.length && st.keys[i] !== key; i++) acc += sizes[i];
  return acc;
}

/** Screen position of the handle in front of card `key` for these durations. */
function edgePixel(st, durs, key) {
  return cardsBefore(st, durs, key) + (st.delta.get(key) || 0);
}

/** Result of dragging to axis minute `a` (0..1440 from the origin): slots, minutes, durations, edge pixel. */
function candidate(el, st, a) {
  let target = st.origin + a;
  if (st.frozen && target >= 1440) target -= 1440;
  const r = shift(el, st.slots0, st.id, target, !st.weekly);
  const durs = st.frozen ? frozenDurs(st, r.slots, r.minutes) : new Map(buildLayout(r.slots, st.opts).pieces.map((p) => [p.key, p.dur]));
  const key = st.frozen && r.minutes < st.origin ? 'tail-end' : 'main:' + st.id;
  return { r, durs, px: edgePixel(st, durs, key) };
}

/** The time whose edge lands under the finger (the edge pixel grows with the time: binary search). */
function solve(el, st) {
  const goal = st.pos - st.grab;
  let lo = 0, hi = 1440, best = candidate(el, st, lo), bestErr = Math.abs(best.px - goal);
  for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2, c = candidate(el, st, mid), err = Math.abs(c.px - goal);
    if (err < bestErr) { best = c; bestErr = err; }
    if (c.px < goal) lo = mid; else hi = mid;
  }
  const end = candidate(el, st, hi);
  if (Math.abs(end.px - goal) < bestErr) best = end;
  return best;
}

/** Piece durations with the dragged slot at `v` (frozen: fixed axis origin, see layout.js). */
function frozenDurs(st, slots, v) {
  const O = st.origin;
  const keys = ['tail', ...slots.map((s) => 'main:' + s.id), 'tail-end'];
  const at = [0, v >= O ? v - O : 0, ...slots.slice(1).map((s) => parseTime(s.time) - O), v < O ? v - O + 1440 : 1440, 1440];
  return new Map(keys.map((k, i) => [k, at[i + 1] - at[i]]));
}

function frame(el, st) {
  st.raf = 0;
  if (el._drag !== st) return;
  const cyclic = !st.weekly;
  const { r, durs } = solve(el, st);
  if (r.minutes === st.cur && st.last) return;
  st.cur = r.minutes;
  st.last = r.slots;
  const time = el.fmt(r.minutes);
  st.durs = durs;
  for (const [k, v] of durs) { setFlex(st.ctx.pieceEls.get(k), v); setFlex(st.ctx.segEls && st.ctx.segEls.get(k), v); }
  const ranges = slotRanges(r.slots, { cyclic });
  for (const rg of ranges) {
    const card = st.ctx.pieceEls.get('main:' + rg.slot.id);
    if (!card) continue;
    for (const n of card.querySelectorAll('[data-dr="time"],[data-dr="start"]')) n.textContent = el.fmt(rg.start);
    for (const n of card.querySelectorAll('[data-dr="end"]')) n.textContent = el.fmt(rg.end % 1440);
    const h = st.ctx.track.querySelector(`[data-handle][data-slot-id="${CSS.escape(rg.slot.id)}"]:not([data-alias])`);
    if (h) { h.setAttribute('aria-valuenow', rg.start); h.setAttribute('aria-valuetext', el.fmt(rg.start)); }
  }
  if (st.frozen) {
    const early = r.minutes < st.origin;
    if (early) st.handle.dataset.hide = ''; else delete st.handle.dataset.hide;
    if (st.alias) { if (early) st.alias.dataset.dragging = ''; else delete st.alias.dataset.dragging; }
    const b = (early ? st.alias : st.handle);
    const bub = b && b.querySelector('.dr-handle-time');
    if (bub) bub.textContent = time;
  } else {
    const bub = st.handle.querySelector('.dr-handle-time');
    if (bub) bub.textContent = time;
  }
  el._live(el._withDay(st.day, r.slots), { source: 'drag', id: st.id, ...(st.day ? { day: st.day } : {}) });
}

function finish(el, st, cancel) {
  if (el._drag !== st) return;
  if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
  delete el._$.root.dataset.dragging;
  for (const k of st.loose) { const n = st.ctx.pieceEls.get(k); if (n) delete n.dataset.dragmin; }
  el._drag = null;
  el._frozen = false;
  el._liveBase = null;
  el._value = st.base;
  el._syncForm();
  if (st.day && el._sel !== st.day) el.selectDay(st.day);
  if (cancel || st.cur === st.startMin) { el._schedule('data'); return; }
  const cyclic = !st.weekly;
  const ok = el._edit(st.day, (slots) => ({ slots: shift(el, slots, st.id, st.cur, cyclic).slots }), { source: 'drag', id: st.id });
  if (ok) {
    const s = el._locate(st.id);
    el._say(el.t('moved', { name: s && s.slot.label ? s.slot.label : el.t('slotDefault', { n: st.slots0.findIndex((x) => x.id === st.id) + 1 }), time: el.fmt(st.cur) }));
  } else el._schedule('data');
}

function onKey(el, e) {
  const h = handleOf(e);
  if (!h || h.hasAttribute('data-alias')) return;
  const snap = el._snap;
  const id = h.dataset.slotId;
  const weekly = el.weekMode;
  const { day } = trackCtx(el, h);
  const slots = sortSlots(el._slotsOf(day));
  const s = slots.find((x) => x.id === id);
  if (!s) return;
  const cur = parseTime(s.time);
  const cyclic = !weekly;
  const b = boundaryBounds(slots, id, { minGap: el._minGap, cyclic });
  const big = e.shiftKey ? 60 : snap;
  let target = null;
  switch (e.key) {
    case 'ArrowLeft': case 'ArrowDown': target = cur - big; break;
    case 'ArrowRight': case 'ArrowUp': target = cur + big; break;
    case 'PageUp': target = cur + 60; break;
    case 'PageDown': target = cur - 60; break;
    case 'Home': target = b.lo; break;
    case 'End': target = b.hi; break;
    default: return;
  }
  e.preventDefault();
  const r = shift(el, slots, id, target, cyclic);
  if (r.minutes === cur) { el._refuse('min-gap', id); return; }
  el._focusHandle = id;
  if (day && el._sel !== day) el.selectDay(day);
  const ok = el._edit(day, (list) => ({ slots: shift(el, list, id, r.minutes, cyclic).slots }), { source: 'keyboard', id });
  if (ok) {
    const now = Date.now();
    if (!el._lastMoveSay || now - el._lastMoveSay > 400) {
      el._lastMoveSay = now;
      el._say(el.t('moved', { name: s.label || el.t('slotDefault', { n: slots.indexOf(s) + 1 }), time: formatTime(r.minutes, { format: el.cfg.timeFormat }) }));
    }
  }
}
