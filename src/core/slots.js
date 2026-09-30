// Daily slot helpers. Pure and immutable.
import { parseTime, tryParseTime, formatTime, mod } from './time.js';

let counter = 0;
export function genId() {
  counter = (counter + 1) % 1679616;
  return 's' + Math.floor(Math.random() * 46656).toString(36).padStart(3, '0') + counter.toString(36);
}

const clone = (o) => (o === undefined ? o : JSON.parse(JSON.stringify(o)));
export { clone };

export function sortSlots(slots) {
  return slots
    .map((s, i) => [s, i, tryParseTime(s.time)])
    .sort((a, b) => (a[2] ?? 1e9) - (b[2] ?? 1e9) || a[1] - b[1])
    .map((e) => e[0]);
}

/** Sorted copy; optionally assigns missing ids. Input is never mutated. */
export function normalizeDay(slots, opts) {
  const ids = !opts || opts.ids !== false;
  return sortSlots((slots || []).map((s) => (ids && !s.id ? { ...s, id: genId() } : { ...s })));
}

/** Ranges of a sorted day: `end` may exceed 1440 for the wrapping slot. cyclic=false: last ends at 1440. */
export function slotRanges(slots, opts) {
  const cyclic = !opts || opts.cyclic !== false;
  const s = sortSlots(slots);
  const n = s.length;
  return s.map((slot, index) => {
    const start = parseTime(slot.time);
    let end;
    if (index < n - 1) end = parseTime(s[index + 1].time);
    else end = cyclic ? parseTime(s[0].time) + 1440 : 1440;
    if (cyclic && n === 1) end = start + 1440;
    return { slot, index, start, end, duration: end - start };
  });
}

export function resolveValues(slot, models) {
  const model = models && models.find((m) => m.id === slot.model);
  if (!model) return slot.values ? { ...slot.values } : undefined;
  const fd = {};
  for (const f of model.fields || []) if (f.default !== undefined) fd[f.key] = f.default;
  const base = { ...fd, ...(model.defaults || {}) };
  const has = Object.keys(base).length > 0;
  if (!has && !slot.values) return undefined;
  return { ...base, ...(slot.values || {}) };
}

const snapTo = (m, snap) => (snap > 1 ? Math.round(m / snap) * snap : Math.round(m));

/**
 * Adds a slot. Without `time` the longest slot is split at its (snapped) midpoint.
 * opts: { time, minGap=30, snap=5, maxSlots, cyclic=true, template, id }
 */
export function addSlotAt(slots, opts = {}) {
  const { minGap = 30, snap = 5, maxSlots = null, cyclic = true } = opts;
  const sorted = sortSlots(slots);
  if (maxSlots != null && sorted.length >= maxSlots) return { error: 'max-slots' };
  let time = null;
  let source = opts.template;
  if (opts.time != null) {
    time = typeof opts.time === 'number' ? mod(opts.time, 1440) : parseTime(opts.time);
  } else if (sorted.length) {
    const ranges = slotRanges(sorted, { cyclic });
    let best = ranges[0];
    for (const r of ranges) if (r.duration > best.duration) best = r;
    if (best.duration < minGap * 2) return { error: 'min-gap' };
    time = mod(snapTo(best.start + best.duration / 2, snap), 1440);
    if (!source) source = best.slot;
  } else time = 0;
  if (sorted.some((s) => parseTime(s.time) === time)) return { error: 'duplicate-time' };
  if (sorted.length) {
    const ranges = slotRanges(sorted, { cyclic });
    const under = ranges.find((r) => (time >= r.start && time < r.end) || (time + 1440 >= r.start && time + 1440 < r.end));
    if (under) {
      if (!source) source = under.slot;
      const off = time >= under.start ? time : time + 1440;
      if (off - under.start < minGap || under.end - off < minGap) return { error: 'min-gap' };
    } else if (!source) source = sorted[0];
    // non-cyclic: gap to neighbours inside the day
    if (!cyclic) {
      const prev = ranges.filter((r) => r.start < time).pop();
      const next = ranges.find((r) => r.start > time);
      if ((prev && time - prev.start < minGap) || (next && next.start - time < minGap)) return { error: 'min-gap' };
    }
  }
  const added = { id: opts.id || genId(), time: formatTime(time), model: opts.model || (source ? source.model : 'on') };
  if (source && source.values && !opts.model) added.values = clone(source.values);
  if (opts.label) added.label = opts.label;
  return { slots: sortSlots([...sorted, added]), added };
}

export function removeSlotById(slots, id, opts = {}) {
  const minSlots = opts.minSlots ?? 1;
  const target = slots.find((s) => s.id === id);
  if (!target) return slots.slice();
  if (isLocked(target, 'remove')) return { error: 'locked' };
  if (slots.length <= minSlots) return { error: 'min-slots' };
  return slots.filter((s) => s.id !== id);
}

export function isLocked(slot, what) {
  const l = slot && slot.locked;
  return l === true || (Array.isArray(l) && l.includes(what));
}

/** Allowed [lo, hi] (minutes, clock day) for the start of slot `id`. */
export function boundaryBounds(slots, id, opts = {}) {
  const { minGap = 30, cyclic = true } = opts;
  const s = sortSlots(slots);
  const i = s.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const n = s.length;
  const t = (k) => parseTime(s[k].time);
  const lo = i > 0 ? t(i - 1) + minGap : cyclic ? Math.max(0, t(n - 1) + minGap - 1440) : 0;
  const hi = i < n - 1 ? t(i + 1) - minGap : cyclic ? Math.min(1439, t(0) + 1440 - minGap) : 1439;
  return { lo, hi, index: i };
}

/**
 * Moves the start of a slot, snapped then clamped. Never reorders.
 * Returns { slots, time: 'HH:MM', minutes, clamped }.
 */
export function moveBoundary(slots, id, toMinutes, opts = {}) {
  const { snap = 5 } = opts;
  const s = sortSlots(slots);
  const b = boundaryBounds(s, id, opts);
  if (!b) return { slots: s, time: null, minutes: null, clamped: false };
  const cur = parseTime(s[b.index].time);
  const target = snapTo(toMinutes, snap);
  let v = target;
  if (b.lo > b.hi) v = cur;
  else v = Math.min(b.hi, Math.max(b.lo, target));
  const out = s.map((x, k) => (k === b.index ? { ...x, time: formatTime(v) } : x));
  return { slots: out, time: formatTime(v), minutes: v, clamped: v !== target };
}

/** Changes a slot's time allowing a re-order (editor time field). */
export function retimeSlot(slots, id, time, opts = {}) {
  const { minGap = 30, cyclic = true } = opts;
  const m = tryParseTime(time);
  if (m == null) return { error: 'time-format' };
  const target = slots.find((s) => s.id === id);
  if (!target) return { error: 'time-format' };
  if (slots.some((s) => s.id !== id && parseTime(s.time) === m)) return { error: 'duplicate-time' };
  const next = sortSlots(slots.map((s) => (s.id === id ? { ...s, time } : s)));
  if (next.length > 1) {
    const r = slotRanges(next, { cyclic });
    const bad = r.some((x, k) => (cyclic || k < r.length - 1) && x.duration < minGap);
    if (bad) return { error: 'min-gap' };
  }
  return { slots: next, time };
}
