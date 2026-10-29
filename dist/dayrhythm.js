/*! dayrhythm v0.7.0 | MIT | https://github.com/MadeinTaly/dayrhythm */
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/version.js
var VERSION = "0.7.0";

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
var core_exports = {};
__export(core_exports, {
  WEEKDAYS: () => WEEKDAYS,
  activeSlotAt: () => activeSlotAt,
  addSlotAt: () => addSlotAt,
  boundaryBounds: () => boundaryBounds,
  carrySlotFor: () => carrySlotFor,
  copyDay: () => copyDay,
  expandTargets: () => expandTargets,
  firstDayOfWeek: () => firstDayOfWeek,
  formatTime: () => formatTime,
  genId: () => genId,
  isLocked: () => isLocked,
  isRef: () => isRef,
  isWeek: () => isWeek,
  minutesOf: () => minutesOf,
  mod: () => mod,
  moveBoundary: () => moveBoundary,
  nextChange: () => nextChange,
  normalizeDay: () => normalizeDay,
  orderedWeekdays: () => orderedWeekdays,
  parseTime: () => parseTime,
  pushBoundary: () => pushBoundary,
  removeSlotById: () => removeSlotById,
  resolveValues: () => resolveValues,
  resolveWeek: () => resolveWeek,
  retimeSlot: () => retimeSlot,
  slotRanges: () => slotRanges,
  sortSlots: () => sortSlots,
  tryParseTime: () => tryParseTime,
  validateDay: () => validateDay,
  validateWeek: () => validateWeek,
  weekRanges: () => weekRanges,
  weekdayOf: () => weekdayOf,
  withDay: () => withDay
});

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

// src/core/index.js
function activeSlotAt(value, at, opts) {
  return isWeek(value) ? activeSlotAtWeek(value, at, opts) : activeSlotAtDay(value, at, opts);
}
function nextChange(value, at, opts) {
  return isWeek(value) ? nextChangeWeek(value, at, opts) : nextChangeDay(value, at, opts);
}

// src/ui/config.js
var defaults = {
  name: "",
  models: [
    { id: "on", label: "On", preview: "#f5c542" },
    { id: "off", label: "Off", off: true }
  ],
  presets: [],
  days: [],
  load: null,
  storage: null,
  minGap: 5,
  snap: 5,
  minSlots: null,
  maxSlots: null,
  layout: "strip",
  origin: "first",
  seamDrag: true,
  push: true,
  orientation: "auto",
  breakpoint: 640,
  add: true,
  remove: true,
  rename: true,
  timeEdit: true,
  showPresets: true,
  showDays: true,
  spectrum: true,
  nowLine: true,
  clockOffset: 0,
  timezone: null,
  timeFormat: "24h",
  editor: "auto",
  randomize: false,
  readonly: false,
  disabled: false,
  labelMax: 40,
  touchHold: 300,
  week: "auto",
  day: null,
  firstDay: "auto",
  weekPreview: true,
  weekCopy: true,
  linkDays: false,
  weekLayout: "tabs",
  theme: "organic",
  colorScheme: "auto",
  locale: null,
  messages: {},
  classes: {},
  render: "shadow",
  inheritStyles: false,
  styles: null,
  credits: true
};
var ATTRS = {
  name: ["name", "str"],
  value: ["value", "json"],
  models: ["models", "json"],
  load: ["load", "json"],
  storage: ["storage", "json"],
  "min-gap": ["minGap", "int"],
  snap: ["snap", "int"],
  "min-slots": ["minSlots", "int"],
  "max-slots": ["maxSlots", "int"],
  layout: ["layout", "str"],
  origin: ["origin", "str"],
  "seam-drag": ["seamDrag", "toggle"],
  push: ["push", "toggle"],
  orientation: ["orientation", "str"],
  breakpoint: ["breakpoint", "int"],
  add: ["add", "toggle"],
  remove: ["remove", "toggle"],
  rename: ["rename", "toggle"],
  "time-edit": ["timeEdit", "toggle"],
  "show-presets": ["showPresets", "toggle"],
  "show-days": ["showDays", "toggle"],
  spectrum: ["spectrum", "toggle"],
  "now-line": ["nowLine", "toggle"],
  "clock-offset": ["clockOffset", "num"],
  timezone: ["timezone", "str"],
  "time-format": ["timeFormat", "str"],
  editor: ["editor", "str"],
  randomize: ["randomize", "bool"],
  readonly: ["readonly", "bool"],
  disabled: ["disabled", "bool"],
  "label-max": ["labelMax", "int"],
  "touch-hold": ["touchHold", "int"],
  week: ["week", "str"],
  day: ["day", "str"],
  "first-day": ["firstDay", "str"],
  "week-preview": ["weekPreview", "toggle"],
  "week-copy": ["weekCopy", "toggle"],
  "link-days": ["linkDays", "toggle"],
  "week-layout": ["weekLayout", "str"],
  theme: ["theme", "str"],
  "color-scheme": ["colorScheme", "str"],
  locale: ["locale", "str"],
  render: ["render", "str"],
  "inherit-styles": ["inheritStyles", "toggle"],
  styles: ["styles", "str"],
  credits: ["credits", "str"],
  messages: ["messages", "json"],
  classes: ["classes", "json"]
};
var META = /* @__PURE__ */ new Set(["$schema", "id", "title", "description", "renderers", "modelFilter", "clock", "value"]);
var KNOWN = /* @__PURE__ */ new Set([...Object.keys(defaults), ...META]);
function parseAttr(type, raw) {
  if (raw === null) return void 0;
  switch (type) {
    case "int": {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : void 0;
    }
    case "num": {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : void 0;
    }
    case "toggle":
      return !/^(false|off|0)$/i.test(raw.trim());
    case "bool":
      return !/^(false|off|0)$/i.test(raw.trim());
    case "json":
      return JSON.parse(raw);
    default:
      if (raw === "true") return true;
      if (raw === "false") return false;
      return raw;
  }
}
var isPlain = (v) => v !== null && typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function mergeConfig(...layers) {
  const out = {};
  for (const layer of layers) {
    if (!isPlain(layer)) continue;
    for (const k of Object.keys(layer)) {
      const v = layer[k];
      if (v === void 0) continue;
      out[k] = isPlain(v) && isPlain(out[k]) ? mergeConfig(out[k], v) : isPlain(v) ? mergeConfig(v) : Array.isArray(v) ? v.slice() : v;
    }
  }
  return out;
}
function jsonSafe(v) {
  if (v === void 0 || typeof v === "function" || typeof v === "symbol") return void 0;
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => {
    const r = jsonSafe(x);
    return r === void 0 ? null : r;
  });
  if (!isPlain(v)) return void 0;
  const out = {};
  for (const k of Object.keys(v)) {
    const r = jsonSafe(v[k]);
    if (r !== void 0) out[k] = r;
  }
  return Object.keys(out).length === 0 && Object.keys(v).length > 0 ? void 0 : out;
}
function normalizeCredits(c) {
  return c === false || c === "false" ? "off" : c === "support" ? "support" : "on";
}

// src/i18n/en.js
var en_default = {
  title: "Daily schedule",
  titleWeek: "Weekly schedule",
  presetsLabel: "Presets",
  daysLabel: "My days",
  saveDay: "Save this day",
  saveDayTitle: "Save day",
  dayName: "Day name",
  dayNamePlaceholder: "e.g. Summer",
  daySaved: "Day saved",
  deleteDay: "Delete day",
  deleteDayConfirm: 'Delete "{name}"?',
  confirm: "Confirm",
  cancel: "Cancel",
  close: "Close",
  done: "Done",
  add: "Add slot",
  remove: "Remove slot",
  randomize: "Shuffle models",
  slotDefault: "Slot {n}",
  slotName: "Slot name",
  slotTime: "Start time",
  slotStartOf: "Start of {name}",
  slotHandleHint: "Arrow keys move by {snap} minutes",
  seamHandle: "Start of the day cycle ({time})",
  slotAria: "{name}, {start} to {end}, {model}",
  changeModel: "Change setting",
  pickModel: "Setting for {name}",
  unknownModel: "Unknown ({id})",
  model: "Setting",
  nowLabel: "Now",
  nowAria: "Current time {time}",
  spectrumAria: "Preview of the day",
  weekLabel: "Week",
  prevDay: "Previous day",
  nextDay: "Next day",
  goToDay: "Go to {day}",
  dayView: "Showing {day}",
  weekTabAria: "{day}: {summary}",
  copyDayTo: "Copy to...",
  copyDayTitle: "Copy {day} to",
  copyWeekdays: "Weekdays",
  copyWeekend: "Weekend",
  copyAll: "All days",
  copyDone: "Copied to {days}",
  carryFrom: "Continues from {day}",
  linkedTo: 'Linked to "{name}"',
  detached: '{day} is no longer linked to "{name}"',
  "err.minGap": "Slots must last at least {minutes} minutes",
  "err.maxSlots": "At most {max} slots",
  "err.minSlots": "At least {min} slot is required",
  "err.duplicateTime": "Another slot already starts at {time}",
  "err.locked": "This slot is locked",
  "err.timeFormat": "Enter a time as HH:MM",
  "err.missingRef": "Saved day not found",
  moved: "{name} now starts at {time}",
  added: "Slot added",
  removed: "Slot removed",
  credits: "Made with dayrhythm",
  donate: "Support the project",
  empty: "No slots",
  loading: "Loading...",
  loadFailed: "Could not load the schedule: {error}",
  retry: "Retry",
  presetFailed: "Could not load the preset"
};

// src/i18n/it.js
var it_default = {
  title: "Programma giornaliero",
  titleWeek: "Programma settimanale",
  presetsLabel: "Preimpostazioni",
  daysLabel: "Le mie giornate",
  saveDay: "Salva questa giornata",
  saveDayTitle: "Salva giornata",
  dayName: "Nome della giornata",
  dayNamePlaceholder: "es. Estate",
  daySaved: "Giornata salvata",
  deleteDay: "Elimina giornata",
  deleteDayConfirm: 'Eliminare "{name}"?',
  confirm: "Conferma",
  cancel: "Annulla",
  close: "Chiudi",
  done: "Fatto",
  add: "Aggiungi fascia",
  remove: "Rimuovi fascia",
  randomize: "Mescola le impostazioni",
  slotDefault: "Fascia {n}",
  slotName: "Nome della fascia",
  slotTime: "Ora di inizio",
  slotStartOf: "Inizio di {name}",
  slotHandleHint: "Le frecce spostano di {snap} minuti",
  seamHandle: "Inizio del ciclo giornaliero ({time})",
  slotAria: "{name}, dalle {start} alle {end}, {model}",
  changeModel: "Cambia impostazione",
  pickModel: "Impostazione per {name}",
  unknownModel: "Sconosciuta ({id})",
  model: "Impostazione",
  nowLabel: "Adesso",
  nowAria: "Ora attuale {time}",
  spectrumAria: "Anteprima della giornata",
  weekLabel: "Settimana",
  prevDay: "Giorno precedente",
  nextDay: "Giorno successivo",
  goToDay: "Vai a {day}",
  dayView: "Mostro {day}",
  weekTabAria: "{day}: {summary}",
  copyDayTo: "Copia su...",
  copyDayTitle: "Copia {day} su",
  copyWeekdays: "Giorni feriali",
  copyWeekend: "Fine settimana",
  copyAll: "Tutti i giorni",
  copyDone: "Copiato su {days}",
  carryFrom: "Continua da {day}",
  linkedTo: 'Collegato a "{name}"',
  detached: '{day} non \xE8 pi\xF9 collegato a "{name}"',
  "err.minGap": "Le fasce devono durare almeno {minutes} minuti",
  "err.maxSlots": "Al massimo {max} fasce",
  "err.minSlots": "Serve almeno {min} fascia",
  "err.duplicateTime": "Un'altra fascia inizia gi\xE0 alle {time}",
  "err.locked": "Questa fascia \xE8 bloccata",
  "err.timeFormat": "Inserisci un'ora come HH:MM",
  "err.missingRef": "Giornata salvata non trovata",
  moved: "{name} ora inizia alle {time}",
  added: "Fascia aggiunta",
  removed: "Fascia rimossa",
  credits: "Realizzato con dayrhythm",
  donate: "Sostieni il progetto",
  empty: "Nessuna fascia",
  loading: "Caricamento...",
  loadFailed: "Impossibile caricare il programma: {error}",
  retry: "Riprova",
  presetFailed: "Impossibile caricare la preimpostazione"
};

// src/i18n/index.js
var table = { en: en_default, it: it_default };
var locales = {
  en: en_default,
  it: it_default,
  register(code, messages) {
    table[code] = { ...table[code] || {}, ...messages };
    this[code] = table[code];
  },
  get: (code) => table[code]
};
function makeT(code, messages) {
  const lang = String(code || "en").toLowerCase();
  const base = lang.split("-")[0];
  const flat = {};
  const per = {};
  for (const k of Object.keys(messages || {})) {
    const v = messages[k];
    if (v && typeof v === "object") per[k.toLowerCase()] = v;
    else flat[k] = v;
  }
  const chain = [per[lang], per[base], flat, table[lang], table[base], en_default].filter(Boolean);
  let pr;
  try {
    pr = new Intl.PluralRules(base);
  } catch (e) {
    pr = null;
  }
  const lookup = (k) => {
    for (const t2 of chain) if (t2[k] != null) return t2[k];
    return void 0;
  };
  const t = (key, vars) => {
    let s;
    if (vars && typeof vars.count === "number" && pr) s = lookup(`${key}_${pr.select(vars.count)}`);
    if (s == null) s = lookup(key);
    if (s == null) return key;
    return vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : k in vars ? "?" : m) : String(s);
  };
  t.has = (key) => lookup(key) !== void 0;
  return t;
}

// src/ui/model.js
function interp(tpl, values, fields, t) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => {
    if (!values || values[k] === void 0) return m;
    const f = fields && fields.find((x) => x.key === k);
    return f ? fmtField(f, values[k], t) : t && values[k] !== void 0 && t.has(`opt.${k}.${values[k]}`) ? t(`opt.${k}.${values[k]}`) : String(values[k]);
  });
}
var optionLabel = (field, o, t) => t && t.has(`opt.${field.key}.${o.value}`) ? t(`opt.${field.key}.${o.value}`) : o.label;
function fmtField(field, v, t) {
  if (typeof field.format === "function") return String(field.format(v));
  if (typeof field.format === "string") return field.format.replace(/\{value\}/g, String(v));
  if (field.type === "select") {
    const o = (field.options || []).find((x) => String(x.value) === String(v));
    return o ? optionLabel(field, o, t) : String(v);
  }
  if (field.type === "toggle") return v ? "\u2713" : "\u2013";
  return field.unit ? `${v}${field.unit}` : String(v);
}
function coerceField(field, v) {
  const d = field.default;
  switch (field.type) {
    case "range":
    case "number": {
      let n = typeof v === "number" ? v : parseFloat(v);
      if (!Number.isFinite(n)) n = typeof d === "number" ? d : field.min ?? 0;
      if (field.step > 0) {
        const base = field.min ?? 0;
        n = base + Math.round((n - base) / field.step) * field.step;
        n = +n.toFixed(6);
      }
      if (field.min != null) n = Math.max(field.min, n);
      if (field.max != null) n = Math.min(field.max, n);
      return n;
    }
    case "select": {
      const opts = field.options || [];
      const hit = opts.find((o) => String(o.value) === String(v));
      return hit ? hit.value : d !== void 0 ? d : opts[0] && opts[0].value;
    }
    case "toggle":
      return v === void 0 ? !!d : v === true || v === "true" || v === 1 || v === "on";
    case "text":
      return typeof v === "string" ? v : d ?? "";
    case "color":
      return typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : d ?? "#000000";
    default:
      return v;
  }
}
function defaultValues(model) {
  if (!model) return void 0;
  const v = {};
  for (const f of model.fields || []) if (f.default !== void 0) v[f.key] = f.default;
  Object.assign(v, model.defaults || {});
  return Object.keys(v).length ? v : void 0;
}
function modelLabel(model, id, t) {
  if (!model) return t("unknownModel", { id });
  const k = `model.${model.id}`;
  return t.has(k) ? t(k) : model.label || model.id;
}
var fieldLabel = (f, t) => t.has(`field.${f.key}`) ? t(`field.${f.key}`) : f.label || f.key;
var hue = (i) => `hsl(${(i * 47 + 20) % 360} 45% 58%)`;
function modelPreview(model, index, values, slot) {
  if (!model) return "repeating-linear-gradient(45deg,#9994 0 6px,#9992 6px 12px)";
  try {
    if (typeof model.preview === "function") return model.preview(values || {}, model, slot) || hue(index);
    if (model.previewScale && values) {
      const s = model.previewScale;
      const n = Number(values[s.field]);
      const tt = Number.isFinite(n) ? Math.min(1, Math.max(0, (n - s.min) / (s.max - s.min || 1))) : 0;
      return `color-mix(in oklab, ${s.to} ${Math.round(tt * 100)}%, ${s.from})`;
    }
    if (typeof model.preview === "string") return interp(model.preview, values || {}, model.fields);
  } catch (e) {
  }
  return model.off ? "transparent" : hue(index);
}
function modelSummary(model, values, slot, t) {
  if (!model || !model.summary) return "";
  if (typeof model.summary === "function") return String(model.summary(values || {}, model, slot) || "");
  return interp(model.summary, values || {}, model.fields, t);
}
function inWindow(win, minutes) {
  if (!win) return true;
  const a = parseTime(win.from), b = parseTime(win.to);
  return a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}
function modelsFor(models, slot, day, filter) {
  let m = models.filter((x) => inWindow(x.when, parseTime(slot.time)) && (!x.days || !day || x.days.includes(day)));
  if (typeof filter === "function") {
    try {
      m = filter(slot, m) || m;
    } catch (e) {
    }
  }
  return m;
}

// src/ui/clock.js
function nowOf(cfg) {
  const opts = cfg.timezone ? { timeZone: cfg.timezone } : void 0;
  if (typeof cfg.clock === "function") {
    try {
      const r = cfg.clock();
      if (r instanceof Date) return { minutes: minutesOf(r, opts), day: weekdayOf(r, opts) };
      if (typeof r === "number") return { minutes: mod(r, 1440), day: weekdayOf(/* @__PURE__ */ new Date(), opts) };
    } catch (e) {
    }
  }
  const d = new Date(Date.now() + (cfg.clockOffset || 0) * 6e4);
  return { minutes: minutesOf(d, opts), day: weekdayOf(d, opts) };
}
function offsetFor(deviceTime, cfg) {
  const opts = cfg.timezone ? { timeZone: cfg.timezone } : void 0;
  const now = /* @__PURE__ */ new Date();
  const browserMin = minutesOf(now, opts);
  let target, dayDelta = 0;
  if (deviceTime && typeof deviceTime === "object" && !(deviceTime instanceof Date)) {
    target = minutesOf(deviceTime.time);
    dayDelta = WEEKDAYS.indexOf(deviceTime.day) - WEEKDAYS.indexOf(weekdayOf(now, opts));
    let total = dayDelta * 1440 + target - browserMin;
    total = mod(total + 5040, 10080) - 5040;
    return total;
  }
  target = deviceTime instanceof Date ? minutesOf(deviceTime) : minutesOf(deviceTime);
  return mod(target - browserMin + 720, 1440) - 720;
}
var msToNextMinute = () => 6e4 - Date.now() % 6e4 + 40;

