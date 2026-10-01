// <day-rhythm> custom element: state, configuration, public API. Rendering lives in ui/*.
import { VERSION } from './version.js';
import {
  parseTime, tryParseTime, formatTime, minutesOf, WEEKDAYS, mod,
} from './core/time.js';
import {
  normalizeDay, sortSlots, slotRanges, resolveValues, addSlotAt, removeSlotById, moveBoundary, genId, clone, isLocked, retimeSlot,
} from './core/slots.js';
import {
  isWeek, isRef, resolveWeek, withDay, copyDay as copyDayCore, carrySlotFor, firstDayOfWeek, orderedWeekdays, expandTargets,
} from './core/week.js';
import { validateDay, validateWeek } from './core/validate.js';
import { activeSlotAt } from './core/index.js';
import {
  defaults, ATTRS, KNOWN, parseAttr, mergeConfig, jsonSafe, isPlain, normalizeCredits,
} from './ui/config.js';
import { makeT } from './i18n/index.js';
import { defaultValues, modelLabel } from './ui/model.js';
import { nowOf, offsetFor, msToNextMinute } from './ui/clock.js';
import { camel, classList, deepEqual } from './ui/dom.js';
import { adapterFrom } from './storage.js';
import { buildRoot, renderData, renderTrack, updateNow } from './ui/render.js';
import { openEditor, closeDialog } from './ui/dialog.js';

const Base = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};
const NO_PROP = new Set(['add', 'remove', 'randomize', 'value', 'day']); // clash with DOM methods / special accessors
const ERR_KEY = { 'min-gap': 'err.minGap', 'max-slots': 'err.maxSlots', 'min-slots': 'err.minSlots', 'duplicate-time': 'err.duplicateTime', locked: 'err.locked', 'time-format': 'err.timeFormat' };

export class DayRhythmElement extends Base {
  static get version() { return VERSION; }
  static get formAssociated() { return true; }
  static get observedAttributes() { return [...Object.keys(ATTRS), 'config']; }
  static define(tag = 'day-rhythm') {
    if (typeof customElements !== 'undefined' && !customElements.get(tag)) customElements.define(tag, this);
  }

