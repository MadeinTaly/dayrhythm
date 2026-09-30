// Pack builder (internal, not exported): turns a compact spec into a plain, JSON-serialisable config object.
// Field ranges and preset times in the shipped packs are illustrative starting points, not vendor values.
const pair = (x) => (Array.isArray(x) ? x : [x, x]);
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function pack(spec) {
  const en = {}, it = {};
  const put = (k, l) => { const [a, b] = pair(l); if (!(k in en)) { en[k] = a; it[k] = b; } };
  const field = (f) => {
    const { label, options, ...rest } = f;
    put('field.' + f.key, label);
    const out = { ...rest, label: pair(label)[0] };
    if (options) out.options = options.map((o) => { put(`opt.${f.key}.${o.value}`, o.label); return { value: o.value, label: pair(o.label)[0] }; });
    return out;
  };
  const models = spec.models.map(([id, icon, look, label, extra = {}]) => {
    put('model.' + id, label);
    const m = { id, label: pair(label)[0], icon };
    if (extra.off) m.off = true;
    else if (look && typeof look === 'object') m.previewScale = look;
    else if (look) m.preview = look;
    for (const k of ['defaults', 'summary', 'when', 'days', 'group', 'hint']) if (extra[k] !== undefined) m[k] = extra[k];
    if (extra.fields) m.fields = extra.fields.map(field);
    return m;
  });
  const slots = (list) => list.map(([time, model, values]) => (values ? { time, model, values } : { time, model }));
  const presets = spec.presets.map(([id, label, list, more = {}]) => {
    put('preset.' + id, label);
    return { id, label: pair(label)[0], ...more, slots: slots(list) };
  });
  put('title', spec.titles || spec.title);
  const out = { id: spec.id, title: pair(spec.title)[0], description: spec.description, ...(spec.config || {}) };
  if (spec.weekly) {
    const week = {};
    const byId = Object.fromEntries(presets.map((p) => [p.id, p.slots]));
    const target = (k) => (k === 'weekdays' ? DAYS.slice(0, 5) : k === 'weekend' ? DAYS.slice(5) : k === 'all' ? DAYS : [k]);
    for (const [k, pid] of Object.entries(spec.weekly)) for (const d of target(k)) week[d] = byId[pid].map((s) => ({ ...s }));
    out.value = { week };
  } else if (spec.value) out.value = presets.find((p) => p.id === spec.value).slots.map((s) => ({ ...s }));
  out.models = models;
  out.presets = presets;
  out.messages = { en, it };
  return out;
}

export const range = (key, label, min, max, step, unit, def, accent) => ({ key, type: 'range', label, min, max, step, unit, default: def, ...(accent ? { accent } : {}) });