// src/ui/dom.js
var camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
function classList(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v.join(" ") : String(v)).split(/\s+/).filter(Boolean);
}
function applyRendered(target, r) {
  if (r == null) return false;
  if (typeof r === "string") target.replaceChildren(document.createTextNode(r));
  else if (typeof Node !== "undefined" && r instanceof Node) target.replaceChildren(r);
  else if (typeof r === "object" && typeof r.html === "string") target.innerHTML = r.html;
  else return false;
  return true;
}
function fillIcon(target, icon) {
  target.setAttribute("aria-hidden", "true");
  if (icon && typeof icon === "object" && icon.src) {
    const i = document.createElement("img");
    i.alt = "";
    i.src = icon.src;
    i.decoding = "async";
    target.replaceChildren(i);
  } else target.textContent = icon ? String(icon) : "";
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}

// src/storage.js
function localStorageAdapter(key) {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      return [];
    }
  };
  return {
    list: read,
    save({ name, slots }) {
      const day = { id: genId(), name, slots };
      localStorage.setItem(key, JSON.stringify([...read(), day]));
      return day;
    },
    remove(id) {
      localStorage.setItem(key, JSON.stringify(read().filter((d) => d.id !== id)));
    }
  };
}
function httpStorageAdapter(url, init = {}) {
  const base = { headers: init.headers, credentials: init.credentials };
  const call = async (u, o) => {
    const r = await fetch(u, { ...base, ...o, headers: { "content-type": "application/json", ...base.headers || {} } });
    if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
    return r.status === 204 ? void 0 : r.json();
  };
  return {
    list: () => call(url),
    save: (day) => call(url, { method: "POST", body: JSON.stringify(day) }),
    remove: (id) => call(`${url.replace(/\/$/, "")}/${encodeURIComponent(id)}`, { method: "DELETE" })
  };
}
function adapterFrom(s) {
  if (!s) return null;
  if (typeof s.list === "function") return s;
  if (s.type === "local" && s.key) return localStorageAdapter(s.key);
  if (s.type === "http" && s.url) return httpStorageAdapter(s.url, s);
  return null;
}

// src/styles/structure.js
var structureCSS = `
:host,[data-dr-host]{display:block;contain:layout style;position:relative}
[data-dr-fallback],.dr-root [hidden]{display:none!important}
.dr-root{--x-track-length:var(--dr-track-length,max(70vh,34rem));--x-track-thickness:var(--dr-track-thickness,18rem);--x-card-min:var(--dr-card-min,52px);--x-gap:var(--dr-gap,.4rem);--x-handle:var(--dr-handle-size,1.1rem);--x-tap:var(--dr-tap,44px);--x-spectrum-h:var(--dr-spectrum-height,3.5rem);--x-icon:var(--dr-icon-size,1.35rem);--x-pad:var(--dr-pad,1.25rem);--x-dur:var(--dr-duration,.12s);--x-now-w:var(--dr-now-width,2px);--x-now:var(--dr-now,#d97761);--x-week-h:var(--dr-week-height,auto);
display:flex;flex-direction:column;gap:calc(var(--x-gap)*2.5);position:relative;container:dr/inline-size;min-width:0}
.dr-root *,.dr-root *::before,.dr-root *::after{box-sizing:border-box}
@media (prefers-reduced-motion:reduce){.dr-root{--x-dur:0s}}
.dr-root[data-disabled]{pointer-events:none}
.dr-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.dr-toolbar,.dr-presets,.dr-preset-row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--x-gap)}
.dr-presets{flex-direction:column;align-items:stretch}
.dr-toolbar{justify-content:space-between}
.dr-toolbar-main{display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center;flex:1}
.dr-week-bar{display:flex;align-items:stretch;gap:var(--x-gap);min-height:var(--x-week-h)}
.dr-week-tablist{display:flex;flex:1;min-width:0;overflow-x:auto;gap:var(--x-gap);scrollbar-width:thin}
.dr-week-tab{flex:1 0 auto;min-width:var(--x-tap);min-height:var(--x-tap);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25rem;position:relative}
.dr-week-tab-preview{align-self:stretch;height:.3rem;min-width:1.4rem}
@container dr (max-width:420px){.dr-tab-long{display:none}}
@container dr (min-width:421px){.dr-tab-short{display:none}}
.dr-spectrum{display:flex;height:var(--x-spectrum-h);overflow:hidden}
.dr-spectrum-segment{flex:0 1 0;min-width:0}
.dr-track-wrap{position:relative;max-width:100%}
.dr-root[data-orient=horizontal] .dr-track-wrap{overflow-x:auto;overflow-y:hidden}
.dr-track{display:flex;position:relative;gap:0;user-select:none;-webkit-user-select:none}
.dr-track[data-orient=horizontal]{flex-direction:row;height:var(--x-track-thickness);min-width:calc(var(--n,1)*(var(--x-card-min) + var(--x-handle)))}
.dr-track[data-orient=vertical]{flex-direction:column;min-height:max(var(--x-track-length),calc(var(--n,1)*(var(--x-card-min) + var(--x-handle))))}
.dr-slot{position:relative;flex:1 1 0;min-width:0;min-height:0;display:flex}
.dr-track[data-orient=horizontal] .dr-slot{min-width:var(--x-card-min)}
.dr-track[data-orient=vertical] .dr-slot{min-height:var(--x-card-min)}
.dr-slot[data-zero]{min-width:0!important;min-height:0!important;visibility:hidden;overflow:hidden}
.dr-slot[data-dragmin]{min-width:0!important;min-height:0!important}
.dr-slot-tint{position:absolute;inset:0;border-radius:inherit;pointer-events:none;overflow:hidden}
.dr-slot-content{position:relative;display:flex;min-width:0;min-height:0;flex:1;overflow:hidden}
.dr-track[data-orient=horizontal] .dr-slot-content{flex-direction:column;align-items:center;justify-content:flex-start;text-align:center}
.dr-track[data-orient=vertical] .dr-slot-content{flex-direction:row;align-items:center;flex-wrap:nowrap}
.dr-slot-model{position:static;display:flex;align-items:center;gap:.4rem;min-width:0;text-align:inherit;cursor:pointer;font:inherit;color:inherit;background:none;border:0}
.dr-slot-model::after{content:'';position:absolute;inset:0}
.dr-track[data-orient=horizontal] .dr-slot-model{flex-direction:column;max-width:100%}
.dr-slot-icon{display:inline-flex;align-items:center;justify-content:center;min-width:var(--x-icon);font-size:var(--x-icon);line-height:1}
.dr-slot-icon img{width:var(--x-icon);height:var(--x-icon);object-fit:contain}
.dr-slot-label,.dr-slot-model-name,.dr-slot-summary{min-width:0;overflow-wrap:anywhere}
.dr-handle{position:relative;flex:0 0 var(--x-handle);z-index:3;touch-action:none;display:flex;align-items:center;justify-content:center;outline-offset:-2px}
.dr-handle::before{content:'';position:absolute}
.dr-track[data-orient=horizontal] .dr-handle{cursor:ew-resize;flex-direction:column}
.dr-track[data-orient=horizontal] .dr-handle::before{top:0;bottom:0;left:calc(50% - var(--x-tap)/2);width:var(--x-tap)}
.dr-track[data-orient=vertical] .dr-handle{cursor:ns-resize}
.dr-track[data-orient=vertical] .dr-handle::before{left:0;right:0;top:calc(50% - var(--x-tap)/2);height:var(--x-tap)}
.dr-handle[data-alias]{pointer-events:none}
.dr-handle[data-alias]:not([data-dragging]),.dr-handle[data-hide]{visibility:hidden}
.dr-handle-time{position:absolute;z-index:4;pointer-events:none;opacity:0;white-space:nowrap}
.dr-track[data-orient=horizontal] .dr-handle-time{top:.4rem;left:50%;transform:translateX(-50%)}
.dr-track[data-orient=vertical] .dr-handle-time{left:.6rem;top:50%;transform:translateY(-50%)}
.dr-handle:focus-visible .dr-handle-time,.dr-handle[data-dragging] .dr-handle-time{opacity:1}
.dr-now-line{position:absolute;pointer-events:none;z-index:2;background:var(--x-now)}
.dr-track[data-orient=horizontal] .dr-now-line{top:0;bottom:0;width:var(--x-now-w);margin-left:calc(var(--x-now-w)/-2)}
.dr-track[data-orient=vertical] .dr-now-line{left:0;right:0;height:var(--x-now-w);margin-top:calc(var(--x-now-w)/-2)}
.dr-now-badge{position:absolute;white-space:nowrap;font-size:.7em;padding:.05rem .4rem;background:var(--x-now);color:#fff;border-radius:99px;transform:translate(-50%,0)}
.dr-track[data-orient=horizontal] .dr-now-badge{top:.15rem;left:50%}
.dr-track[data-orient=vertical] .dr-now-badge{left:auto;right:.3rem;top:0;transform:translate(0,-50%)}
.dr-track-wrap[data-rows]{overflow:visible!important}
.dr-week-rows{display:grid;gap:var(--dr-row-gap,.4rem);padding-top:1.4rem}
.dr-week-row,.dr-week-axis{display:grid;grid-template-columns:var(--dr-row-label,2.8rem) minmax(0,1fr);align-items:center;gap:.4rem}
.dr-week-axis-ticks{position:relative;height:1em}
.dr-week-axis-tick{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
.dr-week-axis-tick:first-child{transform:none}
.dr-week-axis-tick:last-child{transform:translateX(-100%)}
.dr-week-row-day{min-height:var(--dr-row-height,2.75rem);min-width:0;padding:0;position:relative;cursor:pointer}
.dr-track[data-row-day]{height:var(--dr-row-height,2.75rem);min-width:0}
.dr-track[data-row-day] .dr-slot{min-width:0;container-type:inline-size}
.dr-track[data-row-day] .dr-slot-content{justify-content:center;align-items:center}
.dr-track[data-row-day] :is(.dr-slot-time,.dr-slot-label,.dr-slot-model-name,.dr-slot-summary){display:none}
.dr-track[data-row-day] .dr-slot-model{min-height:0;padding:0}
@container (max-width:1.7rem){.dr-track[data-row-day] .dr-slot-icon{display:none}}
.dr-track[data-row-day] .dr-handle{flex:0 0 0;width:0}
.dr-track[data-row-day] .dr-handle::before{left:calc(50% - var(--dr-row-tap,28px)/2);width:var(--dr-row-tap,28px)}
.dr-track[data-row-day] .dr-handle-time{top:-1.55rem}
.dr-track[data-row-day] .dr-now-badge{display:none}
.dr-dialog{padding:0;border:0;width:100%;max-width:min(94vw,30rem);max-height:min(90dvh,46rem)}
.dr-dialog[open]{display:flex;flex-direction:column}
.dr-dialog-body{overflow:auto;min-height:0}
.dr-dialog-header,.dr-dialog-actions{display:flex;align-items:center;gap:var(--x-gap);flex-wrap:wrap}
.dr-dialog-actions{justify-content:flex-end}
.dr-model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(5.5rem,1fr));gap:var(--x-gap)}
.dr-model-option{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;min-height:5rem;min-width:0;text-align:center;cursor:pointer}
.dr-field{display:grid;gap:.25rem}
.dr-field-head{display:flex;justify-content:space-between;gap:1rem}
.dr-field-input[type=range]{width:100%}
.dr-copy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(7rem,1fr));gap:var(--x-gap)}
.dr-region:empty{display:none}
.dr-credits{display:flex;flex-wrap:wrap;gap:.3rem 1rem;justify-content:flex-end}
.dr-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;min-height:8rem;text-align:center}
.dr-button,.dr-week-tab,.dr-model-option,.dr-preset{font:inherit;cursor:pointer;color:inherit}
.dr-root button:disabled{cursor:not-allowed}
.dr-input{font:inherit;min-width:0;width:100%}
`;

// src/styles/base.js
var baseCSS = `
.dr-root:not([data-theme=none]){
font-family:var(--x-font);font-size:var(--dr-font-size,1rem);line-height:1.4;color:var(--x-ink);background:var(--x-surface);
border:1px solid var(--x-border);border-radius:var(--x-radius-panel);padding:var(--x-pad);box-shadow:var(--x-shadow);
--x-line:color-mix(in srgb,var(--x-ink) 50%,var(--x-surface));
&[data-disabled]{opacity:.55}

:is(button,input,select){font:inherit;color:inherit;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:3px solid var(--x-focus);outline-offset:2px}
.dr-button,.dr-preset,.dr-preset-delete{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:2.6rem;padding:.45rem 1rem;border:1px solid var(--x-line);border-radius:var(--x-radius-button);background:var(--x-surface);font-size:.85em;transition:background-color var(--x-dur),border-color var(--x-dur)}
.dr-button:hover:not(:disabled),.dr-preset:hover:not(:disabled),.dr-model-option:hover{background:var(--x-surface-soft);border-color:var(--x-accent)}
.dr-button:disabled{opacity:.5}
.dr-button-primary{background:var(--x-accent);border-color:var(--x-accent);color:var(--x-accent-ink);font-weight:600}
.dr-button-primary:hover:not(:disabled){background:var(--x-accent);filter:brightness(.92)}
.dr-button-danger{color:var(--x-danger);border-color:var(--x-danger)}
.dr-preset{border-radius:var(--x-radius-chip)}
.dr-preset[aria-busy=true]{opacity:.6}
.dr-preset-delete{min-height:2rem;min-width:2rem;padding:0;border-radius:var(--x-radius-chip)}
.dr-preset-row{gap:.3rem}
.dr-presets-label{font-size:.75em;color:var(--x-muted);margin:.3rem 0 .2rem}
.dr-input{min-height:2.6rem;padding:.5rem .8rem;border:1px solid var(--x-line);border-radius:var(--x-radius-input);background:var(--x-surface);accent-color:var(--x-field-accent,var(--x-accent))}
.dr-input[aria-invalid=true]{border-color:var(--x-danger)}
.dr-error{color:var(--x-danger);font-size:.8em}
.dr-week-bar .dr-button{padding-inline:.7rem;min-width:var(--x-tap)}
.dr-week-tab{border:1px solid var(--x-border);border-radius:var(--x-radius-tab);background:var(--x-surface);font-size:.8em;padding:.3rem .5rem}
.dr-week-tab:hover{background:var(--x-surface-soft)}
.dr-week-tab[aria-selected=true]{background:var(--x-accent-soft);border-color:var(--x-accent);font-weight:650}
.dr-week-tab[data-today]::after{content:'';position:absolute;top:.3rem;right:.4rem;width:.4rem;height:.4rem;border-radius:50%;background:var(--x-now)}
.dr-week-tab[data-empty]{color:var(--x-muted)}
.dr-week-tab[data-linked]{border-style:dashed}
.dr-week-tab-preview{border-radius:99px;opacity:.9}
.dr-week-axis{font-size:.68em;color:var(--x-muted);font-variant-numeric:tabular-nums}
.dr-week-row-day{border:1px solid var(--x-border);border-radius:var(--x-radius-input);background:var(--x-surface);font-size:.8em;font-weight:600;text-transform:capitalize}
.dr-week-row[data-selected] .dr-week-row-day{background:var(--x-accent-soft);border-color:var(--x-accent)}
.dr-week-row[data-today] .dr-week-row-day::after{content:'';position:absolute;top:.25rem;right:.25rem;width:.35rem;height:.35rem;border-radius:50%;background:var(--x-now)}
.dr-track[data-row-day] .dr-slot{padding:0;border-radius:.55rem}
.dr-track[data-row-day] .dr-slot-carry{border-style:dashed}
.dr-week-row[data-selected] .dr-track[data-row-day] .dr-slot:not(.dr-slot-carry){border-color:color-mix(in srgb,var(--x-accent) 55%,var(--x-border))}
.dr-track[data-row-day] .dr-handle-grip{width:3px;height:60%;opacity:.8;background:var(--x-ink)}
.dr-toolbar-day{font-size:.85em;font-weight:650;text-transform:capitalize;margin-inline-end:.3rem}
.dr-spectrum{border-radius:var(--x-radius-spectrum);background:var(--x-ink)}
.dr-spectrum-segment{opacity:.9}
.dr-slot{border:1px solid var(--x-border);border-radius:var(--x-radius-card);background:var(--x-surface-soft);padding:.5rem}
.dr-track[data-orient=horizontal] .dr-slot{border-radius:var(--x-radius-card-h)}
.dr-slot-tint{opacity:var(--x-tint-opacity)}
.dr-slot[data-active]{border-color:var(--x-accent);box-shadow:inset 0 0 0 1px var(--x-accent)}
.dr-slot[data-invalid]{border-color:var(--x-danger);border-style:dashed}
.dr-slot-tail,.dr-slot-carry{opacity:var(--dr-carry-opacity,.55)}
.dr-slot-tail{cursor:default}
.dr-slot-carry{cursor:pointer;background:var(--x-surface-soft);border-style:dashed;color:inherit;font:inherit;text-align:center}
.dr-slot-content{gap:.3rem;padding:.2rem}
.dr-slot-time{font-variant-numeric:tabular-nums;font-size:.75em;font-weight:500;color:var(--x-muted);white-space:nowrap}
.dr-slot-label{font-size:.85em;font-weight:600}
.dr-track[data-orient=vertical] .dr-slot-time{min-width:3.6rem}
.dr-track[data-orient=vertical] .dr-slot-label{flex:1}
.dr-slot-model{padding:.35rem .25rem;min-height:var(--x-tap);border-radius:var(--x-radius-input)}
.dr-slot-model-name{font-size:.75em;line-height:1.3}
.dr-slot-summary{font-size:.7em;color:var(--x-muted)}
.dr-slot[data-off] .dr-slot-tint{background-image:repeating-linear-gradient(45deg,var(--x-line) 0 2px,transparent 2px 9px)!important;background-color:transparent!important;opacity:.35}
.dr-handle{border-radius:var(--x-radius-input)}
.dr-handle-grip{display:block;border-radius:99px;background:var(--x-accent);opacity:.45;transition:opacity var(--x-dur)}
.dr-track[data-orient=horizontal] .dr-handle-grip{width:4px;height:2.2rem}
.dr-track[data-orient=vertical] .dr-handle-grip{height:4px;width:2.2rem}
.dr-handle:hover .dr-handle-grip,.dr-handle[data-dragging] .dr-handle-grip,.dr-handle:focus-visible .dr-handle-grip{opacity:1}
.dr-handle-seam .dr-handle-grip{background:var(--x-ink)}
.dr-handle-time{background:var(--x-ink);color:var(--x-surface);font-size:.75em;font-variant-numeric:tabular-nums;padding:.1rem .5rem;border-radius:99px}
.dr-root[data-dragging]{cursor:grabbing}
.dr-dialog{background:var(--x-surface);color:var(--x-ink);border:1px solid var(--x-border);border-radius:var(--x-radius-dialog);box-shadow:0 24px 60px #0004}
.dr-dialog::backdrop{background:var(--x-overlay);backdrop-filter:blur(6px)}
.dr-dialog[open]{animation:dr-in var(--x-dur) ease-out}
@keyframes dr-in{from{opacity:0;transform:scale(.97)}}
.dr-dialog-header{padding:1.1rem 1.3rem .4rem;justify-content:space-between}
.dr-dialog-title{margin:0;font-size:1.1em;font-weight:650}
.dr-dialog-body{display:grid;gap:.9rem;padding:.6rem 1.3rem 1rem}
.dr-dialog-actions{padding:.8rem 1.3rem 1.2rem}
.dr-label{display:grid;gap:.25rem;font-size:.85em;font-weight:550;color:var(--x-muted)}
.dr-model-option{padding:.6rem .4rem;border:1px solid var(--x-border);border-radius:var(--x-radius-card);background:var(--x-surface);font-size:.75em}
.dr-model-option[aria-checked=true]{border-color:var(--x-accent);background:var(--x-accent-soft);box-shadow:inset 0 0 0 1px var(--x-accent)}
.dr-model-icon{font-size:var(--x-icon);line-height:1}
.dr-model-swatch{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:var(--x-radius-input);border:1px solid var(--x-border);font-size:1.2rem;line-height:1}
.dr-model-swatch[data-off]{background-image:repeating-linear-gradient(45deg,var(--x-line) 0 2px,transparent 2px 8px)!important;background-color:transparent!important}
.dr-field-label{font-size:.85em;font-weight:550}
.dr-field-value{font-size:.85em;font-variant-numeric:tabular-nums;color:var(--x-muted)}
.dr-toggle-row{display:flex;align-items:center;gap:.6rem}
.dr-state{color:var(--x-muted);font-size:.9em}
.dr-credits{font-size:.72em;color:var(--x-muted)}
.dr-credits a{color:var(--x-muted);text-underline-offset:2px}
.dr-credits a:hover{color:var(--x-accent)}
}
@media (forced-colors:active){
.dr-root:not([data-theme=none]){--x-accent:Highlight;--x-border:CanvasText;--x-line:CanvasText;--x-focus:Highlight}
.dr-root .dr-handle-grip{forced-color-adjust:none}
.dr-root .dr-handle-grip{background:CanvasText;opacity:1}
}
`;

