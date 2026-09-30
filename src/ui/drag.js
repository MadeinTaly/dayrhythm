// Pointer + keyboard editing of slot start times. Arithmetic only while dragging; one rAF per frame.
import { parseTime, formatTime } from '../core/time.js';
import { moveBoundary, sortSlots, boundaryBounds } from '../core/slots.js';

export function attachDrag(el) {
  const track = el._$.track;
  track.addEventListener('pointerdown', (e) => onDown(el, e));
  track.addEventListener('keydown', (e) => onKey(el, e));
}

const handleOf = (e) => (e.target.closest ? e.target.closest('[data-handle]') : null);

function setFlex(node, dur) {
  if (!node) return;
  node.style.flex = `${Math.max(0, dur)} 1 0`;
  if (dur <= 0) node.dataset.zero = ''; else delete node.dataset.zero;
}

function onDown(el, e) {
  const h = handleOf(e);
  if (!h || h.hasAttribute('data-alias') || (e.button && e.button > 0) || el._drag) return;
  const id = h.dataset.slotId;
  const weekly = el.weekMode;
  const slots = sortSlots(el._displaySlots());
  const idx = slots.findIndex((s) => s.id === id);
  if (idx < 0) return;
  e.preventDefault();
  const track = el._$.track;
  const frozen = !weekly && idx === 0 && el.cfg.origin !== 'midnight';
  let handle = h;
  if (frozen) {
    el._frozen = true;
    el._renderTrack({ frozen: true });
    handle = track.querySelector(`[data-handle][data-slot-id="${CSS.escape(id)}"]:not([data-alias])`) || h;
  }
  const horiz = el.resolvedOrientation === 'horizontal';
  const rect = track.getBoundingClientRect();
  const hs = handle.getBoundingClientRect();
  const nHandles = track.querySelectorAll('[data-handle]').length;
  const len = (horiz ? rect.width : rect.height) - nHandles * (horiz ? hs.width : hs.height);
  const st = {
    id, weekly, day: weekly ? el._sel : null, slots0: slots, base: el._value, frozen, handle, horiz,
    ppm: Math.max(0.05, len / 1440), startPos: horiz ? e.clientX : e.clientY, pos: horiz ? e.clientX : e.clientY,
    startMin: parseTime(slots[idx].time), cur: parseTime(slots[idx].time), raf: 0,
    dur0: new Map(el._layout.pieces.map((p) => [p.key, p.dur])),
    alias: frozen ? track.querySelector('[data-handle][data-alias]') : null,
    firstId: slots[0].id, lastId: slots[slots.length - 1].id,
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

function frame(el, st) {
  st.raf = 0;
  if (el._drag !== st) return;
  const target = st.startMin + (st.pos - st.startPos) / st.ppm;
  const r = moveBoundary(st.slots0, st.id, target, { snap: el._snap, minGap: el._minGap, cyclic: !st.weekly });
  if (r.minutes === st.cur) return;
  st.cur = r.minutes;
  const delta = r.minutes - st.startMin;
  const durs = new Map(st.dur0);
  const bKey = 'main:' + st.id;
  const time = el.fmt(r.minutes);
  if (st.frozen) {
    const d = Math.max(0, delta), n = Math.max(0, -delta);
    durs.set('tail', d);
    durs.set('tail-end', n);
    const fk = 'main:' + st.firstId, lk = 'main:' + st.lastId;
    durs.set(fk, durs.get(fk) - d);
    durs.set(lk, durs.get(lk) - n);
    const early = delta < 0;
    if (st.handle) { if (early) st.handle.dataset.hide = ''; else delete st.handle.dataset.hide; }
    if (st.alias) { if (early) st.alias.dataset.dragging = ''; else delete st.alias.dataset.dragging; }
    const active = early ? st.alias : st.handle;
    const b = active && active.querySelector('.dr-handle-time');
    if (b) b.textContent = time;
  } else {
    const keys = el._layout.pieces.map((p) => p.key);
    const bi = keys.indexOf(bKey);
    const aKey = keys[bi - 1];
    if (aKey) durs.set(aKey, durs.get(aKey) + delta);
    durs.set(bKey, durs.get(bKey) - delta);
    const a = el._pieceEls.get(aKey), b = el._pieceEls.get(bKey);
    if (b) for (const n of b.querySelectorAll('[data-dr="time"],[data-dr="start"]')) n.textContent = time;
    if (a) for (const n of a.querySelectorAll('[data-dr="end"]')) n.textContent = time;
    const bub = st.handle.querySelector('.dr-handle-time');
    if (bub) bub.textContent = time;
    st.handle.setAttribute('aria-valuenow', r.minutes);
    st.handle.setAttribute('aria-valuetext', time);
  }
  for (const [k, v] of durs) { setFlex(el._pieceEls.get(k), v); setFlex(el._segEls && el._segEls.get(k), v); }
  if (st.frozen) { const b = el._pieceEls.get('main:' + st.id); if (b) for (const n of b.querySelectorAll('[data-dr="time"],[data-dr="start"]')) n.textContent = time; }
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
  if (cancel || st.cur === st.startMin) { el._schedule('data'); return; }
  const cyclic = !st.weekly;
  const ok = el._edit(st.day, (slots) => ({ slots: moveBoundary(slots, st.id, st.cur, { snap: el._snap, minGap: el._minGap, cyclic }).slots }), { source: 'drag', id: st.id });
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
  const slots = sortSlots(el._displaySlots());
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
  const r = moveBoundary(slots, id, target, { snap, minGap: el._minGap, cyclic });
  if (r.minutes === cur) { el._refuse('min-gap', id); return; }
  el._focusHandle = id;
  const ok = el._edit(weekly ? el._sel : null, (list) => ({ slots: moveBoundary(list, id, r.minutes, { snap, minGap: el._minGap, cyclic }).slots }), { source: 'keyboard', id });
  if (ok) {
    const now = Date.now();
    if (!el._lastMoveSay || now - el._lastMoveSay > 400) {
      el._lastMoveSay = now;
      el._say(el.t('moved', { name: s.label || el.t('slotDefault', { n: slots.indexOf(s) + 1 }), time: formatTime(r.minutes, { format: el.cfg.timeFormat }) }));
    }
  }
}
