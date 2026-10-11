// Render barrel kept stable for existing imports.
import { buildRoot as makeRoot, region } from './render/root.js';
import { renderWeekBar } from './render/weekbar.js';
import { renderPresets } from './render/days.js';
import { renderToolbar } from './render/toolbar.js';
import { renderTrack, updateNow, setState, nameOf } from './render/track.js';

export { region, setState, nameOf, renderTrack, updateNow };

export function buildRoot(el) {
  makeRoot(el);
  renderData(el);
}

export function renderData(el) {
  const $ = el._$;
  if (!$.root) return;
  $.root.dataset.orient = el.resolvedOrientation;
  $.root.setAttribute('aria-busy', el._state.status === 'loading' ? 'true' : 'false');
  $.root.setAttribute('aria-label', el.t(el.weekMode ? 'titleWeek' : 'title'));
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