// src/styles/themes.js
var V = (o) => Object.entries(o).map(([k, v]) => `--x-${k}:var(--dr-${k},${v})`).join(";");
var P = {
  organic: {
    light: { bg: "#edf6f2", surface: "#fbfefb", "surface-soft": "#e2f0e9", ink: "#163e38", muted: "#57716b", accent: "#146b59", "accent-soft": "#d3ebe0", "accent-ink": "#ffffff", focus: "#146b59", danger: "#a3372a", border: "#cbded4", shadow: "0 12px 40px rgb(30 74 55 / 5%)", overlay: "#0a292566" },
    dark: { bg: "#102824", surface: "#193730", "surface-soft": "#23453c", ink: "#edf7ef", muted: "#b0c8bb", accent: "#a6dfc5", "accent-soft": "#2c5548", "accent-ink": "#0e2a24", focus: "#a6dfc5", danger: "#ff9d8f", border: "#38574b", shadow: "0 12px 40px rgb(0 16 12 / 14%)", overlay: "#02100dbb" },
    shape: { "radius-panel": "28px 28px 12px 28px", "radius-dialog": "36px 36px 36px 12px", "radius-card": "20px", "radius-card-h": "26px 26px 14px 14px", "radius-chip": "999px", "radius-input": "1rem", "radius-button": "999px", "radius-spectrum": "100% 40% 70% 30% / 30% 60% 40% 60%", "radius-tab": "999px", font: '"Segoe UI Variable","Segoe UI",Roboto,system-ui,sans-serif', "tint-opacity": ".25" }
  },
  neutral: {
    light: { bg: "#f8fafc", surface: "#ffffff", "surface-soft": "#f1f5f9", ink: "#0f172a", muted: "#475569", accent: "#2563eb", "accent-soft": "#dbeafe", "accent-ink": "#ffffff", focus: "#2563eb", danger: "#b91c1c", border: "#d5dbe4", shadow: "none", overlay: "#0f172a66" },
    dark: { bg: "#0b1220", surface: "#111a2c", "surface-soft": "#1e293b", ink: "#f1f5f9", muted: "#cbd5e1", accent: "#60a5fa", "accent-soft": "#1e3a5f", "accent-ink": "#0b1220", focus: "#60a5fa", danger: "#fca5a5", border: "#334155", shadow: "none", overlay: "#020617b3" },
    shape: { "radius-panel": "8px", "radius-dialog": "10px", "radius-card": "8px", "radius-card-h": "8px", "radius-chip": "8px", "radius-input": "6px", "radius-button": "6px", "radius-spectrum": "6px", "radius-tab": "6px", font: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', "tint-opacity": ".22" }
  },
  flat: {
    light: { bg: "#ffffff", surface: "#ffffff", "surface-soft": "#ececec", ink: "#000000", muted: "#333333", accent: "#0b57d0", "accent-soft": "#d6e4ff", "accent-ink": "#ffffff", focus: "#000000", danger: "#a80000", border: "#000000", shadow: "none", overlay: "#000000aa" },
    dark: { bg: "#000000", surface: "#121212", "surface-soft": "#2a2a2a", ink: "#ffffff", muted: "#dddddd", accent: "#8ab4f8", "accent-soft": "#1b3358", "accent-ink": "#000000", focus: "#ffffff", danger: "#ff8a80", border: "#ffffff", shadow: "none", overlay: "#000000dd" },
    shape: { "radius-panel": "0", "radius-dialog": "0", "radius-card": "0", "radius-card-h": "0", "radius-chip": "0", "radius-input": "0", "radius-button": "0", "radius-spectrum": "0", "radius-tab": "0", font: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', "tint-opacity": ".85" }
  }
};
function themeRules(id, t) {
  const r = `.dr-root[data-theme="${id}"]`;
  const dark = t.dark || t.light;
  const base = t.scheme === "dark" ? "dark" : "light";
  const skin = Object.entries(t.skin || {}).map(([sel, decl]) => sel.split(",").map((x) => `${r} ${x.trim()}`).join(",") + `{${decl}}`).join("");
  return `${r}{${V({ ...t.light, ...t.shape })};color-scheme:${base}}` + (t.dark ? `${r}[data-scheme=dark]{${V(dark)};color-scheme:dark}@media (prefers-color-scheme:dark){${r}[data-scheme=auto]{${V(dark)};color-scheme:dark}}${r}[data-scheme=auto]{color-scheme:light dark}` : "") + skin;
}
var themes = {
  register(theme) {
    if (theme && theme.id && !BUILTIN.includes(theme.id)) this[theme.id] = theme;
    return theme;
  }
};
var BUILTIN = ["organic", "neutral", "flat", "none"];
function resolveTheme(v) {
  if (typeof v === "string" && BUILTIN.includes(v)) return { id: v, def: null };
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try {
      v = JSON.parse(v);
    } catch (e) {
      v = null;
    }
  }
  const def = typeof v === "string" ? themes[v] : v && typeof v === "object" && v.light ? v : null;
  if (!def) return { id: "organic", def: null };
  return { id: String(def.id || "custom").replace(/[^\w-]/g, ""), def };
}
var themeCSS = ["organic", "neutral", "flat"].map((t) => themeRules(t, P[t])).join("") + `
.dr-root[data-theme=flat] :is(.dr-slot,.dr-button,.dr-preset,.dr-model-option,.dr-week-tab,.dr-input){border-width:2px}
.dr-root[data-theme=flat]{--x-shadow:none}
.dr-root[data-theme=flat] :focus-visible{outline:3px solid var(--x-focus);outline-offset:2px}
`;

// src/styles/dial.js
var dialCSS = `
.dr-dial{width:min(100%,360px);aspect-ratio:1;margin-inline:auto;position:relative;display:grid;place-items:center;border-radius:var(--dr-radius-panel,1.5rem);color:var(--x-ink,var(--dr-ink,currentColor));}
.dr-dial-svg{display:block;width:100%;height:100%;overflow:visible;touch-action:none;}
.dr-dial-ring{fill:var(--x-surface-soft,var(--dr-surface-soft,transparent));stroke:var(--x-border,var(--dr-border,currentColor));stroke-width:1;}
.dr-dial-arc{fill-rule:evenodd;cursor:pointer;stroke:var(--x-surface,var(--dr-surface,transparent));stroke-width:1.5;vector-effect:non-scaling-stroke;opacity:.94;transition:opacity var(--x-dur,.12s),transform var(--x-dur,.12s);transform-origin:100px 100px;}
.dr-dial-arc-active{filter:drop-shadow(0 0 2px var(--x-accent,var(--dr-accent,currentColor)));opacity:1;}
.dr-dial-tick{stroke:var(--x-muted,var(--dr-muted,currentColor));stroke-width:1;opacity:.65;vector-effect:non-scaling-stroke;}
.dr-dial-tick-label{fill:var(--x-muted,var(--dr-muted,currentColor));font:600 5px var(--x-font,system-ui,sans-serif);text-anchor:middle;dominant-baseline:middle;}
.dr-dial-now{stroke:var(--x-now,var(--dr-now,#d97761));stroke-width:2;stroke-linecap:round;vector-effect:non-scaling-stroke;pointer-events:none;}
.dr-dial-handle{fill:var(--x-accent,var(--dr-accent,currentColor));stroke:var(--x-surface,var(--dr-surface,Canvas));stroke-width:2;vector-effect:non-scaling-stroke;cursor:grab;outline:none;transition:transform var(--x-dur,.12s),opacity var(--x-dur,.12s);}
.dr-dial-handle:focus-visible{stroke:var(--x-focus,var(--dr-focus,currentColor));stroke-width:3;}
.dr-dial-handle[data-dragging]{cursor:grabbing;}
.dr-dial-center{pointer-events:none;text-anchor:middle;}
.dr-dial-center-time{fill:var(--x-ink,var(--dr-ink,currentColor));font:700 13px var(--x-font,system-ui,sans-serif);font-variant-numeric:tabular-nums;}
.dr-dial-center-label{fill:var(--x-ink,var(--dr-ink,currentColor));font:650 6px var(--x-font,system-ui,sans-serif);}
.dr-dial-center-summary{fill:var(--x-muted,var(--dr-muted,currentColor));font:5px var(--x-font,system-ui,sans-serif);}
.dr-dial-center-remaining{fill:var(--x-muted,var(--dr-muted,currentColor));font:4px var(--x-font,system-ui,sans-serif);}
@media (prefers-reduced-motion:reduce){.dr-dial-arc,.dr-dial-handle{transition:none;}}
`;

// src/ui/layout.js
function buildLayout(slotsIn, opts = {}) {
  const cyclic = opts.cyclic !== false;
  const slots = sortSlots(slotsIn);
  const n = slots.length;
  const pieces = [];
  if (!n) {
    if (!cyclic && opts.carry) pieces.push({ key: "carry", kind: "carry", slot: opts.carry, dur: 1440 });
    return { origin: 0, pieces };
  }
  const ranges = slotRanges(slots, { cyclic });
  const first = ranges[0], last = ranges[n - 1];
  const mainDur = (r) => r.index === n - 1 && r.end > 1440 ? 1440 - r.start : r.duration;
  if (!cyclic) {
    if (opts.carry) pieces.push({ key: "carry", kind: "carry", slot: opts.carry, dur: first.start });
    for (const r of ranges) pieces.push({ key: "main:" + r.slot.id, kind: "main", slot: r.slot, dur: r.duration, start: r.start });
    return { origin: 0, pieces };
  }
  if (opts.origin === "midnight") {
    pieces.push({ key: "tail", kind: "tail", slot: last.slot, dur: first.start });
    for (const r of ranges) pieces.push({ key: "main:" + r.slot.id, kind: "main", slot: r.slot, dur: mainDur(r), start: r.start });
    return { origin: 0, pieces };
  }
  if (opts.frozen) pieces.push({ key: "tail", kind: "tail", slot: last.slot, dur: 0 });
  for (const r of ranges) pieces.push({ key: "main:" + r.slot.id, kind: "main", slot: r.slot, dur: r.duration, start: r.start });
  if (opts.frozen) pieces.push({ key: "tail-end", kind: "tail", slot: first.slot, dur: 0 });
  return { origin: first.start, pieces };
}
function pieceAt(layout, m) {
  let a = ((m - layout.origin) % 1440 + 1440) % 1440;
  for (const p2 of layout.pieces) {
    if (p2.dur > 0 && a < p2.dur) return { piece: p2, frac: a / p2.dur };
    a -= p2.dur;
  }
  const p = layout.pieces.filter((x) => x.dur > 0).pop();
  return p ? { piece: p, frac: 1 } : null;
}
function gradientStops(pieces, colorOf) {
  const total = pieces.reduce((s, p) => s + p.dur, 0) || 1;
  let acc = 0;
  const stops = [];
  for (const p of pieces) {
    if (p.dur <= 0) continue;
    const c = colorOf(p.slot);
    const a = (acc / total * 100).toFixed(2), b = ((acc + p.dur) / total * 100).toFixed(2);
    stops.push(`${c} ${a}% ${b}%`);
    acc += p.dur;
  }
  return stops.join(",");
}

// src/ui/drag.js
function attachDrag(el) {
  const wrap = el._$.trackwrap;
  wrap.addEventListener("pointerdown", (e) => onDown(el, e));
  wrap.addEventListener("keydown", (e) => onKey(el, e));
}
var handleOf = (e) => e.target.closest ? e.target.closest("[data-handle]") : null;
function setFlex(node, dur) {
  if (!node) return;
  node.style.flex = `${Math.max(0, dur)} 1 0`;
  if (dur <= 0) node.dataset.zero = "";
  else delete node.dataset.zero;
}
function trackCtx(el, h) {
  const track = h.parentElement;
  const rowDay = track && track.dataset.rowDay;
  if (rowDay && el._rows && el._rows.has(rowDay)) return { day: rowDay, track, ...el._rows.get(rowDay) };
  return { day: el.weekMode ? el._sel : null, track: el._$.track, layout: el._layout, pieceEls: el._pieceEls, segEls: el._segEls };
}
function shift(el, slots, id, minutes, cyclic) {
  const o = { snap: el._snap, minGap: el._minGap, cyclic };
  return el.cfg.push === false ? moveBoundary(slots, id, minutes, o) : pushBoundary(slots, id, minutes, o);
}
function onDown(el, e) {
  const h = handleOf(e);
  if (!h || h.hasAttribute("data-alias") || "dial" in h.dataset || e.button && e.button > 0 || el._drag || el._hold) return;
  const hold = +el.cfg.touchHold;
  if (e.pointerType !== "touch" || !(hold > 0)) {
    startDrag(el, e, h);
    return;
  }
  const at = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, preventDefault() {
  } };
  const stop = () => {
    clearTimeout(timer);
    h.removeEventListener("pointermove", move);
    h.removeEventListener("pointerup", stop);
    h.removeEventListener("pointercancel", stop);
    el._hold = null;
  };
  const move = (ev) => {
    if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 10) stop();
    else {
      at.clientX = ev.clientX;
      at.clientY = ev.clientY;
    }
  };
  const timer = setTimeout(() => {
    stop();
    if (h.isConnected && !el._drag) startDrag(el, at, h);
  }, hold);
  el._hold = stop;
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerup", stop);
  h.addEventListener("pointercancel", stop);
}
function startDrag(el, e, h) {
  const id = h.dataset.slotId;
  const weekly = el.weekMode;
  const ctx = trackCtx(el, h);
  const slots = sortSlots(el._slotsOf(ctx.day));
  const idx = slots.findIndex((s) => s.id === id);
  if (idx < 0) return;
  e.preventDefault();
  const track = ctx.track;
  const frozen = !weekly && idx === 0 && el.cfg.origin !== "midnight";
  let handle = h;
  if (frozen) {
    el._frozen = true;
    el._renderTrack({ frozen: true });
    ctx.layout = el._layout;
    ctx.pieceEls = el._pieceEls;
    ctx.segEls = el._segEls;
    handle = track.querySelector(`[data-handle][data-slot-id="${CSS.escape(id)}"]:not([data-alias])`) || h;
  }
  const horiz = track.dataset.orient === "horizontal";
  const carry = ctx.layout.pieces.find((p) => p.kind === "carry");
  const keys = ctx.layout.pieces.map((p) => p.key);
  const loose = /* @__PURE__ */ new Set(["main:" + id]);
  const before = keys[keys.indexOf("main:" + id) - 1];
  if (before) loose.add(before);
  if (frozen) {
    loose.add("tail");
    loose.add("tail-end");
    const k = keys[keys.indexOf("tail-end") - 1];
    if (k) loose.add(k);
  }
  for (const k of loose) {
    const n = ctx.pieceEls.get(k);
    if (n) n.dataset.dragmin = "";
  }
  const st = {
    id,
    weekly,
    day: ctx.day,
    ctx,
    slots0: slots,
    base: el._value,
    frozen,
    handle,
    horiz,
    keys,
    loose,
    opts: weekly ? { cyclic: false, carry: carry && carry.slot } : { cyclic: true, origin: el.cfg.origin === "midnight" ? "midnight" : "first" },
    origin: ctx.layout.origin,
    pos: horiz ? e.clientX : e.clientY,
    startMin: parseTime(slots[idx].time),
    cur: parseTime(slots[idx].time),
    raf: 0,
    durs: new Map(ctx.layout.pieces.map((p) => [p.key, p.dur])),
    alias: frozen ? track.querySelector("[data-handle][data-alias]") : null,
    last: null
  };
  measure(st);
  st.grab = st.pos - edgePixel(st, st.durs, "main:" + id);
  el._drag = st;
  el._liveBase = el._value;
  el._$.root.dataset.dragging = "";
  handle.dataset.dragging = "";
  try {
    handle.setPointerCapture(e.pointerId);
  } catch (err) {
  }
  const move = (ev) => {
    st.pos = horiz ? ev.clientX : ev.clientY;
    if (!st.raf) st.raf = requestAnimationFrame(() => frame(el, st));
  };
  const up = (ev) => end(ev.type === "pointercancel");
  const end = (cancel) => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", up);
    handle.removeEventListener("pointercancel", up);
    handle.removeEventListener("lostpointercapture", lost);
    finish(el, st, cancel);
  };
  const lost = () => {
    if (el._drag === st) end(false);
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", up);
  handle.addEventListener("pointercancel", up);
  handle.addEventListener("lostpointercapture", lost);
}
var sizeOf = (st, r) => st.horiz ? r.width : r.height;
var startOf = (st, r) => st.horiz ? r.left : r.top;
function measure(st) {
  const { pieceEls, track } = st.ctx;
  void track.offsetHeight;
  let avail = 0, normalMin = 0;
  st.mins = /* @__PURE__ */ new Map();
  st.pads = /* @__PURE__ */ new Map();
  for (const k of st.keys) {
    const n = pieceEls.get(k);
    if (!n) continue;
    avail += sizeOf(st, n.getBoundingClientRect());
    const c = getComputedStyle(n);
    const px = (a, b, c2, d) => (parseFloat(a) || 0) + (parseFloat(b) || 0) + (parseFloat(c2) || 0) + (parseFloat(d) || 0);
    st.pads.set(k, st.horiz ? px(c.paddingLeft, c.paddingRight, c.borderLeftWidth, c.borderRightWidth) : px(c.paddingTop, c.paddingBottom, c.borderTopWidth, c.borderBottomWidth));
    if (!st.loose.has(k) && !("zero" in n.dataset)) {
      const cs = getComputedStyle(n);
      normalMin = Math.max(normalMin, parseFloat(st.horiz ? cs.minWidth : cs.minHeight) || 0);
    }
  }
  for (const k of st.keys) st.mins.set(k, st.loose.has(k) ? 0 : normalMin);
  st.avail = avail;
  st.delta = /* @__PURE__ */ new Map();
  for (const k of ["main:" + st.id, "tail-end"]) {
    const card = pieceEls.get(k);
    const h = card && card.previousElementSibling;
    if (!card || !h || !h.matches("[data-handle]")) continue;
    const hr = h.getBoundingClientRect();
    const centre = startOf(st, hr) + sizeOf(st, hr) / 2;
    st.delta.set(k, centre - cardsBefore(st, st.durs, k));
  }
}
function flexSizes(st, durs) {
  const items = st.keys.map((k) => {
    const g = Math.max(0, durs.get(k) || 0), base = st.pads.get(k) || 0;
    return { g, base, min: Math.max(base, g > 0 ? st.mins.get(k) : 0), size: base, frozen: g <= 0 };
  });
  for (let pass = 0; pass <= items.length; pass++) {
    let free = st.avail, grow = 0;
    for (const it of items) {
      if (it.frozen) free -= it.size;
      else {
        grow += it.g;
        free -= it.base;
      }
    }
    if (grow <= 0) break;
    let violation = 0;
    for (const it of items) if (!it.frozen) {
      it.t = it.base + Math.max(0, free) * it.g / grow;
      violation += Math.max(0, it.min - it.t);
    }
    if (violation <= 0) {
      for (const it of items) if (!it.frozen) it.size = it.t;
      break;
    }
    for (const it of items) if (!it.frozen && it.t < it.min) {
      it.frozen = true;
      it.size = it.min;
    }
  }
  return items.map((it) => it.size);
}
function cardsBefore(st, durs, key) {
  const sizes = flexSizes(st, durs);
  let acc = 0;
  for (let i = 0; i < st.keys.length && st.keys[i] !== key; i++) acc += sizes[i];
  return acc;
}
function edgePixel(st, durs, key) {
  return cardsBefore(st, durs, key) + (st.delta.get(key) || 0);
}
function candidate(el, st, a) {
  let target = st.origin + a;
  if (st.frozen && target >= 1440) target -= 1440;
  const r = shift(el, st.slots0, st.id, target, !st.weekly);
  const durs = st.frozen ? frozenDurs(st, r.slots, r.minutes) : new Map(buildLayout(r.slots, st.opts).pieces.map((p) => [p.key, p.dur]));
  const key = st.frozen && r.minutes < st.origin ? "tail-end" : "main:" + st.id;
  return { r, durs, px: edgePixel(st, durs, key) };
}
function solve(el, st) {
  const goal = st.pos - st.grab;
  let lo = 0, hi = 1440, best = candidate(el, st, lo), bestErr = Math.abs(best.px - goal);
  for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2, c = candidate(el, st, mid), err = Math.abs(c.px - goal);
    if (err < bestErr) {
      best = c;
      bestErr = err;
    }
    if (c.px < goal) lo = mid;
    else hi = mid;
  }
  const end = candidate(el, st, hi);
  if (Math.abs(end.px - goal) < bestErr) best = end;
  return best;
}
function frozenDurs(st, slots, v) {
  const O = st.origin;
  const keys = ["tail", ...slots.map((s) => "main:" + s.id), "tail-end"];
  const at = [0, v >= O ? v - O : 0, ...slots.slice(1).map((s) => parseTime(s.time) - O), v < O ? v - O + 1440 : 1440, 1440];
  return new Map(keys.map((k, i) => [k, at[i + 1] - at[i]]));
}
function frame(el, st) {
  st.raf = 0;
  if (el._drag !== st) return;
  const cyclic = !st.weekly;
  const { r, durs } = solve(el, st);
  if (r.minutes === st.cur && st.last) return;
  st.cur = r.minutes;
  st.last = r.slots;
  const time = el.fmt(r.minutes);
  st.durs = durs;
  for (const [k, v] of durs) {
    setFlex(st.ctx.pieceEls.get(k), v);
    setFlex(st.ctx.segEls && st.ctx.segEls.get(k), v);
  }
  const ranges = slotRanges(r.slots, { cyclic });
  for (const rg of ranges) {
    const card = st.ctx.pieceEls.get("main:" + rg.slot.id);
    if (!card) continue;
    for (const n of card.querySelectorAll('[data-dr="time"],[data-dr="start"]')) n.textContent = el.fmt(rg.start);
    for (const n of card.querySelectorAll('[data-dr="end"]')) n.textContent = el.fmt(rg.end % 1440);
    const h = st.ctx.track.querySelector(`[data-handle][data-slot-id="${CSS.escape(rg.slot.id)}"]:not([data-alias])`);
    if (h) {
      h.setAttribute("aria-valuenow", rg.start);
      h.setAttribute("aria-valuetext", el.fmt(rg.start));
    }
  }
  if (st.frozen) {
    const early = r.minutes < st.origin;
    if (early) st.handle.dataset.hide = "";
    else delete st.handle.dataset.hide;
    if (st.alias) {
      if (early) st.alias.dataset.dragging = "";
      else delete st.alias.dataset.dragging;
    }
    const b = early ? st.alias : st.handle;
    const bub = b && b.querySelector(".dr-handle-time");
    if (bub) bub.textContent = time;
  } else {
    const bub = st.handle.querySelector(".dr-handle-time");
    if (bub) bub.textContent = time;
  }
  el._live(el._withDay(st.day, r.slots), { source: "drag", id: st.id, ...st.day ? { day: st.day } : {} });
}
function finish(el, st, cancel) {
  if (el._drag !== st) return;
  if (st.raf) {
    cancelAnimationFrame(st.raf);
    st.raf = 0;
  }
  delete el._$.root.dataset.dragging;
  for (const k of st.loose) {
    const n = st.ctx.pieceEls.get(k);
    if (n) delete n.dataset.dragmin;
  }
  el._drag = null;
  el._frozen = false;
  el._liveBase = null;
  el._value = st.base;
  el._syncForm();
  if (st.day && el._sel !== st.day) el.selectDay(st.day);
  if (cancel || st.cur === st.startMin) {
    el._schedule("data");
    return;
  }
  const cyclic = !st.weekly;
  const ok = el._edit(st.day, (slots) => ({ slots: shift(el, slots, st.id, st.cur, cyclic).slots }), { source: "drag", id: st.id });
  if (ok) {
    const s = el._locate(st.id);
    el._say(el.t("moved", { name: s && s.slot.label ? s.slot.label : el.t("slotDefault", { n: st.slots0.findIndex((x) => x.id === st.id) + 1 }), time: el.fmt(st.cur) }));
  } else el._schedule("data");
}
function onKey(el, e) {
  const h = handleOf(e);
  if (!h || h.hasAttribute("data-alias")) return;
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
    case "ArrowLeft":
    case "ArrowDown":
      target = cur - big;
      break;
    case "ArrowRight":
    case "ArrowUp":
      target = cur + big;
      break;
    case "PageUp":
      target = cur + 60;
      break;
    case "PageDown":
      target = cur - 60;
      break;
    case "Home":
      target = b.lo;
      break;
    case "End":
      target = b.hi;
      break;
    default:
      return;
  }
  e.preventDefault();
  const r = shift(el, slots, id, target, cyclic);
  if (r.minutes === cur) {
    el._refuse("min-gap", id);
    return;
  }
  el._focusHandle = id;
  if (day && el._sel !== day) el.selectDay(day);
  const ok = el._edit(day, (list) => ({ slots: shift(el, list, id, r.minutes, cyclic).slots }), { source: "keyboard", id });
  if (ok) {
    const now = Date.now();
    if (!el._lastMoveSay || now - el._lastMoveSay > 400) {
      el._lastMoveSay = now;
      el._say(el.t("moved", { name: s.label || el.t("slotDefault", { n: slots.indexOf(s) + 1 }), time: formatTime(r.minutes, { format: el.cfg.timeFormat }) }));
    }
  }
}

