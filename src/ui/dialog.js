// Dialogs on native <dialog>: slot editor / model picker, save day, copy to.
import { parseTime } from '../core/time.js';
import { isLocked, clone } from '../core/slots.js';
import { WEEKDAYS } from '../core/time.js';
import { defaultValues, modelPreview, modelsFor } from './model.js';
import { applyRendered, fillIcon } from './dom.js';
import { buildField } from './fields.js';

const ERR = { 'min-gap': 'err.minGap', 'duplicate-time': 'err.duplicateTime', 'time-format': 'err.timeFormat', 'min-slots': 'err.minSlots', locked: 'err.locked', 'max-slots': 'err.maxSlots' };

function shell(el, title, onClose) {
  const d = el._$.dialog;
  d.replaceChildren();
  d.setAttribute('aria-label', title);
  const header = el._mk('div', 'dialog-header');
  const h = el._mk('h2', 'dialog-title', { text: title });
  const x = el._mk('button', 'button', { generic: ['button'], text: '×', attrs: { 'aria-label': el.t('close') } });
  x.onclick = () => d.close();
  header.append(h, x);
  const body = el._mk('div', 'dialog-body');
  const actions = el._mk('div', 'dialog-actions');
  d.append(header, body, actions);
  d.onclick = (e) => { if (e.target === d) d.close(); };
  d.onclose = () => { onClose && onClose(); };
  d.oncancel = () => {};
  return { d, h, body, actions };
}

function show(d) {
  if (d.open) return;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}

export function closeDialog(el, silent) {
  const d = el._$ && el._$.dialog;
  if (!d) return;
  if (silent) d.onclose = null;
  if (silent && el._editing) { const id = el._editing; el._editing = null; el._fire('slotclose', { id }); }
  if (d.open && typeof d.close === 'function') d.close(); else d.removeAttribute('open');
}

function session(el, id, source) {
  let base = null;
  return {
    input(patch) {
      const loc = el._locate(id);
      if (!loc) return;
      if (!base) base = el._value;
      el._liveBase = base;
      const slots = clone(el._slotsOf(loc.day)).map((s) => (s.id === id ? { ...s, ...patch } : s));
      el._live(el._withDay(loc.day, slots), { source, id, ...(loc.day ? { day: loc.day } : {}) });
      el._schedule('data');
    },
    commit(patch) {
      if (base) { el._value = base; el._liveBase = null; base = null; }
      el.updateSlot(id, patch);
    },
  };
}

function refocus(el, id) {
  queueMicrotask(() => {
    const t = el._$.track;
    const b = t && (t.querySelector(`[data-open="${CSS.escape(id)}"]`) || t.querySelector('[data-open]'));
    if (b) b.focus();
  });
}

