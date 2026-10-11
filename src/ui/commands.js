// Slot and day editing commands. Each function is deliberately plain so the element stays thin.
import { tryParseTime, WEEKDAYS, mod } from '../core/time.js';
import {
  normalizeDay, sortSlots, resolveValues, addSlotAt, removeSlotById, moveBoundary,
  pushBoundary, genId, clone, isLocked, retimeSlot,
} from '../core/slots.js';
import { isWeek, isRef, resolveWeek, withDay, copyDay as copyDayCore, expandTargets } from '../core/week.js';
import { defaultValues } from './model.js';
import { openEditor } from './dialog.js';

const ERR_KEY = {
  'min-gap': 'err.minGap', 'max-slots': 'err.maxSlots', 'min-slots': 'err.minSlots',
  'duplicate-time': 'err.duplicateTime', locked: 'err.locked', 'time-format': 'err.timeFormat',
};

function detail(el, previous, meta) {
  const d = { value: clone(el._value), resolved: el._resolved(), previous: clone(previous), ...meta };
  if (d.day === undefined || d.day === null) delete d.day;
  return d;
}

export function _commit(el, next, meta) {
  const previous = el._value;
  el._value = next;
  el._syncForm();
  el._fire('change', detail(el, previous, meta));
  el._schedule('data');
}

export function _live(el, next, meta) {
  const previous = el._liveBase || el._value;
  el._value = next;
  el._syncForm();
  el._fire('input', detail(el, previous, meta));
}

export function _withDay(el, day, slots) {
  return !el.weekMode ? slots : withDay(el._expandWeek(), day, slots);
}

export function _refuse(el, reason, id, extra = {}) {
  const limit = reason === 'max-slots' ? el.cfg.maxSlots : reason === 'min-slots' ? el._minSlots : reason === 'min-gap' ? el._minGap : undefined;
  const d = { reason };
  if (id) d.id = id;
  if (limit !== undefined) d.limit = limit;
  el._fire('slotinvalid', d);
  el._say(el.t(ERR_KEY[reason] || 'err.locked', {
    minutes: el._minGap, max: el.cfg.maxSlots, min: el._minSlots, time: extra.time || '',
  }));
}

/** Runs an immutable day edit and commits it, detaching linked saved days first. */
export function _edit(el, day, fn, meta) {
  const d = el.weekMode ? day || el._sel : null;
  let slots = clone(el._slotsOf(d));
  let detachedFrom = null;
  if (d && isWeek(el._value) && isRef(el._value.week[d])) {
    detachedFrom = el._days.find((x) => x.id === el._value.week[d].ref) || { name: el._value.week[d].ref };
    const used = new Set();
    for (const k of WEEKDAYS) if (Array.isArray(el._value.week[k])) el._value.week[k].forEach((s) => used.add(s.id));
    slots = slots.map((s) => (used.has(s.id) ? { ...s, id: genId() } : s));
  }
  const r = fn(slots);
  if (!r) return false;
  if (r.error) { _refuse(el, r.error, meta && meta.id, r); return false; }
  const out = normalizeDay(r.slots || r);
  const m = { ...meta };
  if (d) m.day = d;
  if (detachedFrom) {
    m.detached = true;
    el._say(el.t('detached', { day: el.dayName(d), name: detachedFrom.name }));
  }
  _commit(el, _withDay(el, d, out), m);
  return r;
}

export function _carryOf(el, day) {
  const view = el._weekView();
  const r = resolveWeek(view, el._days);
  const i = WEEKDAYS.indexOf(day);
  for (let k = 1; k <= 7; k++) {
    const d = WEEKDAYS[mod(i - k, 7)];
    if (r[d].length) return r[d][r[d].length - 1];
  }
  return null;
}

export function addSlot(el, partial = {}, opts = {}) {
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
      time: partial.time, minGap: el._minGap, snap: el._snap, maxSlots: el.cfg.maxSlots, cyclic: !el.weekMode,
      template, model: partial.model, label: partial.label,
    });
    if (r.error) return r;
    added = { ...r.added, ...clone(partial), id: r.added.id, time: r.added.time };
    if (partial.model && !partial.values) {
      const dv = defaultValues(model);
      if (dv) added.values = dv; else delete added.values;
    }
    const rv = resolveValues(added, el.models);
    if (rv) added.values = rv;
    return { slots: r.slots.map((s) => (s.id === added.id ? added : s)) };
  }, { source: 'add' });
  if (!ok || !added) return null;
  el._say(el.t('added'));
  if (opts.edit) queueMicrotask(() => openEditor(el, added.id));
  return clone(added);
}