// src/ui/render/credits.js
var REPO = "https://github.com/MadeinTaly/dayrhythm";
var DONATE = "https://gt.1471995.xyz";
function creditsEl(el) {
  const mode = el.creditsMode;
  if (mode === "off") return null;
  const c = el._mk("div", "credits");
  const a = el._mk("a", "credits-link", { text: el.t("credits"), attrs: { href: REPO, target: "_blank", rel: "noopener" } });
  c.append(a);
  if (mode === "support") c.append(el._mk("a", "credits-donate", { text: el.t("donate"), attrs: { href: DONATE, target: "_blank", rel: "noopener" } }));
  return c;
}

// src/ui/render/root.js
var CSS2 = structureCSS + baseCSS + themeCSS + dialCSS;
var sheet = null;
var uidCounter = 0;
function docStyle() {
  if (document.head.querySelector("style[data-dayrhythm]")) return;
  const s = document.createElement("style");
  s.setAttribute("data-dayrhythm", "");
  s.textContent = `@layer theme, base, dayrhythm, components, utilities;
@layer dayrhythm{${CSS2}}`;
  document.head.prepend(s);
}
function adoptDocSheets(el, sr) {
  const build = () => {
    const out = [];
    for (const ss of document.styleSheets) {
      try {
        const css = [...ss.cssRules].map((r) => r.cssText).join("\n");
        const cs = new CSSStyleSheet();
        cs.replaceSync(css);
        out.push(cs);
      } catch (e) {
        if (!el._warned.has("xs")) {
          el._warned.add("xs");
          console.warn("[dayrhythm] inherit-styles: skipped a cross-origin or unreadable stylesheet");
        }
      }
    }
    sr.adoptedStyleSheets = [sheet, ...out];
  };
  build();
  if (el._mo) el._mo.disconnect();
  el._mo = new MutationObserver(build);
  el._mo.observe(document.head, { childList: true, subtree: true, characterData: true });
}
function attachStyles(el) {
  const cfg = el.cfg;
  if (!el._renderMode) el._renderMode = cfg.render === "light" ? "light" : "shadow";
  if (!el._uid) el._uid = "dr" + ++uidCounter;
  if (el._renderMode === "light") {
    docStyle();
    el.setAttribute("data-dr-uid", el._uid);
    return el;
  }
  const sr = el.shadowRoot || el.attachShadow({ mode: "open" });
  if (!el._sheetDone) {
    el._sheetDone = true;
    if (typeof CSSStyleSheet !== "undefined" && "adoptedStyleSheets" in sr) {
      if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS2);
      }
      sr.adoptedStyleSheets = [sheet];
    } else {
      const s = document.createElement("style");
      s.textContent = CSS2;
      sr.append(s);
    }
  }
  if (cfg.inheritStyles && "adoptedStyleSheets" in sr) adoptDocSheets(el, sr);
  return sr;
}
function region(el, name, main) {
  const r = el._mk(el._renderMode === "light" ? "div" : "slot", main);
  if (el._renderMode === "light") {
    r.classList.add("dr-region");
    for (const n of el._slotted[name] || []) r.append(n);
  } else r.setAttribute("name", name);
  return r;
}
function themeStyles(el, root, theme) {
  if (!theme.def) return;
  const s = document.createElement("style");
  const css = themeRules(theme.id, theme.def);
  s.textContent = el._renderMode === "light" ? `@layer dayrhythm{${css}}` : css;
  root.append(s);
}
function userStyles(el, root) {
  const css = el.cfg.styles;
  if (!css) return;
  const s = document.createElement("style");
  s.textContent = el._renderMode === "light" ? `@layer components{[data-dr-uid="${el._uid}"] .dr-root{${css}}}` : css;
  root.append(s);
}
function buildRoot(el) {
  const cfg = el.cfg;
  const host = attachStyles(el);
  const $ = el._$ = {};
  const root = el._mk("div", "root");
  $.root = root;
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", el.t(el.weekMode ? "titleWeek" : "title"));
  const theme = resolveTheme(cfg.theme);
  root.dataset.theme = theme.id;
  root.dataset.scheme = ["light", "dark"].includes(cfg.colorScheme) ? cfg.colorScheme : "auto";
  if (cfg.disabled) {
    root.dataset.disabled = "";
    root.inert = true;
  }
  if (cfg.readonly) root.dataset.readonly = "";
  for (const ev of ["input", "change"]) root.addEventListener(ev, (e) => {
    if (!(e instanceof CustomEvent)) e.stopPropagation();
  });
  $.header = region(el, "header", "header");
  $.weekTop = el._mk("div", "week-bar-slot");
  $.presets = el._mk("div", "presets");
  $.toolbar = el._mk("div", "toolbar");
  $.spectrum = el._mk("div", "spectrum", { attrs: { role: "img", "aria-label": el.t("spectrumAria") } });
  $.trackwrap = el._mk("div", "track-wrap");
  $.track = el._mk("div", "track", { attrs: { role: "list" } });
  $.footer = region(el, "footer", "footer");
  $.weekBottom = el._mk("div", "week-bar-slot");
  $.live = el._mk("div", "sr", { attrs: { role: "status", "aria-live": "polite" } });
  $.dialog = el._mk("dialog", "dialog");
  attachDrag(el);
  const credits = creditsEl(el);
  root.append($.header, $.weekTop, $.presets, $.toolbar, $.spectrum, $.trackwrap, $.footer, $.weekBottom, ...credits ? [credits] : [], $.live, $.dialog);
  themeStyles(el, root, theme);
  userStyles(el, root);
  if (el._root && el._root.parentNode) el._root.remove();
  el._root = root;
  host.append(root);
}

// src/ui/fields.js
function buildField(el, field, slotId, sess) {
  const wrap = el._mk("div", "field");
  const uid = `${el._uid}-f-${field.key}`;
  const cur = () => {
    const l = el._locate(slotId);
    return l && l.slot.values || {};
  };
  const value = cur()[field.key] !== void 0 ? cur()[field.key] : field.default;
  const set = (v, commit) => {
    const val = coerceField(field, v);
    (commit ? sess.commit : sess.input)({ values: { ...cur(), [field.key]: val } });
    return val;
  };
  if (field.accent) wrap.style.setProperty("--x-field-accent", field.accent);
  const custom = el._renderer("field", { field, value, slot: el.getSlot(slotId), set, t: el.t });
  if (applyRendered(wrap, custom)) return wrap;
  const label = fieldLabel(field, el.t);
  const lab = el._mk("label", "field-label", { text: label, attrs: { for: uid } });
  const t = field.type;
  if (t === "toggle") {
    const row = el._mk("div", "toggle-row");
    const cb = el._mk("input", "field-input", { generic: ["input"], attrs: { type: "checkbox", id: uid } });
    cb.checked = !!coerceField(field, value);
    cb.onchange = () => set(cb.checked, true);
    row.append(cb, lab);
    wrap.append(row);
    return wrap;
  }
  const out = el._mk("output", "field-value", { attrs: { for: uid } });
  const show2 = (v) => {
    out.textContent = fmtField(field, v, el.t);
  };
  const head = el._mk("div", "field-head");
  head.append(lab, out);
  let input;
  if (t === "select") {
    input = el._mk("select", "field-input", { generic: ["input"], attrs: { id: uid } });
    for (const o of field.options || []) {
      const op = document.createElement("option");
      op.value = String(o.value);
      op.textContent = optionLabel(field, o, el.t);
      input.append(op);
    }
    input.value = String(coerceField(field, value));
    input.onchange = () => {
      set(input.value, true);
      show2(input.value);
    };
    wrap.append(lab, input);
    return wrap;
  }
  input = el._mk("input", "field-input", { generic: ["input"], attrs: { id: uid } });
  if (t === "text") {
    input.type = "text";
    input.maxLength = 80;
    input.value = coerceField(field, value);
    input.oninput = () => set(input.value, false);
    input.onchange = () => set(input.value, true);
    wrap.append(lab, input);
    return wrap;
  }
  if (t === "color") {
    input.type = "color";
    input.value = coerceField(field, value);
    input.oninput = () => set(input.value, false);
    input.onchange = () => set(input.value, true);
    wrap.append(lab, input);
    return wrap;
  }
  input.type = t === "number" ? "number" : "range";
  if (field.min != null) input.min = field.min;
  if (field.max != null) input.max = field.max;
  if (field.step != null) input.step = field.step;
  const v0 = coerceField(field, value);
  input.value = v0;
  show2(v0);
  input.oninput = () => {
    if (input.value === "") return;
    show2(set(input.value, false));
  };
  input.onchange = () => {
    const v = set(input.value, true);
    input.value = v;
    show2(v);
  };
  wrap.append(head, input);
  return wrap;
}

