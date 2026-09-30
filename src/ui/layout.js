// Pure layout of a day into track pieces. A "piece" is one visual segment; a slot may have two
// (start piece + continuation across midnight / the axis seam). DOM-free.
import { parseTime } from '../core/time.js';
import { sortSlots, slotRanges } from '../core/slots.js';

/**
 * opts: { cyclic (daily true), origin: 'first'|'midnight', carry: Slot|null (weekly), frozen: minutes|null }
 * Returns { origin, pieces: [{ key, kind: 'main'|'tail'|'carry', slot, dur, start? }] }
 * `origin` = clock minute at the axis start.
 */
export function buildLayout(slotsIn, opts = {}) {
  const cyclic = opts.cyclic !== false;
  const slots = sortSlots(slotsIn);
  const n = slots.length;
  const pieces = [];
  if (!n) {
    if (!cyclic && opts.carry) pieces.push({ key: 'carry', kind: 'carry', slot: opts.carry, dur: 1440 });
    return { origin: 0, pieces };
  }
  const ranges = slotRanges(slots, { cyclic });
  const first = ranges[0], last = ranges[n - 1];
  const mainDur = (r) => (r.index === n - 1 && r.end > 1440 ? 1440 - r.start : r.duration);
  if (!cyclic) {
    if (opts.carry) pieces.push({ key: 'carry', kind: 'carry', slot: opts.carry, dur: first.start });
    for (const r of ranges) pieces.push({ key: 'main:' + r.slot.id, kind: 'main', slot: r.slot, dur: r.duration, start: r.start });
    return { origin: 0, pieces };
  }
  if (opts.origin === 'midnight') {
    pieces.push({ key: 'tail', kind: 'tail', slot: last.slot, dur: first.start });
    for (const r of ranges) pieces.push({ key: 'main:' + r.slot.id, kind: 'main', slot: r.slot, dur: mainDur(r), start: r.start });
    return { origin: 0, pieces };
  }
  // origin = first slot
  if (opts.frozen) pieces.push({ key: 'tail', kind: 'tail', slot: last.slot, dur: 0 });
  for (const r of ranges) pieces.push({ key: 'main:' + r.slot.id, kind: 'main', slot: r.slot, dur: r.duration, start: r.start });
  if (opts.frozen) pieces.push({ key: 'tail-end', kind: 'tail', slot: first.slot, dur: 0 });
  return { origin: first.start, pieces };
}

/** Piece containing clock minute `m` (float) and the fraction inside it. */
export function pieceAt(layout, m) {
  let a = (((m - layout.origin) % 1440) + 1440) % 1440;
  for (const p of layout.pieces) {
    if (p.dur > 0 && a < p.dur) return { piece: p, frac: a / p.dur };
    a -= p.dur;
  }
  const p = layout.pieces.filter((x) => x.dur > 0).pop();
  return p ? { piece: p, frac: 1 } : null;
}

/** Colour-strip gradient stops for the week tab preview. `colorOf(slot)` -> css colour. */
export function gradientStops(pieces, colorOf) {
  const total = pieces.reduce((s, p) => s + p.dur, 0) || 1;
  let acc = 0;
  const stops = [];
  for (const p of pieces) {
    if (p.dur <= 0) continue;
    const c = colorOf(p.slot);
    const a = ((acc / total) * 100).toFixed(2), b = (((acc + p.dur) / total) * 100).toFixed(2);
    stops.push(`${c} ${a}% ${b}%`);
    acc += p.dur;
  }
  return stops.join(',');
}

export { parseTime };
