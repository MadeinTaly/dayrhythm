// Radial 24 h view (layout="dial"): one ring, arcs = slots, knobs = slot starts. Keyboard comes from drag.js
// (knobs are [data-handle] inside the track wrap); the pointer is handled here: angle -> minutes -> core.
import { parseTime } from '../core/time.js';
import { slotRanges, boundaryBounds, isLocked, sortSlots } from '../core/slots.js';
import { carrySlotFor } from '../core/week.js';
import { modelSummary } from './model.js';
import { openEditor } from './dialog.js';
import { shift } from './drag.js';
import { arcPath, pointAt, minutesAt } from './dial-geometry.js';
import { slotColor } from './render/weekbar.js';
import { nameOf } from './render/track.js';

let RI = 62, RO = 88, RK = 75; // ring radii; a skin may set --dr-dial-inner / --dr-dial-outer (viewBox units, read at render)
const NS = 'http://www.w3.org/2000/svg';
let uid = 0; // gradient ids must be unique per element instance (same document id space in light DOM)

function svg(tag, part, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  if (part) { n.setAttribute('class', part.split(' ').map((p) => 'dr-' + p).join(' ')); n.setAttribute('part', part); }
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
}

/** Ranges of a shown day; a weekly day starts with the slot carried over from the day before. */
function rangesOf(el, slots, weekly) {
  const ranges = slotRanges(slots, { cyclic: !weekly });
  const c = weekly && carrySlotFor(el._weekView(), el._sel, el._days);
  const first = ranges.length ? ranges[0].start : 1440;
  if (c && first > 0) ranges.unshift({ slot: c.slot, start: 0, end: first, carry: true });
  return ranges;
}

function ringRadii(box) {
  const cs = getComputedStyle(box);
  const num = (n, d) => { const v = parseFloat(cs.getPropertyValue(n)); return Number.isFinite(v) ? v : d; };
  RI = num('--dr-dial-inner', 62); RO = num('--dr-dial-outer', 88);
  if (RI < 10 || RO > 96 || RI > RO - 4) { RI = 62; RO = 88; }
  RK = (RI + RO) / 2;
}

export function renderDial(el) {
  const $ = el._$;
  const weekly = el.weekMode;
  const slots = el._displaySlots();
  const ranges = rangesOf(el, slots, weekly);
  $.spectrum.hidden = true;
  const box = el._mk('div', 'dial');
  $.trackwrap.replaceChildren(box);
  ringRadii(box);
  const root = svg('svg', 'dial-svg', { viewBox: '0 0 200 200', role: 'group', 'aria-label': el.t(weekly ? 'titleWeek' : 'title') });
  root.append(svg('circle', 'dial-ring', { cx: 100, cy: 100, r: (RI + RO) / 2, fill: 'none', 'stroke-width': RO - RI }));
  const defs = svg('defs'), arcs = svg('g'), knobs = svg('g');
  el._dialUid = el._dialUid || ++uid;
  root.append(defs);
  const ticks = svg('g', 'dial-ticks');
  for (let h = 0; h < 24; h++) {
    for (const q of [1, 2, 3]) {
      const m = pointAt(h * 60 + q * 15, RO + 3), n = pointAt(h * 60 + q * 15, RO + 4.2);
      ticks.append(svg('line', 'dial-tick-minor', { x1: m.x, y1: m.y, x2: n.x, y2: n.y }));
    }
    const a = pointAt(h * 60, RO + 3), b = pointAt(h * 60, RO + (h % 6 ? 5 : 8));
    ticks.append(svg('line', 'dial-tick', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
    if (h % 6 === 0) {
      const p = pointAt(h * 60, RO + 14);
      const t = svg('text', 'dial-tick-label', { x: p.x, y: p.y, 'aria-hidden': 'true' });
      t.textContent = el.fmt(h * 60);
      ticks.append(t);
    }
  }
  root.append(ticks);
  const now = svg('line', 'dial-now dial-hand', { x1: 100, y1: 100, x2: 100, y2: 100 });
  const guide = svg('circle', 'dial-guide', { cx: 100, cy: 100, r: (RI + RO) / 2, fill: 'none' });
  const hub = svg('circle', 'dial-hub', { cx: 100, cy: 100, r: 2.5 });
  const center = svg('g', 'dial-center');
  const lines = ['dial-center-time', 'dial-center-label', 'dial-center-summary', 'dial-center-remaining'].map((p, i) => {
    const t = svg('text', p, { x: 100, y: [94, 106, 114, 121][i] });
    center.append(t);
    return t;
  });
  root.append(arcs, guide, now, hub, knobs, center);
  box.append(root);
  $.dial = { root, defs, arcs, knobs, now, hub, lines, ranges };
  el._dial = $.dial;
  drawArcs(el, ranges);
  if (!el.cfg.readonly && !el._badWeek) {
    const bounds = (s) => boundaryBounds(slots, s.id, { minGap: el._minGap, cyclic: !weekly });
    sortSlots(slots).forEach((s, i) => {
      if (isLocked(s, 'time') || (!weekly && i === 0 && el.cfg.seamDrag === false)) return;
      const b = bounds(s), m = parseTime(s.time), p = pointAt(m, RK), time = el.fmt(m);
      const k = svg('circle', 'dial-handle', {
        cx: p.x, cy: p.y, r: 6, tabindex: 0, role: 'slider', 'aria-valuemin': b.lo, 'aria-valuemax': b.hi, 'aria-valuenow': m,
        'aria-valuetext': time, 'aria-label': el.t('slotStartOf', { name: nameOf(el, s, i) }), 'aria-description': el.t('slotHandleHint', { snap: el._snap }),
        'data-handle': '', 'data-dial': '', 'data-slot-id': s.id,
      });
      knobs.append(k);
    });
  }
  root.addEventListener('pointerdown', (e) => onDown(el, e));
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-open]');
    if (a && !el.cfg.readonly) openEditor(el, a.dataset.open);
  });
  if (el._lastNow) updateDial(el, el._lastNow.n, el._lastNow.info);
}

