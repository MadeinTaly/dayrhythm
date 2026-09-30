// Per-slot field editors (range, number, select, toggle, color).
import { coerceField, fmtField, fieldLabel, optionLabel } from './model.js';
import { applyRendered } from './dom.js';

/** sess: { input(patch), commit(patch) } from dialog.js */
export function buildField(el, field, slotId, sess) {
  const wrap = el._mk('div', 'field');
  const uid = `${el._uid}-f-${field.key}`;
  const cur = () => { const l = el._locate(slotId); return (l && l.slot.values) || {}; };
  const value = cur()[field.key] !== undefined ? cur()[field.key] : field.default;
  const set = (v, commit) => {
    const val = coerceField(field, v);
    (commit ? sess.commit : sess.input)({ values: { ...cur(), [field.key]: val } });
    return val;
  };
  if (field.accent) wrap.style.setProperty('--x-field-accent', field.accent);
  const custom = el._renderer('field', { field, value, slot: el.getSlot(slotId), set, t: el.t });
  if (applyRendered(wrap, custom)) return wrap;

  const label = fieldLabel(field, el.t);
  const lab = el._mk('label', 'field-label', { text: label, attrs: { for: uid } });
  const t = field.type;
  if (t === 'toggle') {
    const row = el._mk('div', 'toggle-row');
    const cb = el._mk('input', 'field-input', { generic: ['input'], attrs: { type: 'checkbox', id: uid } });
    cb.checked = !!coerceField(field, value);
    cb.onchange = () => set(cb.checked, true);
    row.append(cb, lab);
    wrap.append(row);
    return wrap;
  }
  const out = el._mk('output', 'field-value', { attrs: { for: uid } });
  const show = (v) => { out.textContent = fmtField(field, v, el.t); };
  const head = el._mk('div', 'field-head');
  head.append(lab, out);
  let input;
  if (t === 'select') {
    input = el._mk('select', 'field-input', { generic: ['input'], attrs: { id: uid } });
    for (const o of field.options || []) {
      const op = document.createElement('option');
      op.value = String(o.value);
      op.textContent = optionLabel(field, o, el.t);
      input.append(op);
    }
    input.value = String(coerceField(field, value));
    input.onchange = () => { set(input.value, true); show(input.value); };
    wrap.append(lab, input);
    return wrap;
  }
  input = el._mk('input', 'field-input', { generic: ['input'], attrs: { id: uid } });
  if (t === 'text') {
    input.type = 'text';
    input.maxLength = 80;
    input.value = coerceField(field, value);
    input.oninput = () => set(input.value, false);
    input.onchange = () => set(input.value, true);
    wrap.append(lab, input);
    return wrap;
  }
  if (t === 'color') {
    input.type = 'color';
    input.value = coerceField(field, value);
    input.oninput = () => set(input.value, false);
    input.onchange = () => set(input.value, true);
    wrap.append(lab, input);
    return wrap;
  }
  input.type = t === 'number' ? 'number' : 'range';
  if (field.min != null) input.min = field.min;
  if (field.max != null) input.max = field.max;
  if (field.step != null) input.step = field.step;
  const v0 = coerceField(field, value);
  input.value = v0;
  show(v0);
  input.oninput = () => { if (input.value === '') return; show(set(input.value, false)); };
  input.onchange = () => { const v = set(input.value, true); input.value = v; show(v); };
  wrap.append(head, input);
  return wrap;
}
