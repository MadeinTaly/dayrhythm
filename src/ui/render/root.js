// Shadow/light root setup and the component's shared stylesheet.
import { structureCSS } from '../../styles/structure.js';
import { baseCSS } from '../../styles/base.js';
import { themeCSS } from '../../styles/themes.js';
import { dialCSS } from '../../styles/dial.js';
import { attachDrag } from '../drag.js';
import { classList, camel } from '../dom.js';
import { creditsEl } from './credits.js';

export const CSS = structureCSS + baseCSS + themeCSS + dialCSS;

let sheet = null;
let uidCounter = 0;

function docStyle() {
  if (document.head.querySelector('style[data-dayrhythm]')) return;
  const s = document.createElement('style');
  s.setAttribute('data-dayrhythm', '');
  s.textContent = `@layer theme, base, dayrhythm, components, utilities;\n@layer dayrhythm{${CSS}}`;
  document.head.prepend(s);
}

function adoptDocSheets(el, sr) {
  const build = () => {
    const out = [];
    for (const ss of document.styleSheets) {
      try {
        const css = [...ss.cssRules].map((r) => r.cssText).join('\n');
        const cs = new CSSStyleSheet();
        cs.replaceSync(css);
        out.push(cs);
      } catch (e) {
        if (!el._warned.has('xs')) {
          el._warned.add('xs');
          console.warn('[dayrhythm] inherit-styles: skipped a cross-origin or unreadable stylesheet');
        }
      }
    }
    sr.adoptedStyleSheets = [sheet, ...out];
  };
  build();
  if (el._mo) el._mo.disconnect();
  el._mo = new MutationObserver(build);
  el._mo.observe(document.head, { childList: true, subtree: true, characterData: true });
}

function attachStyles(el) {
  const cfg = el.cfg;
  if (!el._renderMode) el._renderMode = cfg.render === 'light' ? 'light' : 'shadow';
  if (!el._uid) el._uid = 'dr' + ++uidCounter;
  if (el._renderMode === 'light') {
    docStyle();
    el.setAttribute('data-dr-uid', el._uid);
    return el;
  }
  const sr = el.shadowRoot || el.attachShadow({ mode: 'open' });
  if (!el._sheetDone) {
    el._sheetDone = true;
    if (typeof CSSStyleSheet !== 'undefined' && 'adoptedStyleSheets' in sr) {
      if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); }
      sr.adoptedStyleSheets = [sheet];
    } else {
      const s = document.createElement('style');
      s.textContent = CSS;
      sr.append(s);
    }
  }
  if (cfg.inheritStyles && 'adoptedStyleSheets' in sr) adoptDocSheets(el, sr);
  return sr;
}

export function region(el, name, main) {
  const r = el._mk(el._renderMode === 'light' ? 'div' : 'slot', main);
  if (el._renderMode === 'light') {
    r.classList.add('dr-region');
    for (const n of el._slotted[name] || []) r.append(n);
  } else r.setAttribute('name', name);
  return r;
}

function userStyles(el, root) {
  const css = el.cfg.styles;
  if (!css) return;
  const s = document.createElement('style');
  s.textContent = el._renderMode === 'light' ? `@layer components{[data-dr-uid="${el._uid}"] .dr-root{${css}}}` : css;
  root.append(s);
}

export function buildRoot(el) {
  const cfg = el.cfg;
  const host = attachStyles(el);
  const $ = el._$ = {};
  const root = el._mk('div', 'root');
  $.root = root;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', el.t(el.weekMode ? 'titleWeek' : 'title'));
  root.dataset.theme = ['organic', 'neutral', 'flat', 'none'].includes(cfg.theme) ? cfg.theme : 'organic';
  root.dataset.scheme = ['light', 'dark'].includes(cfg.colorScheme) ? cfg.colorScheme : 'auto';
  if (cfg.disabled) { root.dataset.disabled = ''; root.inert = true; }
  if (cfg.readonly) root.dataset.readonly = '';
  // native input/change events from inner controls must not leak out as if they were ours
  for (const ev of ['input', 'change']) root.addEventListener(ev, (e) => { if (!(e instanceof CustomEvent)) e.stopPropagation(); });

  $.header = region(el, 'header', 'header');
  $.weekTop = el._mk('div', 'week-bar-slot');
  $.presets = el._mk('div', 'presets');
  $.toolbar = el._mk('div', 'toolbar');
  $.spectrum = el._mk('div', 'spectrum', { attrs: { role: 'img', 'aria-label': el.t('spectrumAria') } });
  $.trackwrap = el._mk('div', 'track-wrap');
  $.track = el._mk('div', 'track', { attrs: { role: 'list' } });
  $.footer = region(el, 'footer', 'footer');
  $.weekBottom = el._mk('div', 'week-bar-slot');
  $.live = el._mk('div', 'sr', { attrs: { role: 'status', 'aria-live': 'polite' } });
  $.dialog = el._mk('dialog', 'dialog');
  attachDrag(el);

  const credits = creditsEl(el);
  root.append($.header, $.weekTop, $.presets, $.toolbar, $.spectrum, $.trackwrap, $.footer, $.weekBottom, ...(credits ? [credits] : []), $.live, $.dialog);
  userStyles(el, root);
  if (el._root && el._root.parentNode) el._root.remove();
  el._root = root;
  host.append(root);
}
