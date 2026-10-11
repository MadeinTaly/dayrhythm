// Add/randomize/save actions shared by strip and dial layouts.
import { openCopy, openSaveDay } from '../dialog.js';
import { region } from './root.js';

export function renderToolbar(el) {
  const box = el._$.toolbar;
  box.replaceChildren();
  const cfg = el.cfg, t = el.t;
  const main = el._mk('div', 'toolbar-main');
  if (!cfg.readonly) {
    if (cfg.add) {
      const b = el._mk('button', 'add', { generic: ['button'], text: '+ ' + t('add') });
      b.disabled = el._badWeek;
      b.onclick = () => { const s = el.addSlot(); if (s) queueMicrotask(() => el.focusSlot(s.id)); };
      main.append(b);
    }
    if (el.weekRows && cfg.weekCopy) {
      const b = el._mk('button', 'week-copy', { generic: ['button'], text: t('copyDayTo') });
      b.onclick = () => openCopy(el);
      main.append(b);
    }
    if (el.weekRows) main.prepend(el._mk('span', 'toolbar-day', { text: el.dayName(el._sel) }));
    if (cfg.randomize) {
      const b = el._mk('button', 'randomize', { generic: ['button'], text: t('randomize') });
      b.onclick = () => el.randomize();
      main.append(b);
    }
    if (el.hasDaysArea) {
      const b = el._mk('button', 'preset-save', { generic: ['button'], text: t('saveDay') });
      b.onclick = () => openSaveDay(el);
      main.append(b);
    }
  }
  box.append(main, region(el, 'toolbar', 'toolbar-extra'));
  box.hidden = !cfg.add && !cfg.randomize && !el.hasDaysArea && !(el.weekRows && cfg.weekCopy) && !(el._slotted.toolbar || []).length;
  if (cfg.readonly && !(el._slotted.toolbar || []).length) box.hidden = true;
}
