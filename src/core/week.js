// Weekly helpers: week = seven days, slots carry over between days.
import { WEEKDAYS, minutesOf, weekdayOf, mod } from './time.js';
import { sortSlots, slotRanges, genId, clone } from './slots.js';

export function isWeek(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'week' in v;
}

const isRef = (e) => !!e && !Array.isArray(e) && typeof e === 'object' && typeof e.ref === 'string';
export { isRef };

/** Refs expanded. Unknown refs -> []. Always seven keys, each sorted. */
export function resolveWeek(value, days) {
  const week = (isWeek(value) ? value.week : value) || {};
  const out = {};
  for (const d of WEEKDAYS) {
    const e = week[d];
    let slots = [];
    if (Array.isArray(e)) slots = e;
    else if (isRef(e)) {
      const day = (days || []).find((x) => x.id === e.ref);
      slots = day ? day.slots : [];
    }
    out[d] = sortSlots(slots);
  }
  return out;
}

export function withDay(value, day, slotsOrRef) {
  return { ...value, week: { ...(value && value.week), [day]: slotsOrRef } };
}

export function orderedWeekdays(firstDay) {
  const i = Math.max(0, WEEKDAYS.indexOf(firstDay));
  return [...WEEKDAYS.slice(i), ...WEEKDAYS.slice(0, i)];
}

export function firstDayOfWeek(locale) {
  try {
    const l = new Intl.Locale(locale);
    const info = (l.getWeekInfo && l.getWeekInfo()) || l.weekInfo;
    if (info && info.firstDay) return WEEKDAYS[(info.firstDay - 1) % 7];
  } catch (e) { /* fall through */ }
  return 'mon';
}

export function expandTargets(to, from) {
  let list = Array.isArray(to) ? to : to === 'weekdays' ? WEEKDAYS.slice(0, 5) : to === 'weekend' ? WEEKDAYS.slice(5) : to === 'all' ? WEEKDAYS : [];
  return list.filter((d) => d !== from && WEEKDAYS.includes(d));
}

/** Pure "copy this day to...". Refs are copied as refs; slot ids regenerated (newIds, default true). */
export function copyDay(value, from, to, opts = {}) {
  const src = value && value.week ? value.week[from] : undefined;
  const week = { ...(value && value.week) };
  for (const d of expandTargets(to, from)) {
    if (isRef(src)) week[d] = { ref: src.ref };
    else {
      const slots = clone(src || []);
      week[d] = opts.newIds === false ? slots : slots.map((s) => ({ ...s, id: genId() }));
    }
  }
  return { ...value, week };
}

function entries(days) {
  const all = [];
  WEEKDAYS.forEach((d, di) => {
    slotRanges(days[d], { cyclic: false }).forEach((r) => {
      all.push({ slot: r.slot, day: d, dayIndex: di, index: r.index, start: r.start, abs: di * 1440 + r.start });
    });
  });
  return all;
}

/** Absolute ranges from Monday 00:00; the last one wraps to Monday (end > 10080). */
export function weekRanges(value, days) {
  const all = entries(resolveWeek(value, days));
  return all.map((e, i) => {
    const nextAbs = i < all.length - 1 ? all[i + 1].abs : all[0].abs + 10080;
    const end = all.length === 1 ? e.abs + 10080 : nextAbs;
    return { slot: e.slot, day: e.day, index: e.index, start: e.abs, end, duration: end - e.abs };
  });
}

function atToAbs(at, opts) {
  if (at instanceof Date) return { day: weekdayOf(at, opts), min: minutesOf(at, opts) };
  return { day: at.day, min: minutesOf(at.time, opts) };
}

export function activeSlotAtWeek(value, at, opts = {}) {
  const days = resolveWeek(value, opts.days);
  const all = entries(days);
  if (!all.length) return null;
  const a = atToAbs(at, opts);
  const di = WEEKDAYS.indexOf(a.day);
  const t = di * 1440 + a.min;
  let idx = -1;
  for (let i = 0; i < all.length; i++) if (all[i].abs <= t) idx = i;
  if (idx < 0) idx = all.length - 1;
  const e = all[idx];
  const nextAbs = all.length === 1 ? e.abs + 10080 : idx < all.length - 1 ? all[idx + 1].abs : all[0].abs + 10080;
  const duration = nextAbs - e.abs;
  const elapsed = mod(t - e.abs, 10080);
  return {
    slot: e.slot, index: e.index, start: e.start, end: e.start + duration, elapsed, remaining: duration - elapsed,
    day: e.day, dayOffset: 0 - mod(di - e.dayIndex, 7) || 0,
  };
}

export function nextChangeWeek(value, at, opts = {}) {
  const info = activeSlotAtWeek(value, at, opts);
  if (!info) return null;
  const all = entries(resolveWeek(value, opts.days));
  if (all.length < 2) return null;
  const i = all.findIndex((e) => e.slot === info.slot);
  const next = all[(i + 1) % all.length];
  return { slot: next.slot, day: next.day, inMinutes: info.remaining };
}

/** Slot shown as "carry" at the head of `day`: the last slot of the closest earlier non-empty day. */
export function carrySlotFor(value, day, days) {
  const r = resolveWeek(value, days);
  const di = WEEKDAYS.indexOf(day);
  for (let k = 1; k <= 7; k++) {
    const d = WEEKDAYS[mod(di - k, 7)];
    if (r[d].length) return { slot: r[d][r[d].length - 1], day: d };
  }
  return null;
}
