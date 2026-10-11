// Presets and saved-day chips.
import { clone, genId, resolveValues, normalizeDay } from '../../core/slots.js';
import { applyRendered, fillIcon } from '../dom.js';

export function renderPresets(el) {
  const box = el._$.presets;
  box.replaceChildren();
  const cfg = el.cfg;
  const showP = cfg.showPresets && (cfg.presets || []).length > 0 && !cfg.readonly;
  const showD = el.hasDaysArea && !cfg.readonly;
  box.hidden = !(showP || showD);
  if (box.hidden) return;
  const t = el.t;
  if (showP) {
    box.append(el._mk('div', 'presets-label', { text: t('presetsLabel') }));
    const groups = new Map();
    for (const p of cfg.presets) { const g = p.group || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); }
    for (const [g, list] of groups) {
      const row = el._mk('div', 'presets-group');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center';
      if (g) row.append(el._mk('span', 'presets-label', { text: t.has('group.' + g) ? t('group.' + g) : g }));
      for (const p of list) row.append(presetChip(el, p));
      box.append(row);
    }
  }
  if (showD) {
    box.append(el._mk('div', 'presets-label', { text: t('daysLabel') }));
    const row = el._mk('div', 'presets-group');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:var(--x-gap);align-items:center';
    for (const d of el._days) row.append(dayChip(el, d));
    if (!el._days.length) row.append(el._mk('span', 'presets-label', { text: '-' }));
    box.append(row);
  }
}

function presetChip(el, p) {
  const busy = el._busy && el._busy.has(p.id);
  const b = el._mk('button', 'preset', { states: busy ? ['preset-busy'] : [], attrs: { 'aria-busy': busy ? 'true' : 'false', 'data-preset': p.id } });
  const custom = el._renderer('preset', { preset: p, busy: !!busy });
  if (!applyRendered(b, custom)) {
    if (p.icon) { const i = el._mk('span', 'model-icon'); fillIcon(i, p.icon); b.append(i); }
    b.append(document.createTextNode(el.t.has('preset.' + p.id) ? el.t('preset.' + p.id) : p.label || p.id));
  }
  b.onclick = () => applyPreset(el, p);
  return b;
}

function dayChip(el, d) {
  const wrap = el._mk('span', 'preset-row');
  wrap.style.cssText = 'display:inline-flex;gap:.2rem;align-items:center;flex-wrap:wrap';
  if (el._confirmDel === d.id) {
    wrap.append(el._mk('span', 'error', { text: el.t('deleteDayConfirm', { name: d.name }) }));
    const yes = el._mk('button', 'button', { generic: ['button', 'button-danger'], text: el.t('confirm') });
    const no = el._mk('button', 'button', { generic: ['button'], text: el.t('cancel') });
    yes.onclick = () => { el._confirmDel = null; el._deleteDay(d); };
    no.onclick = () => { el._confirmDel = null; el._schedule('data'); };
    wrap.append(yes, no);
    queueMicrotask(() => no.focus());
    return wrap;
  }
  const b = el._mk('button', 'preset', { attrs: { 'data-day-id': d.id } });
  b.textContent = d.name;
  b.onclick = () => applySlots(el, 'day', d.id, d.slots);
  const x = el._mk('button', 'preset-delete', { attrs: { 'aria-label': `${el.t('deleteDay')}: ${d.name}` }, text: '×' });
  x.onclick = () => { el._confirmDel = d.id; el._schedule('data'); };
  wrap.append(b, x);
  return wrap;
}

async function applyPreset(el, p) {
  el._busy = el._busy || new Set();
  if (el._busy.has(p.id)) return;
  el._busy.add(p.id);
  renderPresets(el);
  let slots;
  try {
    if (typeof p.slots === 'function') slots = await p.slots();
    else if (Array.isArray(p.slots)) slots = p.slots;
    else if (p.slotsUrl) {
      const r = await fetch(p.slotsUrl);
      if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
      slots = await r.json();
    } else slots = [];
  } catch (error) {
    el._fire('error', { source: 'preset', error });
    el._say(el.t('presetFailed'));
    slots = null;
  }
  el._busy.delete(p.id);
  renderPresets(el);
  if (slots) applySlots(el, 'preset', p.id, slots);
}

function applySlots(el, kind, id, slots) {
  const weekly = el.weekMode;
  const ev = el._fire('dayselect', { kind, id, slots: clone(slots), ...(weekly ? { day: el._sel } : {}) }, true);
  if (ev.defaultPrevented) return;
  if (weekly && kind === 'day' && el.cfg.linkDays) { el.assignDay(el._sel, { ref: id }); return; }
  const fresh = (slots || []).filter((s) => s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)).map((s) => {
    const n = { ...clone(s), id: genId() };
    const rv = resolveValues(n, el.models);
    if (rv) n.values = rv;
    return n;
  });
  el._edit(weekly ? el._sel : null, () => ({ slots: normalizeDay(fresh) }), { source: kind });
}