// src/ui/dialog.js
var ERR = { "min-gap": "err.minGap", "duplicate-time": "err.duplicateTime", "time-format": "err.timeFormat", "min-slots": "err.minSlots", locked: "err.locked", "max-slots": "err.maxSlots" };
function shell(el, title, onClose) {
  const d = el._$.dialog;
  d.replaceChildren();
  d.setAttribute("aria-label", title);
  const header = el._mk("div", "dialog-header");
  const h = el._mk("h2", "dialog-title", { text: title });
  const x = el._mk("button", "button", { generic: ["button"], text: "\xD7", attrs: { "aria-label": el.t("close") } });
  x.onclick = () => d.close();
  header.append(h, x);
  const body = el._mk("div", "dialog-body");
  const actions = el._mk("div", "dialog-actions");
  d.append(header, body, actions);
  d.onclick = (e) => {
    if (e.target === d) d.close();
  };
  d.onclose = () => {
    onClose && onClose();
  };
  d.oncancel = () => {
  };
  return { d, h, body, actions };
}
function show(d) {
  if (d.open) return;
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", "");
}
function closeDialog(el, silent) {
  const d = el._$ && el._$.dialog;
  if (!d) return;
  if (silent) d.onclose = null;
  if (silent && el._editing) {
    const id = el._editing;
    el._editing = null;
    el._fire("slotclose", { id });
  }
  if (d.open && typeof d.close === "function") d.close();
  else d.removeAttribute("open");
}
function session(el, id, source) {
  let base = null;
  return {
    input(patch) {
      const loc = el._locate(id);
      if (!loc) return;
      if (!base) base = el._value;
      el._liveBase = base;
      const slots = clone(el._slotsOf(loc.day)).map((s) => s.id === id ? { ...s, ...patch } : s);
      el._live(el._withDay(loc.day, slots), { source, id, ...loc.day ? { day: loc.day } : {} });
      el._schedule("data");
    },
    commit(patch) {
      if (base) {
        el._value = base;
        el._liveBase = null;
        base = null;
      }
      el.updateSlot(id, patch);
    }
  };
}
function refocus(el, id) {
  queueMicrotask(() => {
    const t = el._$.track;
    const b = t && (t.querySelector(`[data-open="${CSS.escape(id)}"]`) || t.querySelector("[data-open]"));
    if (b) b.focus();
  });
}
function openEditor(el, id) {
  const loc = el._locate(id);
  if (!loc || el.cfg.readonly || el._badWeek) return;
  const cfg = el.cfg, t = el.t;
  const hasFields = el.models.some((m) => m.fields && m.fields.length);
  const mode = cfg.editor === "quick" || cfg.editor === "full" ? cfg.editor : cfg.rename || cfg.remove || cfg.timeEdit || hasFields ? "full" : "quick";
  const cur = () => {
    const l = el._locate(id);
    return l ? l.slot : null;
  };
  const slotName = () => {
    const s = cur();
    const l = el._locate(id);
    if (!s) return "";
    const idx = el._slotsOf(l.day).findIndex((x) => x.id === id);
    return s.label || t("slotDefault", { n: idx + 1 });
  };
  closeDialog(el, true);
  el._editing = id;
  const { d, h, body, actions } = shell(el, mode === "quick" ? t("pickModel", { name: slotName() }) : slotName(), () => {
    const eid = el._editing;
    el._editing = null;
    if (eid) el._fire("slotclose", { id: eid });
    refocus(el, id);
  });
  const sess = session(el, id, "values");
  const err = el._mk("p", "error", { attrs: { role: "alert" } });
  err.hidden = true;
  const fail = (reason) => {
    err.textContent = t(ERR[reason] || "err.locked", { minutes: el._minGap, time: "", min: el._minSlots, max: cfg.maxSlots });
    err.hidden = false;
  };
  if (mode === "full") {
    const s0 = cur();
    if (cfg.timeEdit) {
      const lab = el._mk("label", "label", { text: t("slotTime") });
      const inp = el._mk("input", "input", { generic: ["input"], attrs: { type: "time", step: "60", required: "" } });
      inp.value = s0.time;
      inp.disabled = isLocked(s0, "time");
      inp.onchange = () => {
        const e = el._retime(id, inp.value);
        if (e) {
          fail(e);
          inp.setAttribute("aria-invalid", "true");
          inp.value = cur().time;
        } else {
          err.hidden = true;
          inp.removeAttribute("aria-invalid");
        }
        h.textContent = slotName();
      };
      lab.append(inp);
      body.append(lab);
    }
    if (cfg.rename) {
      const lab = el._mk("label", "label", { text: t("slotName") });
      const inp = el._mk("input", "input", { generic: ["input"], attrs: { type: "text", maxlength: cfg.labelMax || 40, placeholder: t("slotDefault", { n: el._slotsOf(el._locate(id).day).findIndex((x) => x.id === id) + 1 }) } });
      inp.value = s0.label || "";
      inp.disabled = isLocked(s0, "label");
      inp.oninput = () => sess.input({ label: inp.value });
      inp.onchange = () => {
        sess.commit({ label: inp.value.trim() });
        h.textContent = slotName();
      };
      lab.append(inp);
      body.append(lab);
    }
  }
  const grid = el._mk("div", "model-grid", { attrs: { role: "radiogroup", "aria-label": t("pickModel", { name: slotName() }) } });
  const fieldsBox = el._mk("div", "fields");
  fieldsBox.style.cssText = "display:grid;gap:.8rem";
  const renderFields = () => {
    fieldsBox.replaceChildren();
    const s = cur();
    const m = s && el.modelOf(s.model);
    if (mode !== "full" || !m || !m.fields || !m.fields.length) return;
    for (const f of m.fields) fieldsBox.append(buildField(el, f, id, sess));
  };
  const pick = (mid) => {
    const s = cur();
    if (!s || s.model === mid || isLocked(s, "model")) {
      if (mode === "quick") d.close();
      return;
    }
    el.updateSlot(id, { model: mid });
    renderGrid();
    renderFields();
    if (mode === "quick") d.close();
  };
  const renderGrid = () => {
    grid.replaceChildren();
    const s = cur();
    if (!s) return;
    const l = el._locate(id);
    let list = modelsFor(el.models, s, l.day, cfg.modelFilter);
    const known = el.modelOf(s.model);
    if (known && !list.includes(known)) list = [known, ...list];
    const opts = [];
    list.forEach((m) => {
      const selected = m.id === s.model;
      const btn = el._mk("button", "model-option", { states: selected ? ["model-option-selected"] : [], class: m.classes, attrs: { role: "radio", "aria-checked": selected ? "true" : "false", tabindex: selected ? "0" : "-1", "data-model": m.id } });
      const custom = el._renderer("modelOption", { model: m, selected, slot: clone(s), t, preview: modelPreview(m, el.modelIndex(m.id), defaultValues(m), s) });
      if (!applyRendered(btn, custom)) {
        const sw = el._mk("span", "model-icon", { class: "dr-model-swatch" });
        sw.style.background = modelPreview(m, el.modelIndex(m.id), s.model === m.id ? s.values : defaultValues(m), s);
        if (m.off) sw.dataset.off = "";
        fillIcon(sw, m.icon);
        btn.append(sw, el._mk("span", "model-label", { text: el.label(m, m.id) }));
        if (m.hint) btn.title = m.hint;
      }
      btn.onclick = () => pick(m.id);
      grid.append(btn);
      opts.push(btn);
    });
    if (!known) {
      const u = el._mk("div", "model-option", { attrs: { "aria-disabled": "true" }, text: t("unknownModel", { id: s.model }) });
      u.style.opacity = ".7";
      grid.prepend(u);
    }
    grid.onkeydown = (e) => {
      const k = e.key;
      if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(k)) return;
      e.preventDefault();
      const i = Math.max(0, opts.findIndex((b) => b === b.getRootNode().activeElement));
      const n = opts[(i + (k === "ArrowRight" || k === "ArrowDown" ? 1 : opts.length - 1)) % opts.length];
      if (n) {
        n.focus();
        n.click();
      }
    };
  };
  if (!isLocked(cur(), "model")) {
    renderGrid();
    body.append(grid);
  }
  renderFields();
  body.append(fieldsBox, err);
  if (mode === "full") {
    const extra = el._renderMode === "light" ? el._mk("div", "region", { class: "dr-region" }) : el._mk("slot", "editor-extra");
    if (el._renderMode === "light") for (const n of el._slotted["editor-extra"] || []) extra.append(n);
    else extra.setAttribute("name", "editor-extra");
    body.append(extra);
    if (cfg.remove && !isLocked(cur(), "remove")) {
      const l = el._locate(id);
      const rm = el._mk("button", "button", { generic: ["button", "button-danger"], text: t("remove") });
      rm.disabled = el._slotsOf(l.day).length <= el._minSlots;
      rm.onclick = () => {
        if (el.removeSlot(id)) d.close();
        else fail("min-slots");
      };
      actions.append(rm);
    }
    const done = el._mk("button", "button", { generic: ["button", "button-primary"], text: t("done") });
    done.onclick = () => d.close();
    actions.append(done);
  } else {
    const c = el._mk("button", "button", { generic: ["button"], text: t("close") });
    c.onclick = () => d.close();
    actions.append(c);
  }
  show(d);
  el._fire("slotopen", { id });
}
function openSaveDay(el) {
  const t = el.t;
  const { d, body, actions } = shell(el, t("saveDayTitle"), () => refocusButton(el, "preset-save"));
  const lab = el._mk("label", "label", { text: t("dayName") });
  const inp = el._mk("input", "input", { generic: ["input"], attrs: { type: "text", maxlength: 40, placeholder: t("dayNamePlaceholder"), required: "" } });
  lab.append(inp);
  body.append(lab);
  const ok = el._mk("button", "button", { generic: ["button", "button-primary"], text: t("confirm") });
  const no = el._mk("button", "button", { generic: ["button"], text: t("cancel") });
  ok.disabled = true;
  inp.oninput = () => {
    ok.disabled = !inp.value.trim();
  };
  const go = () => {
    const n = inp.value.trim();
    if (!n) return;
    d.close();
    el._saveDay(n);
  };
  ok.onclick = go;
  inp.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  };
  no.onclick = () => d.close();
  actions.append(no, ok);
  show(d);
}
function refocusButton(el, part) {
  queueMicrotask(() => {
    const b = el._$.root.querySelector(`[data-part="${part}"]`);
    if (b) b.focus();
  });
}
function openCopy(el) {
  const t = el.t;
  const from = el._sel;
  const { d, body, actions } = shell(el, t("copyDayTitle", { day: el.dayName(from) }), () => refocusButton(el, "week-copy"));
  const short = el._mk("div", "toolbar");
  const grid = el._mk("div", "copy-grid");
  const boxes = /* @__PURE__ */ new Map();
  for (const day of el.dayOrder) {
    if (day === from) continue;
    const row = el._mk("label", "toggle-row");
    const cb = el._mk("input", "input", { generic: ["input"], attrs: { type: "checkbox" } });
    cb.style.width = "auto";
    row.append(cb, document.createTextNode(el.dayName(day)));
    grid.append(row);
    boxes.set(day, cb);
  }
  const preset = (label, days) => {
    const b = el._mk("button", "button", { generic: ["button"], text: label });
    b.onclick = () => {
      for (const [k, cb] of boxes) cb.checked = days.includes(k);
    };
    return b;
  };
  short.append(preset(t("copyWeekdays"), WEEKDAYS.slice(0, 5)), preset(t("copyWeekend"), WEEKDAYS.slice(5)), preset(t("copyAll"), WEEKDAYS));
  body.append(short, grid);
  const ok = el._mk("button", "button", { generic: ["button", "button-primary"], text: t("confirm") });
  const no = el._mk("button", "button", { generic: ["button"], text: t("cancel") });
  ok.onclick = () => {
    const to = [...boxes].filter(([, cb]) => cb.checked).map(([k]) => k);
    d.close();
    if (to.length) el.copyDay(from, to);
  };
  no.onclick = () => d.close();
  actions.append(no, ok);
  show(d);
}

// src/ui/render/weekbar.js
function dayPieces(el, day) {
  const slots = el._slotsOf(day);
  const c = carrySlotFor(el._weekView(), day, el._days);
  return buildLayout(slots, { cyclic: false, carry: c && c.slot }).pieces;
}
function slotColor(el, slot) {
  const m = el.modelOf(slot.model);
  const c = modelPreview(m, el.modelIndex(slot.model), slot.values, slot);
  return m && m.off ? "color-mix(in srgb, currentColor 18%, transparent)" : c;
}
function renderWeekBar(el) {
  const { weekTop, weekBottom } = el._$;
  weekTop.replaceChildren();
  weekBottom.replaceChildren();
  weekTop.hidden = weekBottom.hidden = true;
  if (!el.weekMode || el.weekRows) return;
  const pos = el.cfg.week === "bottom" ? weekBottom : weekTop;
  pos.hidden = false;
  pos.replaceChildren(weekBar(el));
}
function weekBar(el) {
  const cfg = el.cfg, t = el.t;
  const bar = el._mk("div", "week-bar");
  const prev = el._mk("button", "week-prev", { generic: ["button"], text: "\u2039", attrs: { "aria-label": t("prevDay") } });
  const next = el._mk("button", "week-next", { generic: ["button"], text: "\u203A", attrs: { "aria-label": t("nextDay") } });
  prev.onclick = () => el.prevDay();
  next.onclick = () => el.nextDay();
  const tabs = el._mk("div", "week-tablist", { attrs: { role: "tablist", "aria-label": t("weekLabel") } });
  const nowDay = el.nowDay;
  const order = el.dayOrder;
  for (const d of order) {
    const selected = d === el._sel;
    const slots = el._slotsOf(d);
    const ref = isWeek(el._value) && el._value.week[d] && el._value.week[d].ref;
    const linked = ref ? el._days.find((x) => x.id === ref) : null;
    const states = [];
    if (selected) states.push("week-tab-selected");
    if (d === nowDay) states.push("week-tab-today");
    if (ref) states.push("week-tab-linked");
    if (!slots.length) states.push("week-tab-empty");
    const summary = slots.length ? slots.slice(0, 4).map((s) => `${el.fmt(parseTime(s.time))} ${el.label(el.modelOf(s.model), s.model)}`).join(", ") + (slots.length > 4 ? "..." : "") : t("empty");
    const tab = el._mk("button", "week-tab", {
      states,
      attrs: {
        role: "tab",
        id: `${el._uid}-tab-${d}`,
        "aria-selected": selected ? "true" : "false",
        "aria-controls": `${el._uid}-panel`,
        tabindex: selected ? "0" : "-1",
        "aria-label": t("weekTabAria", { day: el.dayName(d), summary }),
        "data-day": d,
        title: linked ? t("linkedTo", { name: linked.name }) : null
      }
    });
    if (d === nowDay) tab.setAttribute("aria-current", "date");
    if (d === nowDay) tab.dataset.today = "";
    if (!slots.length) tab.dataset.empty = "";
    if (ref) tab.dataset.linked = "";
    const custom = el._renderer("weekTab", { day: d, label: el.dayName(d, "short"), slots: clone(slots), selected, today: d === nowDay, linked: linked ? clone(linked) : void 0 });
    if (!applyRendered(tab, custom)) {
      tab.append(
        el._mk("span", "week-tab-long", { class: "dr-tab-long", text: el.dayName(d, "short") }),
        el._mk("span", "week-tab-short", { class: "dr-tab-short", text: el.dayName(d, "narrow") })
      );
      if (cfg.weekPreview) {
        const pv = el._mk("span", "week-tab-preview");
        const stops = gradientStops(dayPieces(el, d), (s) => slotColor(el, s));
        if (stops) pv.style.background = `linear-gradient(90deg,${stops})`;
        tab.append(pv);
      }
    }
    tab.onclick = () => el.selectDay(d);
    tabs.append(tab);
  }
  tabs.onkeydown = (e) => {
    const i = order.indexOf(el._sel);
    let n = null;
    if (e.key === "ArrowRight") n = order[(i + 1) % 7];
    else if (e.key === "ArrowLeft") n = order[(i + 6) % 7];
    else if (e.key === "Home") n = order[0];
    else if (e.key === "End") n = order[6];
    if (n) {
      e.preventDefault();
      el._focusTab = n;
      el.selectDay(n);
    }
  };
  bar.append(prev, tabs, next);
  if (cfg.weekCopy && !cfg.readonly) {
    const cp = el._mk("button", "week-copy", { generic: ["button"], text: t("copyDayTo") });
    cp.onclick = () => openCopy(el);
    bar.append(cp);
  }
  bar.append(region(el, "week-extra", "week-extra"));
  return bar;
}

// src/ui/render/days.js
function renderPresets(el) {
  const box = el._$.presets;
  box.replaceChildren();
  const cfg = el.cfg;
  const showP = cfg.showPresets && (cfg.presets || []).length > 0 && !cfg.readonly;
  const showD = el.hasDaysArea && !cfg.readonly;
  box.hidden = !(showP || showD);
  if (box.hidden) return;
  const t = el.t;
  if (showP) {
    box.append(el._mk("div", "presets-label", { text: t("presetsLabel") }));
    const groups = /* @__PURE__ */ new Map();
    for (const p of cfg.presets) {
      const g = p.group || "";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(p);
    }
    for (const [g, list] of groups) {
      const row = el._mk("div", "presets-group");
      row.style.cssText = "display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center";
      if (g) row.append(el._mk("span", "presets-label", { text: t.has("group." + g) ? t("group." + g) : g }));
      for (const p of list) row.append(presetChip(el, p));
      box.append(row);
    }
  }
  if (showD) {
    box.append(el._mk("div", "presets-label", { text: t("daysLabel") }));
    const row = el._mk("div", "presets-group");
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center";
    for (const d of el._days) row.append(dayChip(el, d));
    if (!el._days.length) row.append(el._mk("span", "presets-label", { text: "-" }));
    box.append(row);
  }
}
function presetChip(el, p) {
  const busy = el._busy && el._busy.has(p.id);
  const b = el._mk("button", "preset", { states: busy ? ["preset-busy"] : [], attrs: { "aria-busy": busy ? "true" : "false", "data-preset": p.id } });
  const custom = el._renderer("preset", { preset: p, busy: !!busy });
  if (!applyRendered(b, custom)) {
    if (p.icon) {
      const i = el._mk("span", "model-icon");
      fillIcon(i, p.icon);
      b.append(i);
    }
    b.append(document.createTextNode(el.t.has("preset." + p.id) ? el.t("preset." + p.id) : p.label || p.id));
  }
  b.onclick = () => applyPreset(el, p);
  return b;
}
function dayChip(el, d) {
  const wrap = el._mk("span", "preset-row");
  wrap.style.cssText = "display:inline-flex;gap:.2rem;align-items:center;flex-wrap:wrap";
  if (el._confirmDel === d.id) {
    wrap.append(el._mk("span", "error", { text: el.t("deleteDayConfirm", { name: d.name }) }));
    const yes = el._mk("button", "button", { generic: ["button", "button-danger"], text: el.t("confirm") });
    const no = el._mk("button", "button", { generic: ["button"], text: el.t("cancel") });
    yes.onclick = () => {
      el._confirmDel = null;
      el._deleteDay(d);
    };
    no.onclick = () => {
      el._confirmDel = null;
      el._schedule("data");
    };
    wrap.append(yes, no);
    queueMicrotask(() => no.focus());
    return wrap;
  }
  const b = el._mk("button", "preset", { attrs: { "data-day-id": d.id } });
  b.textContent = d.name;
  b.onclick = () => applySlots(el, "day", d.id, d.slots);
  const x = el._mk("button", "preset-delete", { attrs: { "aria-label": `${el.t("deleteDay")}: ${d.name}` }, text: "\xD7" });
  x.onclick = () => {
    el._confirmDel = d.id;
    el._schedule("data");
  };
  wrap.append(b, x);
  return wrap;
}
async function applyPreset(el, p) {
  el._busy = el._busy || /* @__PURE__ */ new Set();
  if (el._busy.has(p.id)) return;
  el._busy.add(p.id);
  renderPresets(el);
  let slots;
  try {
    if (typeof p.slots === "function") slots = await p.slots();
    else if (Array.isArray(p.slots)) slots = p.slots;
    else if (p.slotsUrl) {
      const r = await fetch(p.slotsUrl);
      if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
      slots = await r.json();
    } else slots = [];
  } catch (error) {
    el._fire("error", { source: "preset", error });
    el._say(el.t("presetFailed"));
    slots = null;
  }
  el._busy.delete(p.id);
  renderPresets(el);
  if (slots) applySlots(el, "preset", p.id, slots);
}
function applySlots(el, kind, id, slots) {
  const weekly = el.weekMode;
  const ev = el._fire("dayselect", { kind, id, slots: clone(slots), ...weekly ? { day: el._sel } : {} }, true);
  if (ev.defaultPrevented) return;
  if (weekly && kind === "day" && el.cfg.linkDays) {
    el.assignDay(el._sel, { ref: id });
    return;
  }
  const fresh = (slots || []).filter((s) => s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)).map((s) => {
    const n = { ...clone(s), id: genId() };
    const rv = resolveValues(n, el.models);
    if (rv) n.values = rv;
    return n;
  });
  el._edit(weekly ? el._sel : null, () => ({ slots: normalizeDay(fresh) }), { source: kind });
}

// src/ui/render/toolbar.js
function renderToolbar(el) {
  const box = el._$.toolbar;
  box.replaceChildren();
  const cfg = el.cfg, t = el.t;
  const main = el._mk("div", "toolbar-main");
  if (!cfg.readonly) {
    if (cfg.add) {
      const b = el._mk("button", "add", { generic: ["button"], text: "+ " + t("add") });
      b.disabled = el._badWeek;
      b.onclick = () => {
        const s = el.addSlot();
        if (s) queueMicrotask(() => el.focusSlot(s.id));
      };
      main.append(b);
    }
    if (el.weekRows && cfg.weekCopy) {
      const b = el._mk("button", "week-copy", { generic: ["button"], text: t("copyDayTo") });
      b.onclick = () => openCopy(el);
      main.append(b);
    }
    if (el.weekRows) main.prepend(el._mk("span", "toolbar-day", { text: el.dayName(el._sel) }));
    if (cfg.randomize) {
      const b = el._mk("button", "randomize", { generic: ["button"], text: t("randomize") });
      b.onclick = () => el.randomize();
      main.append(b);
    }
    if (el.hasDaysArea) {
      const b = el._mk("button", "preset-save", { generic: ["button"], text: t("saveDay") });
      b.onclick = () => openSaveDay(el);
      main.append(b);
    }
  }
  box.append(main, region(el, "toolbar", "toolbar-extra"));
  box.hidden = !cfg.add && !cfg.randomize && !el.hasDaysArea && !(el.weekRows && cfg.weekCopy) && !(el._slotted.toolbar || []).length;
  if (cfg.readonly && !(el._slotted.toolbar || []).length) box.hidden = true;
}