export function openEditor(el, id) {
  const loc = el._locate(id);
  if (!loc || el.cfg.readonly || el._badWeek) return;
  const cfg = el.cfg, t = el.t;
  const hasFields = el.models.some((m) => m.fields && m.fields.length);
  const mode = cfg.editor === 'quick' || cfg.editor === 'full' ? cfg.editor : (cfg.rename || cfg.remove || cfg.timeEdit || hasFields) ? 'full' : 'quick';
  const cur = () => { const l = el._locate(id); return l ? l.slot : null; };
  const slotName = () => { const s = cur(); const l = el._locate(id); if (!s) return ''; const idx = el._slotsOf(l.day).findIndex((x) => x.id === id); return s.label || t('slotDefault', { n: idx + 1 }); };
  closeDialog(el, true);
  el._editing = id;
  const { d, h, body, actions } = shell(el, mode === 'quick' ? t('pickModel', { name: slotName() }) : slotName(), () => {
    const eid = el._editing;
    el._editing = null;
    if (eid) el._fire('slotclose', { id: eid });
    refocus(el, id);
  });
  const sess = session(el, id, 'values');
  const err = el._mk('p', 'error', { attrs: { role: 'alert' } });
  err.hidden = true;
  const fail = (reason) => { err.textContent = t(ERR[reason] || 'err.locked', { minutes: el._minGap, time: '', min: el._minSlots, max: cfg.maxSlots }); err.hidden = false; };

  // -- time + name
  if (mode === 'full') {
    const s0 = cur();
    if (cfg.timeEdit) {
      const lab = el._mk('label', 'label', { text: t('slotTime') });
      const inp = el._mk('input', 'input', { generic: ['input'], attrs: { type: 'time', step: '60', required: '' } });
      inp.value = s0.time;
      inp.disabled = isLocked(s0, 'time');
      inp.onchange = () => {
        const e = el._retime(id, inp.value);
        if (e) { fail(e); inp.setAttribute('aria-invalid', 'true'); inp.value = cur().time; } else { err.hidden = true; inp.removeAttribute('aria-invalid'); }
        h.textContent = slotName();
      };
      lab.append(inp);
      body.append(lab);
    }
    if (cfg.rename) {
      const lab = el._mk('label', 'label', { text: t('slotName') });
      const inp = el._mk('input', 'input', { generic: ['input'], attrs: { type: 'text', maxlength: cfg.labelMax || 40, placeholder: t('slotDefault', { n: el._slotsOf(el._locate(id).day).findIndex((x) => x.id === id) + 1 }) } });
      inp.value = s0.label || '';
      inp.disabled = isLocked(s0, 'label');
      inp.oninput = () => sess.input({ label: inp.value });
      inp.onchange = () => { sess.commit({ label: inp.value.trim() }); h.textContent = slotName(); };
      lab.append(inp);
      body.append(lab);
    }
  }

  // -- model grid
  const grid = el._mk('div', 'model-grid', { attrs: { role: 'radiogroup', 'aria-label': t('pickModel', { name: slotName() }) } });
  const fieldsBox = el._mk('div', 'fields');
  fieldsBox.style.cssText = 'display:grid;gap:.8rem';
  const renderFields = () => {
    fieldsBox.replaceChildren();
    const s = cur();
    const m = s && el.modelOf(s.model);
    if (mode !== 'full' || !m || !m.fields || !m.fields.length) return;
    for (const f of m.fields) fieldsBox.append(buildField(el, f, id, sess));
  };
  const pick = (mid) => {
    const s = cur();
    if (!s || s.model === mid || isLocked(s, 'model')) { if (mode === 'quick') d.close(); return; }
    el.updateSlot(id, { model: mid });
    renderGrid();
    renderFields();
    if (mode === 'quick') d.close();
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
      const btn = el._mk('button', 'model-option', { states: selected ? ['model-option-selected'] : [], class: m.classes, attrs: { role: 'radio', 'aria-checked': selected ? 'true' : 'false', tabindex: selected ? '0' : '-1', 'data-model': m.id } });
      const custom = el._renderer('modelOption', { model: m, selected, slot: clone(s), t, preview: modelPreview(m, el.modelIndex(m.id), defaultValues(m), s) });
      if (!applyRendered(btn, custom)) {
        const sw = el._mk('span', 'model-icon', { class: 'dr-model-swatch' });
        sw.style.background = modelPreview(m, el.modelIndex(m.id), s.model === m.id ? s.values : defaultValues(m), s);
        if (m.off) sw.dataset.off = '';
        fillIcon(sw, m.icon);
        btn.append(sw, el._mk('span', 'model-label', { text: el.label(m, m.id) }));
        if (m.hint) btn.title = m.hint;
      }
      btn.onclick = () => pick(m.id);
      grid.append(btn);
      opts.push(btn);
    });
    if (!known) {
      const u = el._mk('div', 'model-option', { attrs: { 'aria-disabled': 'true' }, text: t('unknownModel', { id: s.model }) });
      u.style.opacity = '.7';
      grid.prepend(u);
    }
    grid.onkeydown = (e) => {
      const k = e.key;
      if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(k)) return;
      e.preventDefault();
      const i = Math.max(0, opts.findIndex((b) => b === b.getRootNode().activeElement));
      const n = opts[(i + (k === 'ArrowRight' || k === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length];
      if (n) { n.focus(); n.click(); }
    };
  };
  if (!isLocked(cur(), 'model')) { renderGrid(); body.append(grid); }
  renderFields();
  body.append(fieldsBox, err);

  // -- extra region + actions
  if (mode === 'full') {
    const extra = el._renderMode === 'light' ? el._mk('div', 'region', { class: 'dr-region' }) : el._mk('slot', 'editor-extra');
    if (el._renderMode === 'light') for (const n of el._slotted['editor-extra'] || []) extra.append(n); else extra.setAttribute('name', 'editor-extra');
    body.append(extra);
    if (cfg.remove && !isLocked(cur(), 'remove')) {
      const l = el._locate(id);
      const rm = el._mk('button', 'button', { generic: ['button', 'button-danger'], text: t('remove') });
      rm.disabled = el._slotsOf(l.day).length <= el._minSlots;
      rm.onclick = () => { if (el.removeSlot(id)) d.close(); else fail('min-slots'); };
      actions.append(rm);
    }
    const done = el._mk('button', 'button', { generic: ['button', 'button-primary'], text: t('done') });
    done.onclick = () => d.close();
    actions.append(done);
  } else {
    const c = el._mk('button', 'button', { generic: ['button'], text: t('close') });
    c.onclick = () => d.close();
    actions.append(c);
  }
  show(d);
  el._fire('slotopen', { id });
}

