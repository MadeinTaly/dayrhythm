/*! dayrhythm v0.8.1 | MIT | https://github.com/MadeinTaly/dayrhythm */

// src/core/time.js
var WEEKDAYS = Object.freeze(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
var TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
function parseTime(s) {
  const m = TIME_RE.exec(typeof s === "string" ? s : "");
  if (!m) throw new RangeError(`Invalid time "${s}" (expected HH:MM)`);
  return +m[1] * 60 + +m[2];
}
function tryParseTime(s) {
  const m = TIME_RE.exec(typeof s === "string" ? s : "");
  return m ? +m[1] * 60 + +m[2] : null;
}
var mod = (a, n) => (a % n + n) % n;
function formatTime(min, opts) {
  const m = mod(Math.round(min), 1440);
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  if (opts && opts.format === "12h") {
    const h12 = h % 12 || 12;
    return `${h12}:${mm} ${h < 12 ? "AM" : "PM"}`;
  }
  return `${String(h).padStart(2, "0")}:${mm}`;
}
var fmtCache = /* @__PURE__ */ new Map();
function zoned(date, timeZone) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    fmtCache.set(timeZone, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { h: +o.hour % 24, m: +o.minute, s: +o.second, wd: o.weekday.slice(0, 3).toLowerCase() };
}
function clockParts(date, opts) {
  if (opts && opts.timeZone) return zoned(date, opts.timeZone);
  if (opts && typeof opts.utcOffsetMinutes === "number") {
    const d = new Date(date.getTime() + opts.utcOffsetMinutes * 6e4);
    return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: WEEKDAYS[mod(d.getUTCDay() - 1, 7)] };
  }
  return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), wd: WEEKDAYS[mod(date.getDay() - 1, 7)] };
}
function minutesOf(at, opts) {
  if (typeof at === "number") return mod(at, 1440);
  if (at instanceof Date) {
    const c = clockParts(at, opts);
    return c.h * 60 + c.m + c.s / 60;
  }
  if (typeof at === "string") {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(at);
    if (!m || +m[1] > 23 || +m[2] > 59 || m[3] && +m[3] > 59) throw new RangeError(`Invalid time "${at}"`);
    return +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0);
  }
  throw new TypeError("minutesOf: expected string, number or Date");
}
function weekdayOf(at, opts) {
  return clockParts(at, opts).wd;
}