  constructor() {
    super();
    this._L = { script: {}, attrJson: {}, prop: {}, attrs: {}, props: {} };
    this._cfg = null;
    this._value = [];
    this._propValue = undefined;
    this._days = [];
    this._sel = null;
    this._state = { status: 'idle', error: null };
    this._pending = 0;
    this._slotted = {};
    this._$ = {};
    this._active = null;
    this._editing = null;
    this._init = false;
    this._daySaveListeners = 0;
    this._readyFired = false;
    this._warned = new Set();
    try { this._internals = this.attachInternals ? this.attachInternals() : null; } catch (e) { this._internals = null; }
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
      const rawValue = this.getAttribute('value');
      if (rawValue !== null) { try { attrValue = JSON.parse(rawValue); } catch (e) { this._configError(e); } }
      const v = this._propValue !== undefined ? this._propValue : attrValue !== undefined ? attrValue : this.cfg.value !== undefined ? this.cfg.value : this._defaultValue();
      this._value = this._norm(v);
      this._days = (this.cfg.days || []).map(clone);
      this._sel = this._validDay(this.getAttribute('day')) || this._validDay(this.cfg.day) || this.nowDay;
    }
    this._connected = true;
    if (typeof this.setAttribute === 'function') this.setAttribute('data-dr-host', '');
    this._build();
    this._observe();
    this._startClock();
    if (!this._readyFired) {
      this._readyFired = true;
      if (this.cfg.load) this.reloadData();
      queueMicrotask(() => this._fire('ready', {}));
    }
  }

  disconnectedCallback() {
    this._connected = false;
    clearTimeout(this._timer);
    if (this._ro) this._ro.disconnect();
    if (this._mo) this._mo.disconnect();
    document.removeEventListener('visibilitychange', this._vis);
    closeDialog(this, true);
  }

  attributeChangedCallback(name, oldV, newV) {
    if (!this._init || oldV === newV || this._reflecting) return;
    if (name === 'config') this._readConfigAttr();
    else if (name === 'day') { const d = this._validDay(newV); if (d) this.selectDay(d, true); return; }
    else if (name === 'value') {
      if (newV !== null) { try { this.setValue(JSON.parse(newV)); } catch (e) { this._configError(e); } }
      return;
    } else this._readAttrs();
    this._invalidate();
  }

  addEventListener(type, ...rest) {
    if (type === 'daysave') this._daySaveListeners++;
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

  get config() { return this.cfg; }
  set config(v) { this._L.prop = isPlain(v) ? v : {}; this._invalidate(); }
  configure(partial) { this._L.prop = mergeConfig(this._L.prop, partial); this._invalidate(); }
  reloadConfig() { this._readScript(); this._readConfigAttr(); this._readAttrs(); this._invalidate(); }

  /** JSON-safe subset of what the app supplied (config layers, no built-in defaults). */
  exportConfig(opts) {
    const L = this._L;
    const c = jsonSafe(mergeConfig(L.script, L.attrJson, L.prop, L.attrs, L.props)) || {};
    if (opts && opts.includeValue) c.value = clone(this._value);
    else delete c.value;
    return c;
  }

  _configError(error) {
    if (!this._warned.has('cfg:' + error.message)) {
      this._warned.add('cfg:' + error.message);
      console.error('[dayrhythm] invalid config:', error.message);
    }
    this._fire('error', { source: 'config', error });
  }

  _readScript() {
    this._L.script = {};
    const s = [...this.children].find((c) => c.tagName === 'SCRIPT' && /json/i.test(c.type));
    if (s) {
      try { this._L.script = JSON.parse(s.textContent || '{}'); } catch (e) { this._configError(e); }
    }
    this._warnUnknown(this._L.script);
  }

  _readConfigAttr() {
    this._L.attrJson = {};
    const raw = this.getAttribute('config');
    if (raw) {
      try { this._L.attrJson = JSON.parse(raw); } catch (e) { this._configError(e); }
      this._warnUnknown(this._L.attrJson);
    }
  }

  _readAttrs() {
    const out = {};
    for (const [attr, [key, type]] of Object.entries(ATTRS)) {
      if (attr === 'value' || attr === 'day') continue;
      const raw = this.getAttribute(attr);
      if (raw === null) continue;
      try {
        const v = parseAttr(type, raw);
        if (v !== undefined) out[key] = key === 'credits' ? (v === 'minimal' ? true : v) : v;
      } catch (e) { this._configError(e); }
    }
    for (const b of ['randomize', 'readonly', 'disabled']) if (this.hasAttribute(b)) out[b] = !/^(false|off|0)$/i.test(this.getAttribute(b));
    this._L.attrs = out;
  }

  _warnUnknown(obj) {
    if (!isPlain(obj)) return;
    for (const k of Object.keys(obj)) {
      if (!KNOWN.has(k) && !this._warned.has(k)) { this._warned.add(k); console.warn(`[dayrhythm] unknown config key "${k}" ignored`); }
    }
  }

  _invalidate() {
    this._cfg = null;
    if (this._init && this._connected) this._schedule('build');
  }

  _schedule(kind) {
    if (!this._connected) return;
    this._need = kind === 'build' ? 'build' : this._need || 'data';
    if (this._queued) return;
    this._queued = true;
    queueMicrotask(() => {
      this._queued = false;
      const n = this._need;
      this._need = null;
      if (!this._connected) return;
      if (n === 'build') this._build();
      else if (n) renderData(this);
    });
  }

  // ---------------------------------------------------------------- derived config
  get locale() { return this.cfg.locale || (typeof document !== 'undefined' && document.documentElement.lang) || 'en'; }
  set locale(v) { this._L.props.locale = v; this._invalidate(); }
  get t() { return this._t; }
  fmt(min) { return formatTime(min, { format: this.cfg.timeFormat }); }
  /** Weekly value shown as seven editable rows (opt-in) instead of one focused day under the week bar (default). */
  get weekRows() { return this.weekMode && this.cfg.weekLayout === 'rows'; }
  get weekMode() { const w = this.cfg.week; return w === 'off' ? false : w === 'top' || w === 'bottom' ? true : isWeek(this._value); }
  get _badWeek() { return this.cfg.week === 'off' && isWeek(this._value); }
  get _minSlots() { const m = this.cfg.minSlots; return m != null ? m : this.weekMode ? 0 : 1; }
  get _minGap() { return Math.max(1, +this.cfg.minGap || 30); }
  get _snap() { const s = +this.cfg.snap || 5; return 60 % s === 0 ? s : 5; }
  get creditsMode() { return normalizeCredits(this.cfg.credits); }
  get models() { return this.cfg.models && this.cfg.models.length ? this.cfg.models : defaults.models; }
  set models(v) { this._L.props.models = v; this._invalidate(); }
  get days() { return this._days; }
  set days(v) { this._days = Array.isArray(v) ? v.map(clone) : []; this._schedule('data'); }
  modelOf(id) { return this.models.find((m) => m.id === id) || null; }
  modelIndex(id) { return Math.max(0, this.models.findIndex((m) => m.id === id)); }
  label(model, id) { return modelLabel(model, id, this.t); }
  get storageAdapter() { return this._adapter !== undefined ? this._adapter : (this._adapter = adapterFrom(this.cfg.storage)); }
  get hasDaysArea() { return !!(this.cfg.showDays && (this.storageAdapter || this._daySaveListeners || this._days.length)); }

  get dayOrder() {
    const f = this.cfg.firstDay;
    return orderedWeekdays(f && f !== 'auto' ? f : firstDayOfWeek(this.locale));
  }

  dayName(d, style = 'long') {
    const i = WEEKDAYS.indexOf(d);
    try { return new Intl.DateTimeFormat(this.locale, { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))); } catch (e) { return d; }
  }

  get resolvedOrientation() {
    const o = this.cfg.orientation;
    if (o === 'horizontal' || o === 'vertical') return o;
    return this._width >= (+this.cfg.breakpoint || 640) ? 'horizontal' : 'vertical';
  }

  get editing() { return this._editing; }
  get now() { return nowOf(this.cfg).minutes; }
  get nowDay() { return nowOf(this.cfg).day; }

  _validDay(d) { return WEEKDAYS.includes(d) ? d : null; }

  // ---------------------------------------------------------------- properties for individual options
  get value() { return clone(this._value); }
  set value(v) { this._propValue = v; if (this._init) this.setValue(v); }
  get day() { return this._sel; }
  set day(d) { this.selectDay(d); }

  // ---------------------------------------------------------------- value handling
  _defaultValue() {
    const ms = this.models;
    const on = ms.find((m) => !m.off) || ms[0];
    const off = ms.find((m) => m.off) || ms[1] || ms[0];
    return [{ time: '07:00', model: on.id }, { time: '22:00', model: off.id }];
  }

  /** Sorted, ids assigned (unique across the week), values resolved, unparseable times dropped (reported). */
  _norm(v) {
    const seen = new Set();
    const day = (arr) => {
      const good = [];
      for (const s of Array.isArray(arr) ? arr : []) {
        if (!s || tryParseTime(s.time) == null) {
          const e = new RangeError(`Slot ignored, invalid time: ${JSON.stringify(s && s.time)}`);
          console.warn('[dayrhythm]', e.message);
          queueMicrotask(() => this._fire('error', { source: 'load', error: e }));
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
      try { this._internals.setFormValue(this.cfg.name ? JSON.stringify(this._value) : null); } catch (e) { /* not form-associated here */ }
    }
  }

  setValue(v) {
    this._value = this._norm(v);
    this._flattenIfOff();
    this._syncForm();
    if (this.weekMode && !this._validDay(this._sel)) this._sel = this.nowDay;
    if (this._editing && !this._locate(this._editing)) closeDialog(this, true);
    this._schedule('data');
  }

  setDay(slots) {
    if (!this.weekMode) return this.setValue(slots);
    this._value = this._norm(withDay(this._expandWeek(), this._sel, slots));
    this._syncForm();
    this._schedule('data');
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
      const rv = resolveValues({ ...s, values: undefined }, this.models);
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
      // empty day: it carries on the previous day's last slot all day
      const c = carrySlotFor(this._value, d, this._days);
      slots = c ? [{ ...c.slot, id: undefined, time: '00:00' }] : this._defaultValue();
    }
    this._value = this._norm(slots);
    this._syncForm();
  }

  _resolved() { return isWeek(this._value) ? resolveWeek(this._value, this._days) : clone(this._value); }

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
    if (isRef(e)) { const d = this._days.find((x) => x.id === e.ref); return d ? sortSlots(d.slots) : []; }
    return [];
  }

  /** Valid, sorted slots of the day being displayed. */
  _displaySlots() { return this._slotsOf(this.weekMode ? this._sel : null); }

  getDay(day) { return clone(this._slotsOf(this.weekMode ? day || this._sel : null)); }
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

  getSlot(id) { const l = this._locate(id); return l ? clone(l.slot) : null; }

  activeSlot(at) {
    let r;
    const opts = this.cfg.timezone ? { timeZone: this.cfg.timezone } : undefined;
    if (isWeek(this._value)) {
      const a = at === undefined ? this._nowAt() : at;
      r = activeSlotAt(this._value, a, { ...opts, days: this._days });
    } else r = activeSlotAt(this._value, at === undefined ? this.now : at, opts);
    return r ? clone(r.slot) : null;
  }

  _nowAt() { const n = nowOf(this.cfg); return { day: n.day, time: n.minutes }; }

  // ---------------------------------------------------------------- edits
  _fire(name, detail, cancelable) {
    const e = new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable: !!cancelable });
    this.dispatchEvent(e);
    return e;
  }

  _detail(previous, meta) {
    const d = { value: clone(this._value), resolved: this._resolved(), previous: clone(previous), ...meta };
    if (d.day === undefined || d.day === null) delete d.day;
    return d;
  }

  _commit(next, meta) {
    const previous = this._value;
    this._value = next;
    this._syncForm();
    this._fire('change', this._detail(previous, meta));
    this._schedule('data');
  }

  /** Update the draft and fire a coalesced `input` (no re-render; caller updates the DOM). */
  _live(next, meta) {
    const previous = this._liveBase || this._value;
    this._value = next;
    this._syncForm();
    this._fire('input', this._detail(previous, meta));
  }

  _withDay(day, slots) {
    if (!this.weekMode) return slots;
    return withDay(this._expandWeek(), day, slots);
  }

  _refuse(reason, id, extra = {}) {
    const limit = reason === 'max-slots' ? this.cfg.maxSlots : reason === 'min-slots' ? this._minSlots : reason === 'min-gap' ? this._minGap : undefined;
    const detail = { reason };
    if (id) detail.id = id;
    if (limit !== undefined) detail.limit = limit;
    this._fire('slotinvalid', detail);
    this._say(this.t(ERR_KEY[reason] || 'err.locked', { minutes: this._minGap, max: this.cfg.maxSlots, min: this._minSlots, time: extra.time || '' }));
  }

  /**
   * Runs fn(slotsCopy) -> new slots | {slots,...} | {error} | null on the day, then commits.
   * Editing a day linked to a saved day detaches it (copy-on-write).
   */
  _edit(day, fn, meta) {
    const d = this.weekMode ? day || this._sel : null;
    let slots = clone(this._slotsOf(d));
    let detachedFrom = null;
    if (d && isWeek(this._value) && isRef(this._value.week[d])) {
      detachedFrom = this._days.find((x) => x.id === this._value.week[d].ref) || { name: this._value.week[d].ref };
      const used = new Set();
      for (const k of WEEKDAYS) if (Array.isArray(this._value.week[k])) this._value.week[k].forEach((s) => used.add(s.id));
      slots = slots.map((s) => (used.has(s.id) ? { ...s, id: genId() } : s));
    }
    const r = fn(slots);
    if (!r) return false;
    if (r.error) { this._refuse(r.error, meta && meta.id, r); return false; }
    const out = normalizeDay(r.slots || r);
    const m = { ...meta };
    if (d) m.day = d;
    if (detachedFrom) {
      m.detached = true;
      this._say(this.t('detached', { day: this.dayName(d), name: detachedFrom.name }));
    }
    this._commit(this._withDay(d, out), m);
    return r;
  }

  addSlot(partial = {}, opts = {}) {
    const day = opts.day || this._sel;
    if (this._badWeek) return null;
    let added = null;
    const ok = this._edit(day, (slots) => {
      let template = null;
      if (this.weekMode && !slots.length) {
        const carried = this._carryOf(day);
        template = carried ? { model: carried.model, values: carried.values } : null;
      }
      const model = partial.model ? this.modelOf(partial.model) : null;
      const r = addSlotAt(slots, {
        time: partial.time, minGap: this._minGap, snap: this._snap, maxSlots: this.cfg.maxSlots, cyclic: !this.weekMode,
        template, model: partial.model, label: partial.label,
      });
      if (r.error) return r;
      added = { ...r.added, ...clone(partial), id: r.added.id, time: r.added.time };
      if (partial.model && !partial.values) {
        const dv = defaultValues(model);
        if (dv) added.values = dv; else delete added.values;
      }
      const rv = resolveValues(added, this.models);
      if (rv) added.values = rv;
      return { slots: r.slots.map((s) => (s.id === added.id ? added : s)) };
    }, { source: 'add' });
    if (!ok || !added) return null;
    this._say(this.t('added'));
    if (opts.edit) queueMicrotask(() => openEditor(this, added.id));
    return clone(added);
  }

  _carryOf(day) {
    const view = this._weekView();
    const r = resolveWeek(view, this._days);
    const i = WEEKDAYS.indexOf(day);
    for (let k = 1; k <= 7; k++) {
      const d = WEEKDAYS[mod(i - k, 7)];
      if (r[d].length) return r[d][r[d].length - 1];
    }
    return null;
  }

  removeSlot(id) {
    const loc = this._locate(id);
    if (!loc) return false;
    return !!this._edit(loc.day, (slots) => {
      const r = removeSlotById(slots, id, { minSlots: this._minSlots });
      return Array.isArray(r) ? { slots: r } : r;
    }, { source: 'remove', id }) && (this._say(this.t('removed')), true);
  }

  updateSlot(id, patch) {
    const loc = this._locate(id);
    if (!loc) return null;
    let out = null;
    const ok = this._edit(loc.day, (slots) => {
      const i = slots.findIndex((s) => s.id === id);
      let s = { ...slots[i], ...clone(patch), id };
      if (s.label === '') delete s.label;
      if (patch.model && patch.model !== slots[i].model && !patch.values) {
        const dv = defaultValues(this.modelOf(patch.model));
        if (dv) s.values = dv; else delete s.values;
      }
      if (patch.time !== undefined) {
        const r = retimeSlot(slots.map((x, k) => (k === i ? s : x)), id, s.time, { minGap: this._minGap, cyclic: !this.weekMode });
        if (r.error) return r;
        out = r.slots.find((x) => x.id === id);
        return { slots: r.slots };
      }
      const rv = resolveValues(s, this.models);
      if (rv) s.values = rv;
      out = s;
      return { slots: slots.map((x, k) => (k === i ? s : x)) };
    }, { source: patch.model ? 'model' : patch.values ? 'values' : patch.label !== undefined ? 'label' : patch.time !== undefined ? 'time' : 'api', id });
    return ok ? clone(out) : null;
  }

  moveSlot(id, time) {
    const loc = this._locate(id);
    const m = tryParseTime(time);
    if (!loc || m == null) return false;
    if (isLocked(loc.slot, 'time')) { this._refuse('locked', id); return false; }
    return !!this._edit(loc.day, (slots) => {
      const r = moveBoundary(slots, id, m, { snap: this._snap, minGap: this._minGap, cyclic: !this.weekMode });
      return { slots: r.slots };
    }, { source: 'time', id });
  }

  /** Editor time field: may reorder slots. Returns null | error reason. */
  _retime(id, time) {
    const loc = this._locate(id);
    if (!loc) return 'time-format';
    let err = null;
    this._edit(loc.day, (slots) => {
      const r = retimeSlot(slots, id, time, { minGap: this._minGap, cyclic: !this.weekMode });
      if (r.error) { err = r.error; return { error: r.error, time }; }
      return { slots: r.slots };
    }, { source: 'time', id });
    return err;
  }

  randomize(filter) {
    if (this._badWeek) return;
    const pool = this.models.filter((m) => !m.off);
    if (!pool.length) return;
    this._edit(this._sel, (slots) => ({
      slots: slots.map((s) => {
        const cur = this.modelOf(s.model);
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

  // ---------------------------------------------------------------- week
  selectDay(d, fromAttr) {
    if (!this._validDay(d)) return;
    const previous = this._sel;
    if (d === previous) return;
    this._sel = d;
    if (!fromAttr && this.getAttribute('day') !== d) {
      this._reflecting = true;
      this.setAttribute('day', d);
      this._reflecting = false;
    }
    if (this._editing) closeDialog(this, true);
    this._fire('dayview', { day: d, previous });
    this._say(this.t('dayView', { day: this.dayName(d) }));
    this._schedule('data');
  }

  _stepDay(dir) {
    const o = this.dayOrder;
    this.selectDay(o[mod(o.indexOf(this._sel) + dir, 7)]);
  }
  prevDay() { this._stepDay(-1); }
  nextDay() { this._stepDay(1); }

  copyDay(from, to, opts = {}) {
    if (!this.weekMode || this._badWeek) return false;
    const targets = expandTargets(to, from);
    if (!targets.length) return false;
    const previous = this._value;
    const next = copyDayCore(this._expandWeek(), from, targets, { newIds: opts.newIds !== false });
    this._value = this._norm(next);
    this._syncForm();
    this._fire('change', this._detail(previous, { source: 'copy', day: from }));
    this._say(this.t('copyDone', { days: targets.map((d) => this.dayName(d)).join(', ') }));
    this._schedule('data');
    return true;
  }

  assignDay(day, slotsOrRef) {
    if (!this.weekMode || !this._validDay(day)) return false;
    const previous = this._value;
    this._value = this._norm(withDay(this._expandWeek(), day, slotsOrRef));
    this._syncForm();
    this._fire('change', this._detail(previous, { source: 'day', day }));
    this._schedule('data');
    return true;
  }

  // ---------------------------------------------------------------- editor / focus
  openEditor(id) { openEditor(this, id); }
  closeEditor() { closeDialog(this); }
  focusSlot(id) {
    const b = this._$.track && this._$.track.querySelector(`[data-slot-id="${CSS.escape(id)}"] button, [data-slot-id="${CSS.escape(id)}"]`);
    if (b) b.focus();
  }

  // ---------------------------------------------------------------- data loading (declarative `load`, saved days)
  async reloadData() {
    const l = this.cfg.load;
    if (!l || !l.url) return;
    const seq = ++this._loadSeq || (this._loadSeq = 1);
    this._state = { status: 'loading', error: null };
    this._schedule('data');
    try {
      const r = await fetch(l.url, { method: l.method || 'GET', headers: l.headers, credentials: l.credentials });
      if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
      const data = await r.json();
      if (seq !== this._loadSeq) return;
      this._state = { status: 'idle', error: null };
      this.setValue(data);
    } catch (error) {
      if (seq !== this._loadSeq) return;
      this._state = { status: 'error', error };
      this._fire('error', { source: 'load', error });
      this._schedule('data');
    }
  }

  async _loadStorage() {
    const a = this.storageAdapter;
    if (!a) return;
    try {
      this._days = ((await a.list()) || []).map(clone);
      this._schedule('data');
    } catch (error) { this._fire('error', { source: 'storage', error }); }
  }

  /** Saved-day plumbing used by the UI: fires daysave/daydelete then calls the adapter. */
  async _saveDay(name) {
    const slots = clone(this._displaySlots()).map(({ id, ...s }) => s);
    const waits = [];
    this._fire('daysave', { name, slots, waitUntil: (p) => waits.push(Promise.resolve(p)) });
    try {
      await Promise.all(waits);
      const a = this.storageAdapter;
      if (a) { await a.save({ name, slots }); this._days = ((await a.list()) || []).map(clone); }
      this._say(this.t('daySaved'));
    } catch (error) { this._fire('error', { source: 'storage', error }); }
    this._schedule('data');
  }

  async _deleteDay(day) {
    const waits = [];
    this._fire('daydelete', { day: clone(day), waitUntil: (p) => waits.push(Promise.resolve(p)) });
    try {
      await Promise.all(waits);
      const a = this.storageAdapter;
      if (a) { await a.remove(day.id); this._days = ((await a.list()) || []).map(clone); }
      else this._days = this._days.filter((d) => d.id !== day.id);
      if (isWeek(this._value)) {
        const week = { ...this._value.week };
        let changed = false;
        for (const d of WEEKDAYS) {
          if (isRef(week[d]) && week[d].ref === day.id) { week[d] = normalizeDay(clone(day.slots).map((s) => ({ ...s, id: genId() }))); changed = true; }
        }
        if (changed) this._commit({ ...this._value, week }, { source: 'day' });
      }
    } catch (error) { this._fire('error', { source: 'storage', error }); }
    this._schedule('data');
  }

  // ---------------------------------------------------------------- clock
  syncClock(t) { this._L.props.clockOffset = offsetFor(t, this.cfg); this._cfg = null; this._updateNow(); }

  _startClock() {
    clearTimeout(this._timer);
    document.removeEventListener('visibilitychange', this._vis);
    this._vis = () => { if (!document.hidden) { this._updateNow(); this._startClock(); } else clearTimeout(this._timer); };
    document.addEventListener('visibilitychange', this._vis);
    this._timer = setTimeout(() => { this._updateNow(); this._startClock(); }, msToNextMinute());
  }

  _renderTrack(o) { renderTrack(this, o); }

  _updateNow() { if (this._connected) updateNow(this); }

  _observe() {
    if (typeof ResizeObserver === 'undefined') return;
    if (!this._ro) {
      this._ro = new ResizeObserver((entries) => {
        const w = Math.round(entries[0].contentRect.width);
        if (w === this._width) return;
        const before = this.resolvedOrientation;
        this._width = w;
        if (this.resolvedOrientation !== before) this._schedule('data');
      });
    }
    this._ro.observe(this);
    this._width = Math.round(this.getBoundingClientRect().width);
  }

  // ---------------------------------------------------------------- a11y / misc
  _say(text) {
    const r = this._$ && this._$.live;
    if (!r) return;
    r.textContent = '';
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(() => { r.textContent = text; }, 30);
  }

  _collectSlotted() {
    for (const c of [...this.children]) {
      const s = c.getAttribute && c.getAttribute('slot');
      if (s) (this._slotted[s] = this._slotted[s] || []).push(c);
    }
  }

  /** Runs a renderer override safely; failures are reported and the default is used. */
  _renderer(name, ctx) {
    const fn = this.cfg.renderers && this.cfg.renderers[name];
    if (typeof fn !== 'function') return null;
    try { return fn(ctx); } catch (error) { this._fire('error', { source: 'render', error }); return null; }
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
    e.className = tokens.map((x) => 'dr-' + x).join(' ');
    e.setAttribute('part', tokens.join(' '));
    e.dataset.part = main;
    const c = this.cfg.classes || {};
    for (const tk of tokens) e.classList.add(...classList(c[camel(tk)]));
    if (o.class) e.classList.add(...classList(o.class));
    if (o.text != null) e.textContent = o.text;
    if (o.attrs) for (const [k, v] of Object.entries(o.attrs)) if (v != null) e.setAttribute(k, v);
    if (tag === 'button') e.type = 'button';
    return e;
  }

  _build() {
    this._t = makeT(this.locale, this.cfg.messages);
    this._adapter = undefined;
    if (this._sel == null) this._sel = this._validDay(this.cfg.day) || this.nowDay;
    if (this.cfg.day !== this._cfgDay) { this._cfgDay = this.cfg.day; const d = this._validDay(this.cfg.day); if (d) this._sel = d; }
    this._flattenIfOff();
    buildRoot(this);
    if (this._storageRef !== this.cfg.storage) { this._storageRef = this.cfg.storage; this._loadStorage(); }
  }
}

// individual properties (el.theme = 'neutral', el.messages = {...}, ...)
const PROP_KEYS = [...Object.keys(defaults), 'renderers', 'modelFilter', 'clock'].filter((k) => !NO_PROP.has(k) && !(k in DayRhythmElement.prototype));
for (const k of PROP_KEYS) {
  Object.defineProperty(DayRhythmElement.prototype, k, {
    configurable: true,
    get() { return this.cfg[k]; },
    set(v) { this._L.props[k] = v; this._invalidate(); },
  });
}

export default DayRhythmElement;