export function removeSlot(el, id) {
  const loc = el._locate(id);
  if (!loc) return false;
  return !!_edit(el, loc.day, (slots) => {
    const r = removeSlotById(slots, id, { minSlots: el._minSlots });
    return Array.isArray(r) ? { slots: r } : r;
  }, { source: 'remove', id }) && (el._say(el.t('removed')), true);
}

export function updateSlot(el, id, patch) {
  const loc = el._locate(id);
  if (!loc) return null;
  let out = null;
  const ok = _edit(el, loc.day, (slots) => {
    const i = slots.findIndex((s) => s.id === id);
    let s = { ...slots[i], ...clone(patch), id };
    if (s.label === '') delete s.label;
    if (patch.model && patch.model !== slots[i].model && !patch.values) {
      const dv = defaultValues(el.modelOf(patch.model));
      if (dv) s.values = dv; else delete s.values;
    }
    if (patch.time !== undefined) {
      const r = retimeSlot(slots.map((x, k) => (k === i ? s : x)), id, s.time, { minGap: el._minGap, cyclic: !el.weekMode });
      if (r.error) return r;
      out = r.slots.find((x) => x.id === id);
      return { slots: r.slots };
    }
    const rv = resolveValues(s, el.models);
    if (rv) s.values = rv;
    out = s;
    return { slots: slots.map((x, k) => (k === i ? s : x)) };
  }, {
    source: patch.model ? 'model' : patch.values ? 'values' : patch.label !== undefined ? 'label' : patch.time !== undefined ? 'time' : 'api',
    id,
  });
  return ok ? clone(out) : null;
}

export function moveSlot(el, id, time) {
  const loc = el._locate(id);
  const m = tryParseTime(time);
  if (!loc || m == null) return false;
  if (isLocked(loc.slot, 'time')) { _refuse(el, 'locked', id); return false; }
  return !!_edit(el, loc.day, (slots) => {
    const r = moveBoundary(slots, id, m, { snap: el._snap, minGap: el._minGap, cyclic: !el.weekMode });
    return { slots: r.slots };
  }, { source: 'time', id });
}

export function _retime(el, id, time) {
  const loc = el._locate(id);
  if (!loc) return 'time-format';
  let err = null;
  _edit(el, loc.day, (slots) => {
    const r = retimeSlot(slots, id, time, { minGap: el._minGap, cyclic: !el.weekMode });
    if (r.error) { err = r.error; return { error: r.error, time }; }
    return { slots: r.slots };
  }, { source: 'time', id });
  return err;
}

export function randomize(el, filter) {
  if (el._badWeek) return;
  const pool = el.models.filter((m) => !m.off);
  if (!pool.length) return;
  _edit(el, el._sel, (slots) => ({
    slots: slots.map((s) => {
      const cur = el.modelOf(s.model);
      if (typeof filter === 'function' && !filter(cur, s)) return s;
      const opts = pool.filter((m) => m.id !== s.model);
      const m = (opts.length ? opts : pool)[Math.floor(Math.random() * (opts.length || pool.length))];
      const dv = defaultValues(m);
      const n = { ...s, model: m.id };
      if (dv) n.values = dv; else delete n.values;
      return n;
    }),
  }), { source: 'randomize' });
}

export function copyDay(el, from, to, opts = {}) {
  if (!el.weekMode || el._badWeek) return false;
  const targets = expandTargets(to, from);
  if (!targets.length) return false;
  const previous = el._value;
  const next = copyDayCore(el._expandWeek(), from, targets, { newIds: opts.newIds !== false });
  el._value = el._norm(next);
  el._syncForm();
  el._fire('change', detail(el, previous, { source: 'copy', day: from }));
  el._say(el.t('copyDone', { days: targets.map((d) => el.dayName(d)).join(', ') }));
  el._schedule('data');
  return true;
}

export function assignDay(el, day, slotsOrRef) {
  if (!el.weekMode || !el._validDay(day)) return false;
  const previous = el._value;
  el._value = el._norm(withDay(el._expandWeek(), day, slotsOrRef));
  el._syncForm();
  el._fire('change', detail(el, previous, { source: 'day', day }));
  el._schedule('data');
  return true;
}
