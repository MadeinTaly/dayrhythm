// Model helpers: labels, previews, summaries, filters. DOM-free.
import { parseTime } from '../core/time.js';

export function interp(tpl, values, fields, t) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => {
    if (!values || values[k] === undefined) return m;
    const f = fields && fields.find((x) => x.key === k);
    return f ? fmtField(f, values[k], t) : t && values[k] !== undefined && t.has(`opt.${k}.${values[k]}`) ? t(`opt.${k}.${values[k]}`) : String(values[k]);
  });
}

export const optionLabel = (field, o, t) => (t && t.has(`opt.${field.key}.${o.value}`) ? t(`opt.${field.key}.${o.value}`) : o.label);

export function fmtField(field, v, t) {
  if (typeof field.format === 'function') return String(field.format(v));
  if (typeof field.format === 'string') return field.format.replace(/\{value\}/g, String(v));
  if (field.type === 'select') {
    const o = (field.options || []).find((x) => String(x.value) === String(v));
    return o ? optionLabel(field, o, t) : String(v);
  }
  if (field.type === 'toggle') return v ? '✓' : '–';
  return field.unit ? `${v}${field.unit}` : String(v);
}

export function coerceField(field, v) {
  const d = field.default;
  switch (field.type) {
    case 'range': case 'number': {
      let n = typeof v === 'number' ? v : parseFloat(v);
      if (!Number.isFinite(n)) n = typeof d === 'number' ? d : field.min ?? 0;
      if (field.step > 0) {
        const base = field.min ?? 0;
        n = base + Math.round((n - base) / field.step) * field.step;
        n = +n.toFixed(6);
      }
      if (field.min != null) n = Math.max(field.min, n);
      if (field.max != null) n = Math.min(field.max, n);
      return n;
    }
    case 'select': {
      const opts = field.options || [];
      const hit = opts.find((o) => String(o.value) === String(v));
      return hit ? hit.value : d !== undefined ? d : opts[0] && opts[0].value;
    }
    case 'toggle': return v === undefined ? !!d : v === true || v === 'true' || v === 1 || v === 'on';
    case 'text': return typeof v === 'string' ? v : d ?? '';
    case 'color': return typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : (d ?? '#000000');
    default: return v;
  }
}

/** New-slot values: field defaults, then model defaults. */
export function defaultValues(model) {
  if (!model) return undefined;
  const v = {};
  for (const f of model.fields || []) if (f.default !== undefined) v[f.key] = f.default;
  Object.assign(v, model.defaults || {});
  return Object.keys(v).length ? v : undefined;
}

export function modelLabel(model, id, t) {
  if (!model) return t('unknownModel', { id });
  const k = `model.${model.id}`;
  return t.has(k) ? t(k) : model.label || model.id;
}

export const fieldLabel = (f, t) => (t.has(`field.${f.key}`) ? t(`field.${f.key}`) : f.label || f.key);

const hue = (i) => `hsl(${(i * 47 + 20) % 360} 45% 58%)`;

/** CSS background for a model (never per pointer move). */
export function modelPreview(model, index, values, slot) {
  if (!model) return 'repeating-linear-gradient(45deg,#9994 0 6px,#9992 6px 12px)';
  try {
    if (typeof model.preview === 'function') return model.preview(values || {}, model, slot) || hue(index);
    if (model.previewScale && values) {
      const s = model.previewScale;
      const n = Number(values[s.field]);
      const tt = Number.isFinite(n) ? Math.min(1, Math.max(0, (n - s.min) / (s.max - s.min || 1))) : 0;
      return `color-mix(in oklab, ${s.to} ${Math.round(tt * 100)}%, ${s.from})`;
    }
    if (typeof model.preview === 'string') return interp(model.preview, values || {}, model.fields);
  } catch (e) { /* fall through */ }
  return model.off ? 'transparent' : hue(index);
}

export function modelSummary(model, values, slot, t) {
  if (!model || !model.summary) return '';
  if (typeof model.summary === 'function') return String(model.summary(values || {}, model, slot) || '');
  return interp(model.summary, values || {}, model.fields, t);
}

/** Window may wrap midnight. */
export function inWindow(win, minutes) {
  if (!win) return true;
  const a = parseTime(win.from), b = parseTime(win.to);
  return a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

export function modelsFor(models, slot, day, filter) {
  let m = models.filter((x) => inWindow(x.when, parseTime(slot.time)) && (!x.days || !day || x.days.includes(day)));
  if (typeof filter === 'function') { try { m = filter(slot, m) || m; } catch (e) { /* keep */ } }
  return m;
}
