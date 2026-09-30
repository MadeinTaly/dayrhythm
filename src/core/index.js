// dayrhythm/core - DOM-free helpers (Node, workers, Deno, Bun).
import { activeSlotAtDay, nextChangeDay } from './active.js';
import { isWeek, activeSlotAtWeek, nextChangeWeek } from './week.js';

export * from './time.js';
export {
  sortSlots, normalizeDay, slotRanges, resolveValues, addSlotAt, removeSlotById, moveBoundary,
  boundaryBounds, retimeSlot, isLocked, genId,
} from './slots.js';
export { validateDay, validateWeek } from './validate.js';
export {
  isWeek, isRef, resolveWeek, withDay, copyDay, weekRanges, orderedWeekdays, firstDayOfWeek, carrySlotFor, expandTargets,
} from './week.js';

/** Overloaded: array -> daily, {week} -> weekly. */
export function activeSlotAt(value, at, opts) {
  return isWeek(value) ? activeSlotAtWeek(value, at, opts) : activeSlotAtDay(value, at, opts);
}

export function nextChange(value, at, opts) {
  return isWeek(value) ? nextChangeWeek(value, at, opts) : nextChangeDay(value, at, opts);
}