export function openSaveDay(el) {
  const t = el.t;
  const { d, body, actions } = shell(el, t('saveDayTitle'), () => refocusButton(el, 'preset-save'));
  const lab = el._mk('label', 'label', { text: t('dayName') });
  const inp = el._mk('input', 'input', { generic: ['input'], attrs: { type: 'text', maxlength: 40, placeholder: t('dayNamePlaceholder'), required: '' } });
  lab.append(inp);
  body.append(lab);
  const ok = el._mk('button', 'button', { generic: ['button', 'button-primary'], text: t('confirm') });
  const no = el._mk('button', 'button', { generic: ['button'], text: t('cancel') });
  ok.disabled = true;
  inp.oninput = () => { ok.disabled = !inp.value.trim(); };
  const go = () => { const n = inp.value.trim(); if (!n) return; d.close(); el._saveDay(n); };
  ok.onclick = go;
  inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  no.onclick = () => d.close();
  actions.append(no, ok);
  show(d);
}

function refocusButton(el, part) {
  queueMicrotask(() => { const b = el._$.root.querySelector(`[data-part="${part}"]`); if (b) b.focus(); });
}

export function openCopy(el) {
  const t = el.t;
  const from = el._sel;
  const { d, body, actions } = shell(el, t('copyDayTitle', { day: el.dayName(from) }), () => refocusButton(el, 'week-copy'));
  const short = el._mk('div', 'toolbar');
  const grid = el._mk('div', 'copy-grid');
  const boxes = new Map();
  for (const day of el.dayOrder) {
    if (day === from) continue;
    const row = el._mk('label', 'toggle-row');
    const cb = el._mk('input', 'input', { generic: ['input'], attrs: { type: 'checkbox' } });
    cb.style.width = 'auto';
    row.append(cb, document.createTextNode(el.dayName(day)));
    grid.append(row);
    boxes.set(day, cb);
  }
  const preset = (label, days) => {
    const b = el._mk('button', 'button', { generic: ['button'], text: label });
    b.onclick = () => { for (const [k, cb] of boxes) cb.checked = days.includes(k); };
    return b;
  };
  short.append(preset(t('copyWeekdays'), WEEKDAYS.slice(0, 5)), preset(t('copyWeekend'), WEEKDAYS.slice(5)), preset(t('copyAll'), WEEKDAYS));
  body.append(short, grid);
  const ok = el._mk('button', 'button', { generic: ['button', 'button-primary'], text: t('confirm') });
  const no = el._mk('button', 'button', { generic: ['button'], text: t('cancel') });
  ok.onclick = () => { const to = [...boxes].filter(([, cb]) => cb.checked).map(([k]) => k); d.close(); if (to.length) el.copyDay(from, to); };
  no.onclick = () => d.close();
  actions.append(no, ok);
  show(d);
}

export { parseTime };