// src/ui/dial-geometry.js
var TAU = Math.PI * 2;
var xy = (p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
var angleOf = (min) => mod(min, 1440) / 1440 * TAU;
function pointAt(min, r, cx = 100, cy = 100) {
  const a = angleOf(min);
  return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r };
}
var minutesAt = (x, y, cx = 100, cy = 100) => mod(Math.atan2(x - cx, cy - y) * 1440 / TAU, 1440);
function arcPath(start, end, ri, ro, cx = 100, cy = 100) {
  const span = end - start;
  if (span >= 1440) {
    const [o0, o1, i0, i1] = [pointAt(start, ro, cx, cy), pointAt(start + 720, ro, cx, cy), pointAt(start, ri, cx, cy), pointAt(start + 720, ri, cx, cy)];
    return `M${xy(o0)}A${ro} ${ro} 0 0 1 ${xy(o1)}A${ro} ${ro} 0 0 1 ${xy(o0)}ZM${xy(i0)}A${ri} ${ri} 0 0 0 ${xy(i1)}A${ri} ${ri} 0 0 0 ${xy(i0)}Z`;
  }
  const large = span > 720 ? 1 : 0;
  return `M${xy(pointAt(start, ro, cx, cy))}A${ro} ${ro} 0 ${large} 1 ${xy(pointAt(end, ro, cx, cy))}L${xy(pointAt(end, ri, cx, cy))}A${ri} ${ri} 0 ${large} 0 ${xy(pointAt(start, ri, cx, cy))}Z`;
}

// src/ui/dial.js
var RI = 62;
var RO = 88;
var RK = 75;
var NS = "http://www.w3.org/2000/svg";
function svg(tag, part, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  if (part) {
    n.setAttribute("class", part.split(" ").map((p) => "dr-" + p).join(" "));
    n.setAttribute("part", part);
  }
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
}
function rangesOf(el, slots, weekly) {
  const ranges = slotRanges(slots, { cyclic: !weekly });
  const c = weekly && carrySlotFor(el._weekView(), el._sel, el._days);
  const first = ranges.length ? ranges[0].start : 1440;
  if (c && first > 0) ranges.unshift({ slot: c.slot, start: 0, end: first, carry: true });
  return ranges;
}
function renderDial(el) {
  const $ = el._$;
  const weekly = el.weekMode;
  const slots = el._displaySlots();
  const ranges = rangesOf(el, slots, weekly);
  $.spectrum.hidden = true;
  const box = el._mk("div", "dial");
  const root = svg("svg", "dial-svg", { viewBox: "0 0 200 200", role: "group", "aria-label": el.t(weekly ? "titleWeek" : "title") });
  root.append(svg("circle", "dial-ring", { cx: 100, cy: 100, r: (RI + RO) / 2, fill: "none", "stroke-width": RO - RI }));
  const arcs = svg("g"), knobs = svg("g");
  for (let h = 0; h < 24; h++) {
    const a = pointAt(h * 60, RO + 3), b = pointAt(h * 60, RO + (h % 6 ? 5 : 8));
    root.append(svg("line", "dial-tick", { x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
    if (h % 6 === 0) {
      const p = pointAt(h * 60, RO + 14);
      const t = svg("text", "dial-tick-label", { x: p.x, y: p.y, "aria-hidden": "true" });
      t.textContent = el.fmt(h * 60);
      root.append(t);
    }
  }
  const now = svg("line", "dial-now", { x1: 100, y1: 100, x2: 100, y2: 100 });
  const center = svg("g", "dial-center");
  const lines = ["dial-center-time", "dial-center-label", "dial-center-summary", "dial-center-remaining"].map((p, i) => {
    const t = svg("text", p, { x: 100, y: [94, 106, 114, 121][i] });
    center.append(t);
    return t;
  });
  root.append(arcs, now, knobs, center);
  box.append(root);
  $.trackwrap.replaceChildren(box);
  $.dial = { root, arcs, knobs, now, lines, ranges };
  el._dial = $.dial;
  drawArcs(el, ranges);
  if (!el.cfg.readonly && !el._badWeek) {
    const bounds = (s) => boundaryBounds(slots, s.id, { minGap: el._minGap, cyclic: !weekly });
    sortSlots(slots).forEach((s, i) => {
      if (isLocked(s, "time") || !weekly && i === 0 && el.cfg.seamDrag === false) return;
      const b = bounds(s), m = parseTime(s.time), p = pointAt(m, RK), time = el.fmt(m);
      const k = svg("circle", "dial-handle", {
        cx: p.x,
        cy: p.y,
        r: 6,
        tabindex: 0,
        role: "slider",
        "aria-valuemin": b.lo,
        "aria-valuemax": b.hi,
        "aria-valuenow": m,
        "aria-valuetext": time,
        "aria-label": el.t("slotStartOf", { name: nameOf(el, s, i) }),
        "aria-description": el.t("slotHandleHint", { snap: el._snap }),
        "data-handle": "",
        "data-dial": "",
        "data-slot-id": s.id
      });
      knobs.append(k);
    });
  }
  root.addEventListener("pointerdown", (e) => onDown2(el, e));
  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-open]");
    if (a && !el.cfg.readonly) openEditor(el, a.dataset.open);
  });
  if (el._lastNow) updateDial(el, el._lastNow.n, el._lastNow.info);
}
function drawArcs(el, ranges) {
  const d = el._dial;
  d.arcs.replaceChildren();
  for (const r of ranges) {
    const active = el._active === r.slot.id;
    const p = svg("path", active ? "dial-arc dial-arc-active" : "dial-arc", {
      d: arcPath(r.start, r.end, RI, active ? RO + 4 : RO),
      "data-slot-id": r.slot.id,
      "data-open": r.carry ? null : r.slot.id
    });
    p.style.fill = slotColor(el, r.slot);
    if (!p.style.fill) p.style.fill = "color-mix(in srgb, currentColor 30%, transparent)";
    d.arcs.append(p);
  }
}
function updateDial(el, n, info) {
  const d = el._dial;
  if (!d) return;
  el._lastNow = { n, info };
  drawArcs(el, d.ranges);
  const showNow = el.cfg.nowLine && !el._drag && (!el.weekMode || el._sel === n.day);
  const tip = pointAt(n.minutes, RO + 2);
  d.now.setAttribute("x2", showNow ? tip.x : 100);
  d.now.setAttribute("y2", showNow ? tip.y : 100);
  d.now.style.display = showNow ? "" : "none";
  if (el._drag) return;
  const [time, label, summary, left] = d.lines;
  time.textContent = el.fmt(n.minutes);
  const slot = info && info.slot;
  const model = slot && el.modelOf(slot.model);
  label.textContent = slot ? slot.label || el.label(model, slot.model) : "";
  summary.textContent = slot ? modelSummary(model, slot.values, slot, el.t) : "";
  const rem = info && info.remaining;
  left.textContent = rem ? `-${Math.floor(rem / 60)}:${String(Math.round(rem % 60)).padStart(2, "0")}` : "";
}
function onDown2(el, e) {
  const k = e.target.closest && e.target.closest("[data-dial]");
  if (!k || el._drag || e.button && e.button > 0) return;
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
  k.dataset.dragging = "";
  try {
    k.setPointerCapture(e.pointerId);
  } catch (err) {
  }
  const pt = d.root.createSVGPoint();
  const move = (ev) => {
    pt.x = ev.clientX;
    pt.y = ev.clientY;
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
      n.setAttribute("cx", q.x);
      n.setAttribute("cy", q.y);
      n.setAttribute("aria-valuenow", m);
      n.setAttribute("aria-valuetext", el.fmt(m));
    }
    d.lines[0].textContent = el.fmt(r.minutes);
    el._live(el._withDay(day, r.slots), { source: "drag", id, ...day ? { day } : {} });
  };
  const end = () => {
    k.removeEventListener("pointermove", move);
    k.removeEventListener("pointerup", end);
    k.removeEventListener("pointercancel", end);
    el._drag = null;
    el._liveBase = null;
    el._value = base;
    el._syncForm();
    if (st.cur === start || !el._edit(day, (list) => ({ slots: shift(el, list, id, st.cur, !weekly).slots }), { source: "drag", id })) el._schedule("data");
  };
  k.addEventListener("pointermove", move);
  k.addEventListener("pointerup", end);
  k.addEventListener("pointercancel", end);
}

// src/ui/render/track.js
function setState(el, node, token, on, dataKey) {
  if (node.part) node.part.toggle(token, !!on);
  node.classList.toggle("dr-" + token, !!on);
  for (const c of classList((el.cfg.classes || {})[camel(token)])) node.classList.toggle(c, !!on);
  if (dataKey) {
    if (on) node.dataset[dataKey] = "";
    else delete node.dataset[dataKey];
  }
}
function nameOf(el, slot, index) {
  return slot.label || el.t("slotDefault", { n: index + 1 });
}
function handleFor(el, slot, index, seam, bounds, orient) {
  const time = el.fmt(parseTime(slot.time));
  const name = nameOf(el, slot, index);
  const h = el._mk("div", "handle", { states: seam ? ["handle-seam"] : [] });
  h.setAttribute("role", "slider");
  h.tabIndex = 0;
  h.setAttribute("aria-orientation", orient);
  if (bounds) {
    h.setAttribute("aria-valuemin", bounds.lo);
    h.setAttribute("aria-valuemax", bounds.hi);
  }
  h.setAttribute("aria-valuenow", parseTime(slot.time));
  h.setAttribute("aria-valuetext", time);
  h.setAttribute("aria-label", seam ? el.t("seamHandle", { time }) : el.t("slotStartOf", { name }));
  h.setAttribute("aria-description", el.t("slotHandleHint", { snap: el._snap }));
  h.dataset.handle = "";
  h.dataset.slotId = slot.id;
  const grip = el._mk("span", "handle-grip");
  grip.setAttribute("aria-hidden", "true");
  const bubble = el._mk("span", "handle-time", { text: time });
  bubble.setAttribute("aria-hidden", "true");
  h.append(grip, bubble);
  return h;
}
function slotCtx(el, slot, range, index, count, day, extra) {
  const model = el.modelOf(slot.model) || { id: slot.model, label: el.t("unknownModel", { id: slot.model }), unknown: true };
  return {
    slot: clone(slot),
    model,
    values: slot.values,
    index,
    count,
    start: el.fmt(range.start),
    end: el.fmt(range.end),
    duration: range.duration,
    day,
    active: el._active === slot.id,
    invalid: !!extra.invalid,
    readonly: !!el.cfg.readonly,
    t: el.t,
    preview: extra.preview
  };
}
function cardFor(el, p, info) {
  const { ranges, index, count, day, invalid, carry } = info;
  const slot = p.slot;
  const model = el.modelOf(slot.model);
  const preview = modelPreview(model, el.modelIndex(slot.model), slot.values, slot);
  const states = [];
  if (p.kind === "tail") states.push("slot-tail");
  if (p.kind === "carry") states.push("slot-carry");
  const active = el._active === slot.id;
  if (active) states.push("slot-active");
  if (invalid || !model) states.push("slot-invalid");
  if (p.kind === "main" && isLocked(slot, "time") && isLocked(slot, "remove")) states.push("slot-locked");
  const card = el._mk(p.kind === "carry" ? "button" : "div", "slot", { states, class: model && model.classes });
  card.dataset.slotId = slot.id;
  card.dataset.piece = p.key;
  if (active) card.dataset.active = "";
  if (invalid || !model) card.dataset.invalid = "";
  if (model && model.off) card.dataset.off = "";
  card.style.flex = `${p.dur} 1 0`;
  if (p.dur <= 0) card.dataset.zero = "";
  const tint = el._mk("span", "slot-tint");
  tint.style.background = preview;
  card.append(tint);
  if (p.kind === "tail") {
    card.setAttribute("aria-hidden", "true");
    return card;
  }
  const content = el._mk("div", "slot-content");
  if (p.kind === "carry") {
    const dn = el.dayName(carry.day);
    card.setAttribute("aria-label", el.t("goToDay", { day: dn }) + ": " + el.t("carryFrom", { day: dn }));
    const ic = el._mk("span", "slot-icon");
    fillIcon(ic, model && model.icon);
    content.append(ic, el._mk("span", "slot-label", { text: el.t("carryFrom", { day: dn }) }));
    card.append(content);
    card.onclick = () => el.selectDay(carry.day);
    return card;
  }
  const r = ranges.find((x) => x.slot.id === slot.id);
  const ctx = slotCtx(el, slot, r, index, count, day, { invalid: invalid || !model, preview });
  const mname = el.label(model, slot.model);
  const summary = modelSummary(model, slot.values, slot, el.t);
  card.setAttribute("role", "listitem");
  card.setAttribute("aria-label", el.t("slotAria", { name: nameOf(el, slot, index), start: el.fmt(r.start), end: el.fmt(r.end), model: mname }));
  if (active) card.setAttribute("aria-current", "true");
  if (!applyRendered(content, el._renderer("slotContent", ctx))) {
    const time = el._mk("span", "slot-time", { text: el.fmt(r.start), attrs: { "data-dr": "time" } });
    const label = el._mk("span", "slot-label");
    if (!applyRendered(label, el._renderer("slotLabel", ctx))) label.textContent = nameOf(el, slot, index);
    const ro = el.cfg.readonly;
    const mb = el._mk(ro ? "span" : "button", "slot-model", { attrs: ro ? {} : { "aria-label": `${nameOf(el, slot, index)}: ${el.t("changeModel")} (${mname})`, "data-open": slot.id } });
    const ic = el._mk("span", "slot-icon");
    if (!applyRendered(ic, el._renderer("modelIcon", ctx))) fillIcon(ic, model && model.icon);
    mb.append(ic, el._mk("span", "slot-model-name", { text: mname }));
    if (summary) mb.append(el._mk("span", "slot-summary", { text: summary }));
    content.append(time, label, mb);
  }
  card.append(content);
  if (el.cfg.readonly) card.tabIndex = 0;
  return card;
}
function stateBox(el, kind) {
  const b = el._mk("div", "state", { attrs: { role: kind === "error" ? "alert" : "status" } });
  if (kind === "loading") b.textContent = el.t("loading");
  else if (kind === "error") {
    b.append(el._mk("span", "error", { text: el.t("loadFailed", { error: el._state.error && el._state.error.message || "" }) }));
    const r = el._mk("button", "button", { generic: ["button"], text: el.t("retry") });
    r.onclick = () => el.reloadData();
    b.append(r);
  } else {
    b.append(document.createTextNode(el.t("empty")));
    if (!el.cfg.readonly && el.cfg.add && !el._badWeek) {
      const a = el._mk("button", "add", { generic: ["button"], text: "+ " + el.t("add") });
      a.onclick = () => el.addSlot();
      b.append(a);
    } else b.append(region(el, "empty", "empty"));
  }
  return b;
}
function fillTrack(el, track, slots, layout, { weekly, day, carry, orient }) {
  const cfg = el.cfg;
  const ranges = slotRanges(slots, { cyclic: !weekly });
  const issues = new Set(validateDay(slots, { minGap: el._minGap, cyclic: !weekly }).map((i) => i.id));
  const bounds = {};
  for (const s of slots) bounds[s.id] = boundaryBounds(slots, s.id, { minGap: el._minGap, cyclic: !weekly });
  const pieceEls = /* @__PURE__ */ new Map();
  track.replaceChildren();
  track.dataset.orient = orient;
  track.style.setProperty("--n", layout.pieces.length);
  const frag = document.createDocumentFragment();
  const canDrag = !cfg.readonly && !el._badWeek;
  layout.pieces.forEach((p) => {
    const idx = slots.findIndex((s) => s.id === p.slot.id);
    if (canDrag && p.kind === "main" && !isLocked(p.slot, "time")) {
      const seam = !weekly && idx === 0;
      if (!(seam && cfg.seamDrag === false)) frag.append(handleFor(el, p.slot, idx, seam, bounds[p.slot.id], orient));
    }
    if (canDrag && p.key === "tail-end") {
      const h = handleFor(el, p.slot, 0, true, bounds[p.slot.id], orient);
      h.dataset.alias = "";
      h.removeAttribute("role");
      h.removeAttribute("tabindex");
      h.setAttribute("aria-hidden", "true");
      frag.append(h);
    }
    const card = cardFor(el, p, { ranges, index: idx, count: slots.length, day, invalid: issues.has(p.slot.id), carry });
    pieceEls.set(p.key, card);
    frag.append(card);
  });
  track.append(frag);
  return pieceEls;
}
function renderTrack(el, o = {}) {
  const $ = el._$;
  const cfg = el.cfg;
  const weekly = el.weekMode;
  const orient = el.resolvedOrientation;
  el._pieceEls = /* @__PURE__ */ new Map();
  el._rows = null;
  $.trackwrap.removeAttribute("role");
  delete $.trackwrap.dataset.rows;
  if (el._state.status !== "idle") {
    $.spectrum.hidden = true;
    $.trackwrap.replaceChildren(stateBox(el, el._state.status));
    el._dial = null;
    $.dial = null;
    return;
  }
  if (cfg.layout === "dial") {
    renderDial(el);
    return;
  }
  el._dial = null;
  $.dial = null;
  if (el.weekRows) {
    renderRows(el);
    return;
  }
  const slots = el._displaySlots();
  const day = weekly ? el._sel : void 0;
  const carry = weekly ? carrySlotFor(el._weekView(), day, el._days) : null;
  if (!slots.length && !carry) {
    $.spectrum.hidden = true;
    $.trackwrap.replaceChildren(stateBox(el, "empty"));
    el._layout = { origin: 0, pieces: [] };
    return;
  }
  $.spectrum.hidden = !cfg.spectrum;
  if (weekly) {
    $.trackwrap.setAttribute("role", "tabpanel");
    $.trackwrap.id = `${el._uid}-panel`;
    $.trackwrap.setAttribute("aria-labelledby", `${el._uid}-tab-${el._sel}`);
  }
  const layout = buildLayout(slots, { cyclic: !weekly, origin: weekly ? "midnight" : cfg.origin === "midnight" ? "midnight" : "first", carry: carry && carry.slot, frozen: o.frozen });
  el._layout = layout;
  const track = $.track;
  track.setAttribute("aria-label", el.t(weekly ? "titleWeek" : "title"));
  el._pieceEls = fillTrack(el, track, slots, layout, { weekly, day, carry, orient });
  $.trackwrap.replaceChildren(track);
  $.spectrum.replaceChildren(...layout.pieces.map((p) => {
    const seg = el._mk("span", "spectrum-segment");
    seg.style.flex = `${p.dur} 1 0`;
    seg.style.background = slotColor(el, p.slot);
    seg.dataset.piece = p.key;
    return seg;
  }));
  el._segEls = new Map([...$.spectrum.children].map((s) => [s.dataset.piece, s]));
  track.onclick = (e) => {
    const b = e.target.closest && e.target.closest("[data-open]");
    if (b) openEditor(el, b.dataset.open);
  };
}
function renderRows(el) {
  const $ = el._$;
  $.spectrum.hidden = true;
  $.trackwrap.dataset.rows = "";
  const box = el._mk("div", "week-rows", { attrs: { role: "group", "aria-label": el.t("titleWeek") } });
  const axis = el._mk("div", "week-axis", { attrs: { "aria-hidden": "true" } });
  const ticks = el._mk("div", "week-axis-ticks");
  for (const h of [0, 6, 12, 18, 24]) {
    const tk = el._mk("span", "week-axis-tick", { text: String(h) });
    tk.style.left = `${h / 24 * 100}%`;
    ticks.append(tk);
  }
  axis.append(el._mk("span", "week-axis-spacer"), ticks);
  box.append(axis);
  el._rows = /* @__PURE__ */ new Map();
  const nowDay = el.nowDay;
  const view = el._weekView();
  for (const d of el.dayOrder) {
    const selected = d === el._sel;
    const states = [];
    if (selected) states.push("week-row-selected");
    if (d === nowDay) states.push("week-row-today");
    const row = el._mk("div", "week-row", { states });
    row.dataset.day = d;
    if (selected) row.dataset.selected = "";
    if (d === nowDay) row.dataset.today = "";
    const lab = el._mk("button", "week-row-day", { text: el.dayName(d, "short"), attrs: { "aria-pressed": selected ? "true" : "false", "aria-label": el.dayName(d), "data-day": d } });
    lab.onclick = () => el.selectDay(d);
    const slots = el._slotsOf(d);
    const c = carrySlotFor(view, d, el._days);
    const track = el._mk("div", "track", { attrs: { role: "list", "aria-label": el.dayName(d) } });
    track.dataset.rowDay = d;
    const layout = buildLayout(slots, { cyclic: false, carry: c && c.slot });
    const pieceEls = fillTrack(el, track, slots, layout, { weekly: true, day: d, carry: c, orient: "horizontal" });
    el._rows.set(d, { layout, pieceEls, segEls: null });
    if (selected) {
      el._layout = layout;
      el._pieceEls = pieceEls;
    }
    row.append(lab, track);
    box.append(row);
  }
  box.onclick = (e) => {
    const b = e.target.closest && e.target.closest("[data-open]");
    if (!b) return;
    const row = b.closest("[data-row-day]");
    if (row && row.dataset.rowDay !== el._sel) el.selectDay(row.dataset.rowDay);
    openEditor(el, b.dataset.open);
  };
  $.trackwrap.replaceChildren(box);
}
function updateNow(el, force) {
  const $ = el._$;
  if (!$.track) return;
  const cfg = el.cfg;
  const n = nowOf(cfg);
  if (!force && el._nowDay && el._nowDay !== n.day) {
    el._nowDay = n.day;
    el._schedule("data");
    return;
  }
  el._nowDay = n.day;
  let info = null;
  if (isWeek(el._value)) info = activeSlotAtWeek(el._value, { day: n.day, time: n.minutes }, { days: el._days });
  else info = activeSlotAtDay(el._value, n.minutes);
  el._active = info ? info.slot.id : null;
  if ($.dial) {
    updateDial(el, n, info);
    return;
  }
  for (const card2 of $.trackwrap.querySelectorAll(".dr-slot")) {
    const on = card2.dataset.slotId === el._active;
    setState(el, card2, "slot-active", on, "active");
    if (on && card2.dataset.piece && card2.dataset.piece.startsWith("main:")) card2.setAttribute("aria-current", "true");
    else card2.removeAttribute("aria-current");
  }
  if ($.nowLine) {
    $.nowLine.remove();
    $.nowLine = null;
  }
  if (!cfg.nowLine || !el._layout || el._frozen) return;
  let layout = el._layout, pieceEls = el._pieceEls;
  if (el._rows) {
    const r = el._rows.get(n.day);
    if (!r) return;
    ({ layout, pieceEls } = r);
  } else if (el.weekMode && el._sel !== n.day) return;
  const at = pieceAt(layout, n.minutes);
  const card = at && pieceEls && pieceEls.get(at.piece.key);
  if (!card) return;
  const line = el._mk("div", "now-line", { attrs: { role: "img", "aria-label": el.t("nowAria", { time: el.fmt(n.minutes) }) } });
  const pct = `${(at.frac * 100).toFixed(3)}%`;
  if (el._rows || el.resolvedOrientation === "horizontal") line.style.left = pct;
  else line.style.top = pct;
  line.append(el._mk("span", "now-badge", { text: el.t("nowLabel") }));
  card.append(line);
  $.nowLine = line;
}

