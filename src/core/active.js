// Active slot of a daily schedule.
import { parseTime, minutesOf } from './time.js';
import { sortSlots, slotRanges } from './slots.js';

/** at: minutes | 'HH:MM[:SS]' | Date. Returns ActiveInfo | null. */
export function activeSlotAtDay(slots, at, opts) {
  if (!slots || !slots.length) return null;
  const m = minutesOf(at, opts);
  const ranges = slotRanges(sortSlots(slots));
  let idx = -1;
  for (let i = 0; i < ranges.length; i++) if (ranges[i].start <= m) idx = i;
  if (idx < 0) idx = ranges.length - 1;
  const r = ranges[idx];
  const elapsed = (((m - r.start) % 1440) + 1440) % 1440;
  return { slot: r.slot, index: idx, start: r.start, end: r.end, elapsed, remaining: r.duration - elapsed };
}

export function nextChangeDay(slots, at, opts) {
  if (!slots || slots.length < 2) return null;
  const m = minutesOf(at, opts);
  const info = activeSlotAtDay(slots, m);
  const ranges = slotRanges(sortSlots(slots));
  const next = ranges[(info.index + 1) % ranges.length];
  return { slot: next.slot, index: next.index, inMinutes: info.remaining };
}

export { parseTime };