function drawArcs(el, ranges) {
  const d = el._dial;
  d.arcs.replaceChildren();
  d.defs.replaceChildren();
  const grads = new Map(); // one radial gradient per distinct slot colour: inner a little darker, outer lighter (skins opt in with fill:var(--dr-arc-gradient))
  for (const r of ranges) {
    const active = el._active === r.slot.id;
    const p = svg('path', active ? 'dial-arc dial-arc-active' : 'dial-arc', {
      d: arcPath(r.start, r.end, RI, active ? RO + 4 : RO), 'data-slot-id': r.slot.id, 'data-open': r.carry ? null : r.slot.id,
    });
    const c = slotColor(el, r.slot);
    p.style.fill = c;
    const ok = p.style.fill; // gradients are not valid fills
    p.style.fill = '';
    p.style.setProperty('--dr-slot-color', c);
    p.style.setProperty('--dr-arc-fill', ok ? c : 'color-mix(in srgb, currentColor 30%, transparent)');
    if (ok) {
      if (!grads.has(c)) {
        const id = `dr-ag-${el._dialUid}-${grads.size}`, g = svg('radialGradient', null, { id, cx: 100, cy: 100, r: RO + 4, gradientUnits: 'userSpaceOnUse' });
        [[(RI - 2) / (RO + 4), 'black 18%'], [1, 'white 28%']].forEach(([o, mix]) => {
          const st = svg('stop', null, { offset: o });
          st.style.stopColor = `color-mix(in srgb, ${c}, ${mix})`;
          g.append(st);
        });
        d.defs.append(g);
        grads.set(c, id);
      }
      p.style.setProperty('--dr-arc-gradient', `url(#${grads.get(c)})`);
    }
    const m = el.modelOf(r.slot.model);
    if (m && m.off) p.dataset.off = '';
    d.arcs.append(p);
  }
}

export function updateDial(el, n, info) {
  const d = el._dial;
  if (!d) return;
  el._lastNow = { n, info };
  drawArcs(el, d.ranges);
  const showNow = el.cfg.nowLine && !el._drag && (!el.weekMode || el._sel === n.day);
  const tip = pointAt(n.minutes, RO + 2);
  d.now.setAttribute('x2', showNow ? tip.x : 100);
  d.now.setAttribute('y2', showNow ? tip.y : 100);
  d.now.style.display = d.hub.style.display = showNow ? '' : 'none';
  if (el._drag) return;
  const [time, label, summary, left] = d.lines;
  time.textContent = el.fmt(n.minutes);
  const slot = info && info.slot;
  const model = slot && el.modelOf(slot.model);
  label.textContent = slot ? (slot.label || el.label(model, slot.model)) : '';
  summary.textContent = slot ? modelSummary(model, slot.values, slot, el.t) : '';
  const rem = info && info.remaining;
  left.textContent = rem ? `-${Math.floor(rem / 60)}:${String(Math.round(rem % 60)).padStart(2, '0')}` : '';
}

function onDown(el, e) {
  const k = e.target.closest && e.target.closest('[data-dial]');
  if (!k || el._drag || (e.button && e.button > 0)) return;
  e.preventDefault();
  const id = k.dataset.slotId;
  const weekly = el.weekMode, day = weekly ? el._sel : null;
  const slots0 = sortSlots(el._slotsOf(day));
  const d = el._dial;
  const st = { id, cur: parseTime(slots0.find((s) => s.id === id).time) };
  const start = st.cur;
  el._drag = st;
  el._liveBase = el._value;
  const base = el._value;
  k.dataset.dragging = '';
  try { k.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  const pt = d.root.createSVGPoint();
  const move = (ev) => {
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(d.root.getScreenCTM().inverse());
    const r = shift(el, slots0, id, minutesAt(p.x, p.y), !weekly);
    if (r.minutes === st.cur) return;
    st.cur = r.minutes;
    d.ranges = rangesOf(el, r.slots, weekly);
    drawArcs(el, d.ranges);
    for (const s of r.slots) {
      const n = d.knobs.querySelector(`[data-slot-id="${CSS.escape(s.id)}"]`);
      if (!n) continue;
      const m = parseTime(s.time), q = pointAt(m, RK);
      n.setAttribute('cx', q.x); n.setAttribute('cy', q.y);
      n.setAttribute('aria-valuenow', m); n.setAttribute('aria-valuetext', el.fmt(m));
    }
    d.lines[0].textContent = el.fmt(r.minutes);
    el._live(el._withDay(day, r.slots), { source: 'drag', id, ...(day ? { day } : {}) });
  };
  const end = () => {
    k.removeEventListener('pointermove', move);
    k.removeEventListener('pointerup', end);
    k.removeEventListener('pointercancel', end);
    el._drag = null;
    el._liveBase = null;
    el._value = base;
    el._syncForm();
    if (st.cur === start || !el._edit(day, (list) => ({ slots: shift(el, list, id, st.cur, !weekly).slots }), { source: 'drag', id })) el._schedule('data');
  };
  k.addEventListener('pointermove', move);
  k.addEventListener('pointerup', end);
  k.addEventListener('pointercancel', end);
}
