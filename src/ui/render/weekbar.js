// Week navigation and tab previews.
import { parseTime } from '../../core/time.js';
import { clone } from '../../core/slots.js';
import { isWeek, carrySlotFor } from '../../core/week.js';
import { buildLayout, gradientStops } from '../layout.js';
import { modelPreview } from '../model.js';
import { applyRendered, fillIcon } from '../dom.js';
import { openCopy } from '../dialog.js';
import { region } from './root.js';

export function dayPieces(el, day) {
  const slots = el._slotsOf(day);
  const c = carrySlotFor(el._weekView(), day, el._days);
  return buildLayout(slots, { cyclic: false, carry: c && c.slot }).pieces;
}

export function slotColor(el, slot) {
  const m = el.modelOf(slot.model);
  const c = modelPreview(m, el.modelIndex(slot.model), slot.values, slot);
  return m && m.off ? 'color-mix(in srgb, currentColor 18%, transparent)' : c;
}

export function renderWeekBar(el) {
  const { weekTop, weekBottom } = el._$;
  weekTop.replaceChildren(); weekBottom.replaceChildren();
  weekTop.hidden = weekBottom.hidden = true;
  if (!el.weekMode || el.weekRows) return;
  const pos = el.cfg.week === 'bottom' ? weekBottom : weekTop;
  pos.hidden = false;
  pos.replaceChildren(weekBar(el));
}

function weekBar(el) {
  const cfg = el.cfg, t = el.t;
  const bar = el._mk('div', 'week-bar');
  const prev = el._mk('button', 'week-prev', { generic: ['button'], text: '‹', attrs: { 'aria-label': t('prevDay') } });
  const next = el._mk('button', 'week-next', { generic: ['button'], text: '›', attrs: { 'aria-label': t('nextDay') } });
  prev.onclick = () => el.prevDay();
  next.onclick = () => el.nextDay();
  const tabs = el._mk('div', 'week-tablist', { attrs: { role: 'tablist', 'aria-label': t('weekLabel') } });
  const nowDay = el.nowDay;
  const order = el.dayOrder;
  for (const d of order) {
    const selected = d === el._sel;
    const slots = el._slotsOf(d);
    const ref = isWeek(el._value) && el._value.week[d] && el._value.week[d].ref;
    const linked = ref ? el._days.find((x) => x.id === ref) : null;
    const states = [];
    if (selected) states.push('week-tab-selected');
    if (d === nowDay) states.push('week-tab-today');
    if (ref) states.push('week-tab-linked');
    if (!slots.length) states.push('week-tab-empty');
    const summary = slots.length ? slots.slice(0, 4).map((s) => `${el.fmt(parseTime(s.time))} ${el.label(el.modelOf(s.model), s.model)}`).join(', ') + (slots.length > 4 ? '...' : '') : t('empty');
    const tab = el._mk('button', 'week-tab', {
      states,
      attrs: {
        role: 'tab', id: `${el._uid}-tab-${d}`, 'aria-selected': selected ? 'true' : 'false', 'aria-controls': `${el._uid}-panel`,
        tabindex: selected ? '0' : '-1', 'aria-label': t('weekTabAria', { day: el.dayName(d), summary }), 'data-day': d,
        title: linked ? t('linkedTo', { name: linked.name }) : null,
      },
    });
    if (d === nowDay) tab.setAttribute('aria-current', 'date');
    if (d === nowDay) tab.dataset.today = '';
    if (!slots.length) tab.dataset.empty = '';
    if (ref) tab.dataset.linked = '';
    const custom = el._renderer('weekTab', { day: d, label: el.dayName(d, 'short'), slots: clone(slots), selected, today: d === nowDay, linked: linked ? clone(linked) : undefined });
    if (!applyRendered(tab, custom)) {
      tab.append(
        el._mk('span', 'week-tab-long', { class: 'dr-tab-long', text: el.dayName(d, 'short') }),
        el._mk('span', 'week-tab-short', { class: 'dr-tab-short', text: el.dayName(d, 'narrow') }),
      );
      if (cfg.weekPreview) {
        const pv = el._mk('span', 'week-tab-preview');
        const stops = gradientStops(dayPieces(el, d), (s) => slotColor(el, s));
        if (stops) pv.style.background = `linear-gradient(90deg,${stops})`;
        tab.append(pv);
      }
    }
    tab.onclick = () => el.selectDay(d);
    tabs.append(tab);
  }
  tabs.onkeydown = (e) => {
    const i = order.indexOf(el._sel);
    let n = null;
    if (e.key === 'ArrowRight') n = order[(i + 1) % 7];
    else if (e.key === 'ArrowLeft') n = order[(i + 6) % 7];
    else if (e.key === 'Home') n = order[0];
    else if (e.key === 'End') n = order[6];
    if (n) { e.preventDefault(); el._focusTab = n; el.selectDay(n); }
  };
  bar.append(prev, tabs, next);
  if (cfg.weekCopy && !cfg.readonly) {
    const cp = el._mk('button', 'week-copy', { generic: ['button'], text: t('copyDayTo') });
    cp.onclick = () => openCopy(el);
    bar.append(cp);
  }
  bar.append(region(el, 'week-extra', 'week-extra'));
  return bar;
}