// src/ui/render.js
function buildRoot2(el) {
  buildRoot(el);
  renderData(el);
}
function renderData(el) {
  const $ = el._$;
  if (!$.root) return;
  $.root.dataset.orient = el.resolvedOrientation;
  $.root.setAttribute("aria-busy", el._state.status === "loading" ? "true" : "false");
  $.root.setAttribute("aria-label", el.t(el.weekMode ? "titleWeek" : "title"));
  renderWeekBar(el);
  renderPresets(el);
  renderToolbar(el);
  renderTrack(el);
  updateNow(el, true);
  if (el._focusHandle) {
    const h = $.trackwrap.querySelector(`[data-handle][data-slot-id="${CSS.escape(el._focusHandle)}"]:not([data-alias])`);
    if (h) h.focus();
    el._focusHandle = null;
  }
  if (el._focusTab) {
    const t = $.root.querySelector(`[data-day="${el._focusTab}"]`);
    if (t) t.focus();
    el._focusTab = null;
  }
}

// src/ui/commands.js
var ERR_KEY = {
  "min-gap": "err.minGap",
  "max-slots": "err.maxSlots",
  "min-slots": "err.minSlots",
  "duplicate-time": "err.duplicateTime",
  locked: "err.locked",
  "time-format": "err.timeFormat"
};
function detail(el, previous, meta) {
  const d = { value: clone(el._value), resolved: el._resolved(), previous: clone(previous), ...meta };
  if (d.day === void 0 || d.day === null) delete d.day;
  return d;
}
function _commit(el, next, meta) {
  const previous = el._value;
  el._value = next;
  el._syncForm();
  el._fire("change", detail(el, previous, meta));
  el._schedule("data");
}
function _live(el, next, meta) {
  const previous = el._liveBase || el._value;
  el._value = next;
  el._syncForm();
  el._fire("input", detail(el, previous, meta));
}
function _withDay(el, day, slots) {
  return !el.weekMode ? slots : withDay(el._expandWeek(), day, slots);
}
function _refuse(el, reason, id, extra = {}) {
  const limit = reason === "max-slots" ? el.cfg.maxSlots : reason === "min-slots" ? el._minSlots : reason === "min-gap" ? el._minGap : void 0;
  const d = { reason };
  if (id) d.id = id;
  if (limit !== void 0) d.limit = limit;
  el._fire("slotinvalid", d);
  el._say(el.t(ERR_KEY[reason] || "err.locked", {
    minutes: el._minGap,
    max: el.cfg.maxSlots,
    min: el._minSlots,
    time: extra.time || ""
  }));
}
function _edit(el, day, fn, meta) {
  const d = el.weekMode ? day || el._sel : null;
  let slots = clone(el._slotsOf(d));
  let detachedFrom = null;
  if (d && isWeek(el._value) && isRef(el._value.week[d])) {
    detachedFrom = el._days.find((x) => x.id === el._value.week[d].ref) || { name: el._value.week[d].ref };
    const used = /* @__PURE__ */ new Set();
    for (const k of WEEKDAYS) if (Array.isArray(el._value.week[k])) el._value.week[k].forEach((s) => used.add(s.id));
    slots = slots.map((s) => used.has(s.id) ? { ...s, id: genId() } : s);
  }
  const r = fn(slots);
  if (!r) return false;
  if (r.error) {
    _refuse(el, r.error, meta && meta.id, r);
    return false;
  }
  const out = normalizeDay(r.slots || r);
  const m = { ...meta };
  if (d) m.day = d;
  if (detachedFrom) {
    m.detached = true;
    el._say(el.t("detached", { day: el.dayName(d), name: detachedFrom.name }));
  }
  _commit(el, _withDay(el, d, out), m);
  return r;
}
function _carryOf(el, day) {
  const view = el._weekView();
  const r = resolveWeek(view, el._days);
  const i = WEEKDAYS.indexOf(day);
  for (let k = 1; k <= 7; k++) {
    const d = WEEKDAYS[mod(i - k, 7)];
    if (r[d].length) return r[d][r[d].length - 1];
  }
  return null;
}
function addSlot(el, partial = {}, opts = {}) {
  const day = opts.day || el._sel;
  if (el._badWeek) return null;
  let added = null;
  const ok = _edit(el, day, (slots) => {
    let template = null;
    if (el.weekMode && !slots.length) {
      const carried = _carryOf(el, day);
      template = carried ? { model: carried.model, values: carried.values } : null;
    }
    const model = partial.model ? el.modelOf(partial.model) : null;
    const r = addSlotAt(slots, {
      time: partial.time,
      minGap: el._minGap,
      snap: el._snap,
      maxSlots: el.cfg.maxSlots,
      cyclic: !el.weekMode,
      template,
      model: partial.model,
      label: partial.label
    });
    if (r.error) return r;
    added = { ...r.added, ...clone(partial), id: r.added.id, time: r.added.time };
    if (partial.model && !partial.values) {
      const dv = defaultValues(model);
      if (dv) added.values = dv;
      else delete added.values;
    }
    const rv = resolveValues(added, el.models);
    if (rv) added.values = rv;
    return { slots: r.slots.map((s) => s.id === added.id ? added : s) };
  }, { source: "add" });
  if (!ok || !added) return null;
  el._say(el.t("added"));
  if (opts.edit) queueMicrotask(() => openEditor(el, added.id));
  return clone(added);
}
function removeSlot(el, id) {
  const loc = el._locate(id);
  if (!loc) return false;
  return !!_edit(el, loc.day, (slots) => {
    const r = removeSlotById(slots, id, { minSlots: el._minSlots });
    return Array.isArray(r) ? { slots: r } : r;
  }, { source: "remove", id }) && (el._say(el.t("removed")), true);
}
function updateSlot(el, id, patch) {
  const loc = el._locate(id);
  if (!loc) return null;
  let out = null;
  const ok = _edit(el, loc.day, (slots) => {
    const i = slots.findIndex((s2) => s2.id === id);
    let s = { ...slots[i], ...clone(patch), id };
    if (s.label === "") delete s.label;
    if (patch.model && patch.model !== slots[i].model && !patch.values) {
      const dv = defaultValues(el.modelOf(patch.model));
      if (dv) s.values = dv;
      else delete s.values;
    }
    if (patch.time !== void 0) {
      const r = retimeSlot(slots.map((x, k) => k === i ? s : x), id, s.time, { minGap: el._minGap, cyclic: !el.weekMode });
      if (r.error) return r;
      out = r.slots.find((x) => x.id === id);
      return { slots: r.slots };
    }
    const rv = resolveValues(s, el.models);
    if (rv) s.values = rv;
    out = s;
    return { slots: slots.map((x, k) => k === i ? s : x) };
  }, {
    source: patch.model ? "model" : patch.values ? "values" : patch.label !== void 0 ? "label" : patch.time !== void 0 ? "time" : "api",
    id
  });
  return ok ? clone(out) : null;
}
function moveSlot(el, id, time) {
  const loc = el._locate(id);
  const m = tryParseTime(time);
  if (!loc || m == null) return false;
  if (isLocked(loc.slot, "time")) {
    _refuse(el, "locked", id);
    return false;
  }
  return !!_edit(el, loc.day, (slots) => {
    const r = moveBoundary(slots, id, m, { snap: el._snap, minGap: el._minGap, cyclic: !el.weekMode });
    return { slots: r.slots };
  }, { source: "time", id });
}
function _retime(el, id, time) {
  const loc = el._locate(id);
  if (!loc) return "time-format";
  let err = null;
  _edit(el, loc.day, (slots) => {
    const r = retimeSlot(slots, id, time, { minGap: el._minGap, cyclic: !el.weekMode });
    if (r.error) {
      err = r.error;
      return { error: r.error, time };
    }
    return { slots: r.slots };
  }, { source: "time", id });
  return err;
}
function randomize(el, filter) {
  if (el._badWeek) return;
  const pool = el.models.filter((m) => !m.off);
  if (!pool.length) return;
  _edit(el, el._sel, (slots) => ({
    slots: slots.map((s) => {
      const cur = el.modelOf(s.model);
      if (typeof filter === "function" && !filter(cur, s)) return s;
      const opts = pool.filter((m2) => m2.id !== s.model);
      const m = (opts.length ? opts : pool)[Math.floor(Math.random() * (opts.length || pool.length))];
      const dv = defaultValues(m);
      const n = { ...s, model: m.id };
      if (dv) n.values = dv;
      else delete n.values;
      return n;
    })
  }), { source: "randomize" });
}
function copyDay2(el, from, to, opts = {}) {
  if (!el.weekMode || el._badWeek) return false;
  const targets = expandTargets(to, from);
  if (!targets.length) return false;
  const previous = el._value;
  const next = copyDay(el._expandWeek(), from, targets, { newIds: opts.newIds !== false });
  el._value = el._norm(next);
  el._syncForm();
  el._fire("change", detail(el, previous, { source: "copy", day: from }));
  el._say(el.t("copyDone", { days: targets.map((d) => el.dayName(d)).join(", ") }));
  el._schedule("data");
  return true;
}
function assignDay(el, day, slotsOrRef) {
  if (!el.weekMode || !el._validDay(day)) return false;
  const previous = el._value;
  el._value = el._norm(withDay(el._expandWeek(), day, slotsOrRef));
  el._syncForm();
  el._fire("change", detail(el, previous, { source: "day", day }));
  el._schedule("data");
  return true;
}