// src/core/slots.js
var counter = 0;
function genId() {
  counter = (counter + 1) % 1679616;
  return "s" + Math.floor(Math.random() * 46656).toString(36).padStart(3, "0") + counter.toString(36);
}
var clone = (o) => o === void 0 ? o : JSON.parse(JSON.stringify(o));
function sortSlots(slots) {
  return slots.map((s, i) => [s, i, tryParseTime(s.time)]).sort((a, b) => (a[2] ?? 1e9) - (b[2] ?? 1e9) || a[1] - b[1]).map((e) => e[0]);
}
function normalizeDay(slots, opts) {
  const ids = !opts || opts.ids !== false;
  return sortSlots((slots || []).map((s) => ids && !s.id ? { ...s, id: genId() } : { ...s }));
}
function slotRanges(slots, opts) {
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
function resolveValues(slot, models) {
  const model = models && models.find((m) => m.id === slot.model);
  if (!model) return slot.values ? { ...slot.values } : void 0;
  const fd = {};
  for (const f of model.fields || []) if (f.default !== void 0) fd[f.key] = f.default;
  const base = { ...fd, ...model.defaults || {} };
  const has = Object.keys(base).length > 0;
  if (!has && !slot.values) return void 0;
  return { ...base, ...slot.values || {} };
}
var snapTo = (m, snap) => snap > 1 ? Math.round(m / snap) * snap : Math.round(m);
function addSlotAt(slots, opts = {}) {
  const { minGap = 30, snap = 5, maxSlots = null, cyclic = true } = opts;
  const sorted = sortSlots(slots);
  if (maxSlots != null && sorted.length >= maxSlots) return { error: "max-slots" };
  let time = null;
  let source = opts.template;
  if (opts.time != null) {
    time = typeof opts.time === "number" ? mod(opts.time, 1440) : parseTime(opts.time);
  } else if (sorted.length) {
    const ranges = slotRanges(sorted, { cyclic });
    let best = ranges[0];
    for (const r of ranges) if (r.duration > best.duration) best = r;
    if (best.duration < minGap * 2) return { error: "min-gap" };
    time = mod(snapTo(best.start + best.duration / 2, snap), 1440);
    if (!source) source = best.slot;
  } else time = 0;
  if (sorted.some((s) => parseTime(s.time) === time)) return { error: "duplicate-time" };
  if (sorted.length) {
    const ranges = slotRanges(sorted, { cyclic });
    const under = ranges.find((r) => time >= r.start && time < r.end || time + 1440 >= r.start && time + 1440 < r.end);
    if (under) {
      if (!source) source = under.slot;
      const off = time >= under.start ? time : time + 1440;
      if (off - under.start < minGap || under.end - off < minGap) return { error: "min-gap" };
    } else if (!source) source = sorted[0];
    if (!cyclic) {
      const prev = ranges.filter((r) => r.start < time).pop();
      const next = ranges.find((r) => r.start > time);
      if (prev && time - prev.start < minGap || next && next.start - time < minGap) return { error: "min-gap" };
    }
  }
  const added = { id: opts.id || genId(), time: formatTime(time), model: opts.model || (source ? source.model : "on") };
  if (source && source.values && !opts.model) added.values = clone(source.values);
  if (opts.label) added.label = opts.label;
  return { slots: sortSlots([...sorted, added]), added };
}
function removeSlotById(slots, id, opts = {}) {
  const minSlots = opts.minSlots ?? 1;
  const target = slots.find((s) => s.id === id);
  if (!target) return slots.slice();
  if (isLocked(target, "remove")) return { error: "locked" };
  if (slots.length <= minSlots) return { error: "min-slots" };
  return slots.filter((s) => s.id !== id);
}
function isLocked(slot, what) {
  const l = slot && slot.locked;
  return l === true || Array.isArray(l) && l.includes(what);
}
function boundaryBounds(slots, id, opts = {}) {
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
function moveBoundary(slots, id, toMinutes, opts = {}) {
  const { snap = 5 } = opts;
  const s = sortSlots(slots);
  const b = boundaryBounds(s, id, opts);
  if (!b) return { slots: s, time: null, minutes: null, clamped: false };
  const cur = parseTime(s[b.index].time);
  const target = snapTo(toMinutes, snap);
  let v = target;
  if (b.lo > b.hi) v = cur;
  else v = Math.min(b.hi, Math.max(b.lo, target));
  const out = s.map((x, k) => k === b.index ? { ...x, time: formatTime(v) } : x);
  return { slots: out, time: formatTime(v), minutes: v, clamped: v !== target };
}
function pushBoundary(slots, id, toMinutes, opts = {}) {
  const { snap = 5, minGap = 30, cyclic = true } = opts;
  const s = sortSlots(slots);
  const n = s.length;
  const i = s.findIndex((x) => x.id === id);
  if (i < 0) return { slots: s, time: null, minutes: null, clamped: false, pushed: [] };
  const t = s.map((x) => parseTime(x.time));
  const cur = t[i];
  let lo, hi;
  if (cyclic && i === 0) lo = n > 1 ? Math.max(0, t[n - 1] + minGap - 1440) : 0;
  else {
    const first = cyclic ? 1 : 0;
    lo = cyclic ? t[0] + i * minGap : i * minGap;
    for (let j = i - 1; j >= first; j--) if (isLocked(s[j], "time")) {
      lo = t[j] + (i - j) * minGap;
      break;
    }
  }
  if (cyclic && i === 0) hi = 1439 - (n - 1) * minGap;
  else hi = (cyclic ? Math.min(1439, t[0] + 1440 - minGap) : 1439) - (n - 1 - i) * minGap;
  for (let j = i + 1; j < n; j++) if (isLocked(s[j], "time")) {
    hi = t[j] - (j - i) * minGap;
    break;
  }
  if (snap > 1) {
    lo = Math.ceil(lo / snap) * snap;
    hi = Math.floor(hi / snap) * snap;
  }
  const target = snapTo(toMinutes, snap);
  const v = lo > hi ? cur : Math.min(hi, Math.max(lo, target));
  const pushed = [];
  const out = s.map((x, k) => {
    let m = t[k];
    if (k === i) m = v;
    else if (k > i) m = Math.max(t[k], v + (k - i) * minGap);
    else if (!(cyclic && k === 0) && !(cyclic && i === 0)) m = Math.min(t[k], v - (i - k) * minGap);
    if (m === t[k] && k !== i) return x;
    if (k !== i) pushed.push(x.id);
    return { ...x, time: formatTime(m) };
  });
  return { slots: out, time: formatTime(v), minutes: v, clamped: v !== target, pushed };
}
function retimeSlot(slots, id, time, opts = {}) {
  const { minGap = 30, cyclic = true } = opts;
  const m = tryParseTime(time);
  if (m == null) return { error: "time-format" };
  const target = slots.find((s) => s.id === id);
  if (!target) return { error: "time-format" };
  if (slots.some((s) => s.id !== id && parseTime(s.time) === m)) return { error: "duplicate-time" };
  const next = sortSlots(slots.map((s) => s.id === id ? { ...s, time } : s));
  if (next.length > 1) {
    const r = slotRanges(next, { cyclic });
    const bad = r.some((x, k) => (cyclic || k < r.length - 1) && x.duration < minGap);
    if (bad) return { error: "min-gap" };
  }
  return { slots: next, time };
}

// src/core/active.js
function activeSlotAtDay(slots, at, opts) {
  if (!slots || !slots.length) return null;
  const m = minutesOf(at, opts);
  const ranges = slotRanges(sortSlots(slots));
  let idx = -1;
  for (let i = 0; i < ranges.length; i++) if (ranges[i].start <= m) idx = i;
  if (idx < 0) idx = ranges.length - 1;
  const r = ranges[idx];
  const elapsed = ((m - r.start) % 1440 + 1440) % 1440;
  return { slot: r.slot, index: idx, start: r.start, end: r.end, elapsed, remaining: r.duration - elapsed };
}
function nextChangeDay(slots, at, opts) {
  if (!slots || slots.length < 2) return null;
  const m = minutesOf(at, opts);
  const info = activeSlotAtDay(slots, m);
  const ranges = slotRanges(sortSlots(slots));
  const next = ranges[(info.index + 1) % ranges.length];
  return { slot: next.slot, index: next.index, inMinutes: info.remaining };
}

// src/core/week.js
function isWeek(v) {
  return !!v && typeof v === "object" && !Array.isArray(v) && "week" in v;
}
var isRef = (e) => !!e && !Array.isArray(e) && typeof e === "object" && typeof e.ref === "string";
function resolveWeek(value, days) {
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
function withDay(value, day, slotsOrRef) {
  return { ...value, week: { ...value && value.week, [day]: slotsOrRef } };
}
function orderedWeekdays(firstDay) {
  const i = Math.max(0, WEEKDAYS.indexOf(firstDay));
  return [...WEEKDAYS.slice(i), ...WEEKDAYS.slice(0, i)];
}
function firstDayOfWeek(locale) {
  try {
    const l = new Intl.Locale(locale);
    const info = l.getWeekInfo && l.getWeekInfo() || l.weekInfo;
    if (info && info.firstDay) return WEEKDAYS[(info.firstDay - 1) % 7];
  } catch (e) {
  }
  return "mon";
}
function expandTargets(to, from) {
  let list = Array.isArray(to) ? to : to === "weekdays" ? WEEKDAYS.slice(0, 5) : to === "weekend" ? WEEKDAYS.slice(5) : to === "all" ? WEEKDAYS : [];
  return list.filter((d) => d !== from && WEEKDAYS.includes(d));
}
function copyDay(value, from, to, opts = {}) {
  const src = value && value.week ? value.week[from] : void 0;
  const week = { ...value && value.week };
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
function weekRanges(value, days) {
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
function activeSlotAtWeek(value, at, opts = {}) {
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
    slot: e.slot,
    index: e.index,
    start: e.start,
    end: e.start + duration,
    elapsed,
    remaining: duration - elapsed,
    day: e.day,
    dayOffset: 0 - mod(di - e.dayIndex, 7) || 0
  };
}
function nextChangeWeek(value, at, opts = {}) {
  const info = activeSlotAtWeek(value, at, opts);
  if (!info) return null;
  const all = entries(resolveWeek(value, opts.days));
  if (all.length < 2) return null;
  const i = all.findIndex((e) => e.slot === info.slot);
  const next = all[(i + 1) % all.length];
  return { slot: next.slot, day: next.day, inMinutes: info.remaining };
}
function carrySlotFor(value, day, days) {
  const r = resolveWeek(value, days);
  const di = WEEKDAYS.indexOf(day);
  for (let k = 1; k <= 7; k++) {
    const d = WEEKDAYS[mod(di - k, 7)];
    if (r[d].length) return { slot: r[d][r[d].length - 1], day: d };
  }
  return null;
}

// src/core/validate.js
var msg = {
  "time-format": (s) => `Slot ${s.id || ""} has an invalid time "${s.time}"`,
  "duplicate-time": (s) => `Another slot already starts at ${s.time}`,
  "min-gap": (s, x) => `Slot ${s.id || s.time} lasts ${x} min, below the minimum`,
  "unknown-model": (s) => `Unknown model "${s.model}"`,
  "missing-ref": (_s, x) => `Saved day "${x}" not found`
};
function validateDay(slots, opts = {}) {
  const { minGap = 30, models, cyclic = true } = opts;
  const issues = [];
  const good = [];
  const seen = /* @__PURE__ */ new Set();
  for (const s of slots || []) {
    const m = tryParseTime(s.time);
    if (m == null) {
      issues.push({ id: s.id, code: "time-format", message: msg["time-format"](s) });
      continue;
    }
    if (seen.has(m)) issues.push({ id: s.id, code: "duplicate-time", message: msg["duplicate-time"](s) });
    seen.add(m);
    good.push(s);
    if (models && !models.some((x) => x.id === s.model)) issues.push({ id: s.id, code: "unknown-model", message: msg["unknown-model"](s) });
  }
  if (good.length > 1) {
    slotRanges(good, { cyclic }).forEach((r, i, a) => {
      if ((cyclic || i < a.length - 1) && r.duration < minGap && r.duration > 0) {
        issues.push({ id: r.slot.id, code: "min-gap", message: msg["min-gap"](r.slot, r.duration) });
      }
    });
  }
  return issues;
}
function validateWeek(value, opts = {}) {
  const issues = [];
  const week = (isWeek(value) ? value.week : {}) || {};
  const r = resolveWeek(value, opts.days);
  for (const d of WEEKDAYS) {
    if (isRef(week[d]) && !(opts.days || []).some((x) => x.id === week[d].ref)) {
      issues.push({ day: d, code: "missing-ref", message: msg["missing-ref"](null, week[d].ref) });
    }
    for (const i of validateDay(r[d], { ...opts, cyclic: false })) issues.push({ ...i, day: d });
  }
  return issues;
}

// src/core/index.js
function activeSlotAt(value, at, opts) {
  return isWeek(value) ? activeSlotAtWeek(value, at, opts) : activeSlotAtDay(value, at, opts);
}
function nextChange(value, at, opts) {
  return isWeek(value) ? nextChangeWeek(value, at, opts) : nextChangeDay(value, at, opts);
}
export {
  WEEKDAYS,
  activeSlotAt,
  addSlotAt,
  boundaryBounds,
  carrySlotFor,
  copyDay,
  expandTargets,
  firstDayOfWeek,
  formatTime,
  genId,
  isLocked,
  isRef,
  isWeek,
  minutesOf,
  mod,
  moveBoundary,
  nextChange,
  normalizeDay,
  orderedWeekdays,
  parseTime,
  pushBoundary,
  removeSlotById,
  resolveValues,
  resolveWeek,
  retimeSlot,
  slotRanges,
  sortSlots,
  tryParseTime,
  validateDay,
  validateWeek,
  weekRanges,
  weekdayOf,
  withDay
};
