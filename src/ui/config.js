// Configuration: defaults, attribute parsing, layered merge, JSON-safe export. DOM-free.

export const defaults = {
  name: '',
  models: [
    { id: 'on', label: 'On', preview: '#f5c542' },
    { id: 'off', label: 'Off', off: true },
  ],
  presets: [], days: [], load: null, storage: null,
  minGap: 30, snap: 5, minSlots: null, maxSlots: null,
  origin: 'first', seamDrag: true, push: true, orientation: 'auto', breakpoint: 640,
  add: true, remove: true, rename: true, timeEdit: true, showPresets: true, showDays: true,
  spectrum: true, nowLine: true, clockOffset: 0, timezone: null, timeFormat: '24h',
  editor: 'auto', randomize: false, readonly: false, disabled: false, labelMax: 40,
  week: 'auto', day: null, firstDay: 'auto', weekPreview: true, weekCopy: true, linkDays: false, weekLayout: 'rows',
  theme: 'organic', colorScheme: 'auto', locale: null,
  messages: {}, classes: {}, render: 'shadow', inheritStyles: false, styles: null, credits: true,
};

/** attribute -> [configKey, type]. Types: str int num toggle bool json */
export const ATTRS = {
  name: ['name', 'str'], value: ['value', 'json'], models: ['models', 'json'], load: ['load', 'json'], storage: ['storage', 'json'],
  'min-gap': ['minGap', 'int'], snap: ['snap', 'int'], 'min-slots': ['minSlots', 'int'], 'max-slots': ['maxSlots', 'int'],
  origin: ['origin', 'str'], 'seam-drag': ['seamDrag', 'toggle'], push: ['push', 'toggle'], orientation: ['orientation', 'str'], breakpoint: ['breakpoint', 'int'],
  add: ['add', 'toggle'], remove: ['remove', 'toggle'], rename: ['rename', 'toggle'], 'time-edit': ['timeEdit', 'toggle'],
  'show-presets': ['showPresets', 'toggle'], 'show-days': ['showDays', 'toggle'], spectrum: ['spectrum', 'toggle'],
  'now-line': ['nowLine', 'toggle'], 'clock-offset': ['clockOffset', 'num'], timezone: ['timezone', 'str'], 'time-format': ['timeFormat', 'str'],
  editor: ['editor', 'str'], randomize: ['randomize', 'bool'], readonly: ['readonly', 'bool'], disabled: ['disabled', 'bool'], 'label-max': ['labelMax', 'int'],
  week: ['week', 'str'], day: ['day', 'str'], 'first-day': ['firstDay', 'str'], 'week-preview': ['weekPreview', 'toggle'],
  'week-copy': ['weekCopy', 'toggle'], 'link-days': ['linkDays', 'toggle'], 'week-layout': ['weekLayout', 'str'],
  theme: ['theme', 'str'], 'color-scheme': ['colorScheme', 'str'], locale: ['locale', 'str'], render: ['render', 'str'],
  'inherit-styles': ['inheritStyles', 'toggle'], styles: ['styles', 'str'], credits: ['credits', 'str'],
  messages: ['messages', 'json'], classes: ['classes', 'json'],
};

/** Keys that are accepted silently (pack metadata, editor hints). */
const META = new Set(['$schema', 'id', 'title', 'description', 'renderers', 'modelFilter', 'clock', 'value']);
export const KNOWN = new Set([...Object.keys(defaults), ...META]);

export function parseAttr(type, raw) {
  if (raw === null) return undefined;
  switch (type) {
    case 'int': { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : undefined; }
    case 'num': { const n = parseFloat(raw); return Number.isFinite(n) ? n : undefined; }
    case 'toggle': return !/^(false|off|0)$/i.test(raw.trim());
    case 'bool': return !/^(false|off|0)$/i.test(raw.trim());
    case 'json': return JSON.parse(raw);
    default:
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return raw;
  }
}

export const isPlain = (v) => v !== null && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/** Deep merge of plain objects; arrays and everything else replace; undefined is skipped. */
export function mergeConfig(...layers) {
  const out = {};
  for (const layer of layers) {
    if (!isPlain(layer)) continue;
    for (const k of Object.keys(layer)) {
      const v = layer[k];
      if (v === undefined) continue;
      out[k] = isPlain(v) && isPlain(out[k]) ? mergeConfig(out[k], v) : isPlain(v) ? mergeConfig(v) : Array.isArray(v) ? v.slice() : v;
    }
  }
  return out;
}

/** JSON-safe deep copy: functions, undefined and non-plain objects are dropped. */
export function jsonSafe(v) {
  if (v === undefined || typeof v === 'function' || typeof v === 'symbol') return undefined;
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => { const r = jsonSafe(x); return r === undefined ? null : r; });
  if (!isPlain(v)) return undefined;
  const out = {};
  for (const k of Object.keys(v)) {
    const r = jsonSafe(v[k]);
    if (r !== undefined) out[k] = r;
  }
  // a plain object that only held functions (e.g. a storage adapter) is dropped
  return Object.keys(out).length === 0 && Object.keys(v).length > 0 ? undefined : out;
}

export function normalizeCredits(c) {
  return c === false || c === 'false' ? 'off' : c === 'support' ? 'support' : 'on';
}