// src/element.js
var Base = typeof HTMLElement !== "undefined" ? HTMLElement : class {
};
var NO_PROP = /* @__PURE__ */ new Set(["add", "remove", "randomize", "value", "day"]);
var DayRhythmElement = class extends Base {
  static get version() {
    return VERSION;
  }
  static get formAssociated() {
    return true;
  }
  static get observedAttributes() {
    return [...Object.keys(ATTRS), "config"];
  }
  static define(tag = "day-rhythm") {
    if (typeof customElements !== "undefined" && !customElements.get(tag)) customElements.define(tag, this);
  }
  constructor() {
    super();
    this._L = { script: {}, attrJson: {}, prop: {}, attrs: {}, props: {} };
    this._cfg = null;
    this._value = [];
    this._propValue = void 0;
    this._days = [];
    this._sel = null;
    this._state = { status: "idle", error: null };
    this._pending = 0;
    this._slotted = {};
    this._$ = {};
    this._active = null;
    this._editing = null;
    this._init = false;
    this._daySaveListeners = 0;
    this._readyFired = false;
    this._warned = /* @__PURE__ */ new Set();
    try {
      this._internals = this.attachInternals ? this.attachInternals() : null;
    } catch (e) {
      this._internals = null;
    }
  }
  // ---------------------------------------------------------------- lifecycle
  connectedCallback() {
    if (!this._init) {
      this._init = true;
      this._collectSlotted();
      this._readScript();
      this._readConfigAttr();
      this._readAttrs();
      this._cfg = null;
      let attrValue;
      const rawValue = this.getAttribute("value");
      if (rawValue !== null) {
        try {
          attrValue = JSON.parse(rawValue);
        } catch (e) {
          this._configError(e);
        }
      }
      const v = this._propValue !== void 0 ? this._propValue : attrValue !== void 0 ? attrValue : this.cfg.value !== void 0 ? this.cfg.value : this._defaultValue();
      this._value = this._norm(v);
      this._days = (this.cfg.days || []).map(clone);
      this._sel = this._validDay(this.getAttribute("day")) || this._validDay(this.cfg.day) || this.nowDay;
    }
    this._connected = true;
    if (typeof this.setAttribute === "function") this.setAttribute("data-dr-host", "");
    this._build();
    this._observe();
    this._startClock();
    if (!this._readyFired) {
      this._readyFired = true;
      if (this.cfg.load) this.reloadData();
      queueMicrotask(() => this._fire("ready", {}));
    }
  }
  disconnectedCallback() {
    this._connected = false;
    clearTimeout(this._timer);
    if (this._ro) this._ro.disconnect();
    if (this._mo) this._mo.disconnect();
    document.removeEventListener("visibilitychange", this._vis);
    closeDialog(this, true);
  }
  attributeChangedCallback(name, oldV, newV) {
    if (!this._init || oldV === newV || this._reflecting) return;
    if (name === "config") this._readConfigAttr();
    else if (name === "day") {
      const d = this._validDay(newV);
      if (d) this.selectDay(d, true);
      return;
    } else if (name === "value") {
      if (newV !== null) {
        try {
          this.setValue(JSON.parse(newV));
        } catch (e) {
          this._configError(e);
        }
      }
      return;
    } else this._readAttrs();
    this._invalidate();
  }
  addEventListener(type, ...rest) {
    if (type === "daysave") this._daySaveListeners++;
    return super.addEventListener(type, ...rest);
  }
  // ---------------------------------------------------------------- configuration
  get cfg() {
    if (!this._cfg) {
      const L = this._L;
      this._cfg = mergeConfig(defaults, L.script, L.attrJson, L.prop, L.attrs, L.props);
    }
    return this._cfg;
  }
  get config() {
    return this.cfg;
  }
  set config(v) {
    this._L.prop = isPlain(v) ? v : {};
    this._invalidate();
    this._configValue(v);
  }
  configure(partial) {
    this._L.prop = mergeConfig(this._L.prop, partial);
    this._invalidate();
    this._configValue(partial);
  }
  /** A `value` in a config set after the first connection replaces the value, as it would have at connection. */
  _configValue(c) {
    if (this._init && isPlain(c) && c.value !== void 0) {
      this._cfg = null;
      this.setValue(c.value);
    }
  }
  reloadConfig() {
    this._readScript();
    this._readConfigAttr();
    this._readAttrs();
    this._invalidate();
  }
  /** JSON-safe subset of what the app supplied (config layers, no built-in defaults). */
  exportConfig(opts) {
    const L = this._L;
    const c = jsonSafe(mergeConfig(L.script, L.attrJson, L.prop, L.attrs, L.props)) || {};
    if (opts && opts.includeValue) c.value = clone(this._value);
    else delete c.value;
    return c;
  }
  _configError(error) {
    if (!this._warned.has("cfg:" + error.message)) {
      this._warned.add("cfg:" + error.message);
      console.error("[dayrhythm] invalid config:", error.message);
    }
    this._fire("error", { source: "config", error });
  }
  _readScript() {
    this._L.script = {};
    const s = [...this.children].find((c) => c.tagName === "SCRIPT" && /json/i.test(c.type));
    if (s) {
      try {
        this._L.script = JSON.parse(s.textContent || "{}");
      } catch (e) {
        this._configError(e);
      }
    }
    this._warnUnknown(this._L.script);
  }
  _readConfigAttr() {
    this._L.attrJson = {};
    const raw = this.getAttribute("config");
    if (raw) {
      try {
        this._L.attrJson = JSON.parse(raw);
      } catch (e) {
        this._configError(e);
      }
      this._warnUnknown(this._L.attrJson);
    }
  }
  _readAttrs() {
    const out = {};
    for (const [attr, [key, type]] of Object.entries(ATTRS)) {
      if (attr === "value" || attr === "day") continue;
      const raw = this.getAttribute(attr);
      if (raw === null) continue;
      try {
        const v = parseAttr(type, raw);
        if (v !== void 0) out[key] = key === "credits" ? v === "minimal" ? true : v : v;
      } catch (e) {
        this._configError(e);
      }
    }
    for (const b of ["randomize", "readonly", "disabled"]) if (this.hasAttribute(b)) out[b] = !/^(false|off|0)$/i.test(this.getAttribute(b));
    this._L.attrs = out;
  }
  _warnUnknown(obj) {
    if (!isPlain(obj)) return;
    for (const k of Object.keys(obj)) {
      if (!KNOWN.has(k) && !this._warned.has(k)) {
        this._warned.add(k);
        console.warn(`[dayrhythm] unknown config key "${k}" ignored`);
      }
    }
  }
  _invalidate() {
    this._cfg = null;
    if (this._init && this._connected) this._schedule("build");
  }
  _schedule(kind) {
    if (!this._connected) return;
    this._need = kind === "build" ? "build" : this._need || "data";
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => {
      this._queued = false;
      const n = this._need;
      this._need = null;
      if (!this._connected) return;
      if (n === "build") this._build();
      else if (n) renderData(this);
    });
  }
  // ---------------------------------------------------------------- derived config
  get locale() {
    return this.cfg.locale || typeof document !== "undefined" && document.documentElement.lang || "en";
  }
  set locale(v) {
    this._L.props.locale = v;
    this._invalidate();
  }
  get clockOffset() {
    return this.cfg.clockOffset;
  }
  /** Moves only the now line: no rebuild, so periodic clock syncs keep an open dialog or a drag. */
  set clockOffset(v) {
    this._L.props.clockOffset = v;
    this._cfg = null;
    this._updateNow();
  }
  get t() {
    return this._t;
  }
  fmt(min) {
    return formatTime(min, { format: this.cfg.timeFormat });
  }
  /** Weekly value shown as seven editable rows (opt-in) instead of one focused day under the week bar (default). */
  get weekRows() {
    return this.weekMode && this.cfg.weekLayout === "rows";
  }
  get weekMode() {
    const w = this.cfg.week;
    return w === "off" ? false : w === "top" || w === "bottom" ? true : isWeek(this._value);
  }
  get _badWeek() {
    return this.cfg.week === "off" && isWeek(this._value);
  }
  get _minSlots() {
    const m = this.cfg.minSlots;
    return m != null ? m : this.weekMode ? 0 : 1;
  }
  get _minGap() {
    return Math.max(1, +this.cfg.minGap || 5);
  }
  get _snap() {
    const s = +this.cfg.snap || 5;
    return 60 % s === 0 ? s : 5;
  }
  get creditsMode() {
    return normalizeCredits(this.cfg.credits);
  }
  get models() {
    return this.cfg.models && this.cfg.models.length ? this.cfg.models : defaults.models;
  }
  set models(v) {
    this._L.props.models = v;
    this._invalidate();
  }
  get days() {
    return this._days;
  }
  set days(v) {
    this._days = Array.isArray(v) ? v.map(clone) : [];
    this._schedule("data");
  }
  modelOf(id) {
    return this.models.find((m) => m.id === id) || null;
  }
  modelIndex(id) {
    return Math.max(0, this.models.findIndex((m) => m.id === id));
  }
  label(model, id) {
    return modelLabel(model, id, this.t);
  }
  get storageAdapter() {
    return this._adapter !== void 0 ? this._adapter : this._adapter = adapterFrom(this.cfg.storage);
  }
  get hasDaysArea() {
    return !!(this.cfg.showDays && (this.storageAdapter || this._daySaveListeners || this._days.length));
  }
  get dayOrder() {
    const f = this.cfg.firstDay;
    return orderedWeekdays(f && f !== "auto" ? f : firstDayOfWeek(this.locale));
  }
  dayName(d, style = "long") {
    const i = WEEKDAYS.indexOf(d);
    try {
      return new Intl.DateTimeFormat(this.locale, { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)));
    } catch (e) {
      return d;
    }
  }
  get resolvedOrientation() {
    const o = this.cfg.orientation;
    if (o === "horizontal" || o === "vertical") return o;
    return this._width >= (+this.cfg.breakpoint || 640) ? "horizontal" : "vertical";
  }
  get editing() {
    return this._editing;
  }
  get now() {
    return nowOf(this.cfg).minutes;
  }
  get nowDay() {
    return nowOf(this.cfg).day;
  }
  _validDay(d) {
    return WEEKDAYS.includes(d) ? d : null;
  }
  // ---------------------------------------------------------------- properties for individual options
  get value() {
    return clone(this._value);
  }
  set value(v) {
    this._propValue = v;
    if (this._init) this.setValue(v);
  }
  get day() {
    return this._sel;
  }
  set day(d) {
    this.selectDay(d);
  }
  // ---------------------------------------------------------------- value handling
  _defaultValue() {
    const ms = this.models;
    const on = ms.find((m) => !m.off) || ms[0];
    const off = ms.find((m) => m.off) || ms[1] || ms[0];
    return [{ time: "07:00", model: on.id }, { time: "22:00", model: off.id }];
  }
  /** Sorted, ids assigned (unique across the week), values resolved, unparseable times dropped (reported). */
  _norm(v) {
    const seen = /* @__PURE__ */ new Set();
    const day = (arr) => {
      const good = [];
      for (const s of Array.isArray(arr) ? arr : []) {
        if (!s || tryParseTime(s.time) == null) {
          const e = new RangeError(`Slot ignored, invalid time: ${JSON.stringify(s && s.time)}`);
          console.warn("[dayrhythm]", e.message);
          queueMicrotask(() => this._fire("error", { source: "load", error: e }));
          continue;
        }
        let id = s.id;
        if (!id || seen.has(id)) id = genId();
        seen.add(id);
        const slot = { ...clone(s), id };
        const rv = resolveValues(slot, this.models);
        if (rv) slot.values = rv;
        good.push(slot);
      }
      return sortSlots(good);
    };
    if (isWeek(v)) {
      const week = {};
      for (const d of WEEKDAYS) {
        const e = v.week && v.week[d];
        if (Array.isArray(e)) week[d] = day(e);
        else if (isRef(e)) week[d] = { ref: e.ref };
      }
      return { ...clone(v), week };
    }
    return day(Array.isArray(v) ? v : this._defaultValue());
  }
  _syncForm() {
    if (this._internals && this._internals.setFormValue) {
      try {
        this._internals.setFormValue(this.cfg.name ? JSON.stringify(this._value) : null);
      } catch (e) {
      }
    }
  }
  setValue(v) {
    this._value = this._norm(v);
    this._flattenIfOff();
    this._syncForm();
    if (this.weekMode && !this._validDay(this._sel)) this._sel = this.nowDay;
    if (this._editing && !this._locate(this._editing)) closeDialog(this, true);
    this._schedule("data");
  }
  setDay(slots) {
    if (!this.weekMode) return this.setValue(slots);
    this._value = this._norm(withDay(this._expandWeek(), this._sel, slots));
    this._syncForm();
    this._schedule("data");
  }
  getValue(opts = {}) {
    let v = clone(this._value);
    if (opts.resolve && isWeek(v)) v = { ...v, week: resolveWeek(v, this._days) };
    if (opts.compact) v = this._compact(v);
    return v;
  }
  _compact(v) {
    const strip = (slots) => slots.map((s) => {
      const o = { ...s };
      delete o.id;
      const rv = resolveValues({ ...s, values: void 0 }, this.models);
      if (o.values && rv && deepEqual(o.values, rv)) delete o.values;
      return o;
    });
    if (isWeek(v)) {
      const week = {};
      for (const d of Object.keys(v.week)) week[d] = Array.isArray(v.week[d]) ? strip(v.week[d]) : v.week[d];
      return { ...v, week };
    }
    return strip(v);
  }
  /** week="off" with a weekly value: keep one day (the `day` option, else the selected day, else today) as the daily value. */
  _flattenIfOff() {
    if (!this._badWeek) return;
    const d = this._validDay(this.cfg.day) || this._validDay(this._sel) || this.nowDay;
    console.warn(`[dayrhythm] week="off": weekly value reduced to ${d}`);
    let slots = resolveWeek(this._value, this._days)[d];
    if (!slots.length) {
      const c = carrySlotFor(this._value, d, this._days);
      slots = c ? [{ ...c.slot, id: void 0, time: "00:00" }] : this._defaultValue();
    }
    this._value = this._norm(slots);
    this._syncForm();
  }
  _resolved() {
    return isWeek(this._value) ? resolveWeek(this._value, this._days) : clone(this._value);
  }
  /** Read-only weekly view (a daily array under a week bar means "same every day"). */
  _weekView() {
    if (isWeek(this._value)) return this._value;
    const week = {};
    for (const d of WEEKDAYS) week[d] = this._value;
    return { week };
  }
  /** Editable weekly value: a daily array is expanded to seven days (fresh ids on the other six). */
  _expandWeek() {
    if (isWeek(this._value)) return this._value;
    const week = {};
    for (const d of WEEKDAYS) week[d] = d === this._sel ? this._value : this._value.map((s) => ({ ...clone(s), id: genId() }));
    return { week };
  }
  _slotsOf(day) {
    const v = this._value;
    if (this._badWeek) return [];
    if (!isWeek(v)) return v;
    const e = v.week[day];
    if (Array.isArray(e)) return e;
    if (isRef(e)) {
      const d = this._days.find((x) => x.id === e.ref);
      return d ? sortSlots(d.slots) : [];
    }
    return [];
  }
  /** Valid, sorted slots of the day being displayed. */
  _displaySlots() {
    return this._slotsOf(this.weekMode ? this._sel : null);
  }
  getDay(day) {
    return clone(this._slotsOf(this.weekMode ? day || this._sel : null));
  }
  getWeek(opts = {}) {
    if (!this.weekMode) return null;
    return opts.resolve ? resolveWeek(this._weekView(), this._days) : clone(this._weekView());
  }
  _locate(id) {
    const days = this.weekMode ? [this._sel, ...WEEKDAYS.filter((d) => d !== this._sel)] : [null];
    for (const d of days) {
      const slot = this._slotsOf(d).find((s) => s.id === id);
      if (slot) return { day: d, slot };
    }
    return null;
  }
  getSlot(id) {
    const l = this._locate(id);
    return l ? clone(l.slot) : null;
  }
  activeSlot(at) {
    let r;
    const opts = this.cfg.timezone ? { timeZone: this.cfg.timezone } : void 0;
    if (isWeek(this._value)) {
      const a = at === void 0 ? this._nowAt() : at;
      r = activeSlotAt(this._value, a, { ...opts, days: this._days });
    } else r = activeSlotAt(this._value, at === void 0 ? this.now : at, opts);
    return r ? clone(r.slot) : null;
  }
  _nowAt() {
    const n = nowOf(this.cfg);
    return { day: n.day, time: n.minutes };
  }
  // ---------------------------------------------------------------- edits
  _fire(name, detail2, cancelable) {
    const e = new CustomEvent(name, { detail: detail2, bubbles: true, composed: true, cancelable: !!cancelable });
    this.dispatchEvent(e);
    return e;
  }
  _commit(...args) {
    return _commit(this, ...args);
  }
  /** Update the draft and fire a coalesced `input` (no re-render; caller updates the DOM). */
  _live(...args) {
    return _live(this, ...args);
  }
  _withDay(...args) {
    return _withDay(this, ...args);
  }
  _refuse(...args) {
    return _refuse(this, ...args);
  }
  /**
   * Runs fn(slotsCopy) -> new slots | {slots,...} | {error} | null on the day, then commits.
   * Editing a day linked to a saved day detaches it (copy-on-write).
   */
  _edit(...args) {
    return _edit(this, ...args);
  }
  addSlot(...args) {
    return addSlot(this, ...args);
  }
  _carryOf(...args) {
    return _carryOf(this, ...args);
  }
  removeSlot(...args) {
    return removeSlot(this, ...args);
  }
  updateSlot(...args) {
    return updateSlot(this, ...args);
  }
  moveSlot(...args) {
    return moveSlot(this, ...args);
  }
  /** Editor time field: may reorder slots. Returns null | error reason. */
  _retime(...args) {
    return _retime(this, ...args);
  }
  randomize(...args) {
    return randomize(this, ...args);
  }
  // ---------------------------------------------------------------- week
  selectDay(d, fromAttr) {
    if (!this._validDay(d)) return;
    const previous = this._sel;
    if (d === previous) return;
    this._sel = d;
    if (!fromAttr && this.getAttribute("day") !== d) {
      this._reflecting = true;
      this.setAttribute("day", d);
      this._reflecting = false;
    }
    if (this._editing) closeDialog(this, true);
    this._fire("dayview", { day: d, previous });
    this._say(this.t("dayView", { day: this.dayName(d) }));
    this._schedule("data");
  }
  _stepDay(dir) {
    const o = this.dayOrder;
    this.selectDay(o[mod(o.indexOf(this._sel) + dir, 7)]);
  }
  prevDay() {
    this._stepDay(-1);
  }
  nextDay() {
    this._stepDay(1);
  }
  copyDay(...args) {
    return copyDay2(this, ...args);
  }
  assignDay(...args) {
    return assignDay(this, ...args);
  }
  // ---------------------------------------------------------------- editor / focus
  openEditor(id) {
    openEditor(this, id);
  }
  closeEditor() {
    closeDialog(this);
  }
  focusSlot(id) {
    const b = this._$.track && this._$.track.querySelector(`[data-slot-id="${CSS.escape(id)}"] button, [data-slot-id="${CSS.escape(id)}"]`);
    if (b) b.focus();
  }
  // ---------------------------------------------------------------- data loading (declarative `load`, saved days)
  async reloadData() {
    const l = this.cfg.load;
    if (!l || !l.url) return;
    const seq = ++this._loadSeq || (this._loadSeq = 1);
    this._state = { status: "loading", error: null };
    this._schedule("data");
    try {
      const r = await fetch(l.url, { method: l.method || "GET", headers: l.headers, credentials: l.credentials });
      if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
      const data = await r.json();
      if (seq !== this._loadSeq) return;
      this._state = { status: "idle", error: null };
      this.setValue(data);
    } catch (error) {
      if (seq !== this._loadSeq) return;
      this._state = { status: "error", error };
      this._fire("error", { source: "load", error });
      this._schedule("data");
    }
  }
  async _loadStorage() {
    const a = this.storageAdapter;
    if (!a) return;
    try {
      this._days = (await a.list() || []).map(clone);
      this._schedule("data");
    } catch (error) {
      this._fire("error", { source: "storage", error });
    }
  }
  /** Saved-day plumbing used by the UI: fires daysave/daydelete then calls the adapter. */
  async _saveDay(name) {
    const slots = clone(this._displaySlots()).map(({ id, ...s }) => s);
    const waits = [];
    this._fire("daysave", { name, slots, waitUntil: (p) => waits.push(Promise.resolve(p)) });
    try {
      await Promise.all(waits);
      const a = this.storageAdapter;
      if (a) {
        await a.save({ name, slots });
        this._days = (await a.list() || []).map(clone);
      }
      this._say(this.t("daySaved"));
    } catch (error) {
      this._fire("error", { source: "storage", error });
    }
    this._schedule("data");
  }
  async _deleteDay(day) {
    const waits = [];
    this._fire("daydelete", { day: clone(day), waitUntil: (p) => waits.push(Promise.resolve(p)) });
    try {
      await Promise.all(waits);
      const a = this.storageAdapter;
      if (a) {
        await a.remove(day.id);
        this._days = (await a.list() || []).map(clone);
      } else this._days = this._days.filter((d) => d.id !== day.id);
      if (isWeek(this._value)) {
        const week = { ...this._value.week };
        let changed = false;
        for (const d of WEEKDAYS) {
          if (isRef(week[d]) && week[d].ref === day.id) {
            week[d] = normalizeDay(clone(day.slots).map((s) => ({ ...s, id: genId() })));
            changed = true;
          }
        }
        if (changed) this._commit({ ...this._value, week }, { source: "day" });
      }
    } catch (error) {
      this._fire("error", { source: "storage", error });
    }
    this._schedule("data");
  }
  // ---------------------------------------------------------------- clock
  syncClock(t) {
    this._L.props.clockOffset = offsetFor(t, this.cfg);
    this._cfg = null;
    this._updateNow();
  }
  _startClock() {
    clearTimeout(this._timer);
    document.removeEventListener("visibilitychange", this._vis);
    this._vis = () => {
      if (!document.hidden) {
        this._updateNow();
        this._startClock();
      } else clearTimeout(this._timer);
    };
    document.addEventListener("visibilitychange", this._vis);
    this._timer = setTimeout(() => {
      this._updateNow();
      this._startClock();
    }, msToNextMinute());
  }
  _renderTrack(o) {
    renderTrack(this, o);
  }
  _updateNow() {
    if (this._connected) updateNow(this);
  }
  _observe() {
    if (typeof ResizeObserver === "undefined") return;
    if (!this._ro) {
      this._ro = new ResizeObserver((entries2) => {
        const w = Math.round(entries2[0].contentRect.width);
        if (w === this._width) return;
        const before = this.resolvedOrientation;
        this._width = w;
        if (this.resolvedOrientation !== before) this._schedule("data");
      });
    }
    this._ro.observe(this);
    this._width = Math.round(this.getBoundingClientRect().width);
  }
  // ---------------------------------------------------------------- a11y / misc
  _say(text) {
    const r = this._$ && this._$.live;
    if (!r) return;
    r.textContent = "";
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(() => {
      r.textContent = text;
    }, 30);
  }
  _collectSlotted() {
    for (const c of [...this.children]) {
      const s = c.getAttribute && c.getAttribute("slot");
      if (s) (this._slotted[s] = this._slotted[s] || []).push(c);
    }
  }
  /** Runs a renderer override safely; failures are reported and the default is used. */
  _renderer(name, ctx) {
    const fn = this.cfg.renderers && this.cfg.renderers[name];
    if (typeof fn !== "function") return null;
    try {
      return fn(ctx);
    } catch (error) {
      this._fire("error", { source: "render", error });
      return null;
    }
  }
  validate() {
    const o = { minGap: this._minGap, models: this.models };
    if (this.weekMode) return validateWeek(this._weekView(), { ...o, days: this._days });
    return validateDay(this._value, o);
  }
  // element factory used by all UI modules (part + class hooks)
  _mk(tag, main, o = {}) {
    const e = document.createElement(tag);
    const g = o.generic || [];
    const s = o.states || [];
    const tokens = [...g, main, ...s];
    e.className = tokens.map((x) => "dr-" + x).join(" ");
    e.setAttribute("part", tokens.join(" "));
    e.dataset.part = main;
    const c = this.cfg.classes || {};
    for (const tk of tokens) e.classList.add(...classList(c[camel(tk)]));
    if (o.class) e.classList.add(...classList(o.class));
    if (o.text != null) e.textContent = o.text;
    if (o.attrs) {
      for (const [k, v] of Object.entries(o.attrs)) if (v != null) e.setAttribute(k, v);
    }
    if (tag === "button") e.type = "button";
    return e;
  }
  _build() {
    this._t = makeT(this.locale, this.cfg.messages);
    this._adapter = void 0;
    if (this._sel == null) this._sel = this._validDay(this.cfg.day) || this.nowDay;
    if (this.cfg.day !== this._cfgDay) {
      this._cfgDay = this.cfg.day;
      const d = this._validDay(this.cfg.day);
      if (d) this._sel = d;
    }
    this._flattenIfOff();
    buildRoot2(this);
    if (this._storageRef !== this.cfg.storage) {
      this._storageRef = this.cfg.storage;
      this._loadStorage();
    }
  }
};
var PROP_KEYS = [...Object.keys(defaults), "renderers", "modelFilter", "clock"].filter((k) => !NO_PROP.has(k) && !(k in DayRhythmElement.prototype));
for (const k of PROP_KEYS) {
  Object.defineProperty(DayRhythmElement.prototype, k, {
    configurable: true,
    get() {
      return this.cfg[k];
    },
    set(v) {
      if (Object.is(this._L.props[k], v)) return;
      this._L.props[k] = v;
      this._invalidate();
    }
  });
}

// src/index.js
var packs = {
  register(pack) {
    if (pack && pack.id) this[pack.id] = pack;
    return pack;
  }
};
DayRhythmElement.define("day-rhythm");
var index_default = DayRhythmElement;
export {
  DayRhythmElement,
  core_exports as core,
  index_default as default,
  defaults,
  httpStorageAdapter,
  localStorageAdapter,
  locales,
  mergeConfig,
  packs,
  themes,
  VERSION as version
};
