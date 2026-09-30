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
  if (!h || h.hasAttribute('data-alias') || (e.button && e.button > 0) || el._drag) return;
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
  const st = {
    id, weekly, day: ctx.day, ctx, slots0: slots, base: el._value, frozen, handle, horiz,
    opts: weekly ? { cyclic: false, carry: carry && carry.slot } : { cyclic: true, origin: el.cfg.origin === 'midnight' ? 'midnight' : 'first' },
    origin: ctx.layout.origin, pos: horiz ? e.clientX : e.clientY,
    startMin: parseTime(slots[idx].time), cur: parseTime(slots[idx].time), raf: 0,
    durs: new Map(ctx.layout.pieces.map((p) => [p.key, p.dur])),
    alias: frozen ? track.querySelector('[data-handle][data-alias]') : null,
    last: null,
  };
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

/** Axis minutes (0..1440 from the layout origin) under screen position `pos`, read from the live pieces. */
function offsetAt(st, pos) {
  // before the first piece / after the last one the axis continues at the track's average scale
  const tr = st.ctx.track.getBoundingClientRect();
  const len = st.horiz ? tr.width : tr.height;
  const ppm = Math.max(0.05, len / 1440);
  let acc = 0, first = true, end = null;
  for (const p of st.ctx.layout.pieces) {
    const dur = st.durs.get(p.key);
    const node = st.ctx.pieceEls.get(p.key);
    if (!node || dur <= 0) continue;
    const r = node.getBoundingClientRect();
    const a0 = st.horiz ? r.left : r.top, a1 = st.horiz ? r.right : r.bottom;
    if (pos < a0) return first ? (pos - a0) / ppm : acc;
    if (pos <= a1) return acc + (a1 > a0 ? ((pos - a0) / (a1 - a0)) * dur : 0);
    acc += dur;
    first = false;
    end = a1;
  }
  return end == null ? acc : acc + (pos - end) / ppm;
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
  const a = offsetAt(st, st.pos);
  let target = st.origin + a;
  if (st.frozen && Math.abs(target - 1440 - st.cur) < Math.abs(target - st.cur)) target -= 1440;
  const cyclic = !st.weekly;
  const r = shift(el, st.slots0, st.id, target, cyclic);
  if (r.minutes === st.cur && st.last) return;
  st.cur = r.minutes;
  st.last = r.slots;
  const time = el.fmt(r.minutes);
  const durs = st.frozen ? frozenDurs(st, r.slots, r.minutes) : new Map(buildLayout(r.slots, st.opts).pieces.map((p) => [p.key, p.dur]));
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
