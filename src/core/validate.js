import { tryParseTime, WEEKDAYS } from './time.js';
import { slotRanges } from './slots.js';
import { isWeek, isRef, resolveWeek } from './week.js';

const msg = {
  'time-format': (s) => `Slot ${s.id || ''} has an invalid time "${s.time}"`,
  'duplicate-time': (s) => `Another slot already starts at ${s.time}`,
  'min-gap': (s, x) => `Slot ${s.id || s.time} lasts ${x} min, below the minimum`,
  'unknown-model': (s) => `Unknown model "${s.model}"`,
  'missing-ref': (_s, x) => `Saved day "${x}" not found`,
};

export function validateDay(slots, opts = {}) {
  const { minGap = 30, models, cyclic = true } = opts;
  const issues = [];
  const good = [];
  const seen = new Set();
  for (const s of slots || []) {
    const m = tryParseTime(s.time);
    if (m == null) { issues.push({ id: s.id, code: 'time-format', message: msg['time-format'](s) }); continue; }
    if (seen.has(m)) issues.push({ id: s.id, code: 'duplicate-time', message: msg['duplicate-time'](s) });
    seen.add(m);
    good.push(s);
    if (models && !models.some((x) => x.id === s.model)) issues.push({ id: s.id, code: 'unknown-model', message: msg['unknown-model'](s) });
  }
  if (good.length > 1) {
    slotRanges(good, { cyclic }).forEach((r, i, a) => {
      if ((cyclic || i < a.length - 1) && r.duration < minGap && r.duration > 0) {
        issues.push({ id: r.slot.id, code: 'min-gap', message: msg['min-gap'](r.slot, r.duration) });
      }
    });
  }
  return issues;
}

export function validateWeek(value, opts = {}) {
  const issues = [];
  const week = (isWeek(value) ? value.week : {}) || {};
  const r = resolveWeek(value, opts.days);
  for (const d of WEEKDAYS) {
    if (isRef(week[d]) && !(opts.days || []).some((x) => x.id === week[d].ref)) {
      issues.push({ day: d, code: 'missing-ref', message: msg['missing-ref'](null, week[d].ref) });
    }
    for (const i of validateDay(r[d], { ...opts, cyclic: false })) issues.push({ ...i, day: d });
  }
  return issues;
}
