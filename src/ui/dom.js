// Tiny DOM helpers shared by the UI modules.
import { namedIcon } from './icons.js';
export const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());

export function classList(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v.join(' ') : String(v)).split(/\s+/).filter(Boolean);
}

/** Applies a renderer result to `target`. Returns true when something was rendered. */
export function applyRendered(target, r) {
  if (r == null) return false;
  if (typeof r === 'string') target.replaceChildren(document.createTextNode(r));
  else if (typeof Node !== 'undefined' && r instanceof Node) target.replaceChildren(r);
  else if (typeof r === 'object' && typeof r.html === 'string') target.innerHTML = r.html;
  else return false;
  return true;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const BAD_TAG = /^(script|foreignobject|style|set|animate\w*|iframe|object|embed)$/i;
const EXT_URL = /url\(\s*['"]?\s*[^#\s'")]/i;

/** Sanitised inline <svg> element from markup, or null (parse error / not an svg). No innerHTML. */
export function safeSvg(markup) {
  const src = /<svg[^>]*\sxmlns\s*=/i.test(markup) ? markup : markup.replace(/<svg/i, `<svg xmlns="${SVG_NS}"`);
  const root = new DOMParser().parseFromString(src, 'image/svg+xml').documentElement;
  if (!root || root.localName !== 'svg' || root.getElementsByTagName('parsererror').length) return null;
  for (const n of [root, ...root.querySelectorAll('*')]) {
    if (n !== root && BAD_TAG.test(n.localName)) { n.remove(); continue; }
    for (const a of [...n.attributes]) {
      const ref = /^(xlink:)?href$/i.test(a.name);
      if (/^on/i.test(a.name) || (ref && !a.value.trim().startsWith('#')) || EXT_URL.test(a.value) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
    }
  }
  return document.importNode(root, true);
}

/** Fills `target` with a text glyph, an <img>, or a sanitised inline SVG (markup string starting with "<svg"). Never raw HTML. */
export function fillIcon(target, icon) {
  target.setAttribute('aria-hidden', 'true');
  if (icon && typeof icon === 'object' && icon.src) {
    const i = document.createElement('img');
    i.alt = ''; i.src = icon.src; i.decoding = 'async';
    target.replaceChildren(i);
    return;
  }
  const markup = namedIcon(icon) || icon;
  const svg = typeof markup === 'string' && /^\s*<svg[\s>]/i.test(markup) ? safeSvg(markup) : null;
  if (svg) target.replaceChildren(svg); else target.textContent = icon ? String(icon) : '';
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}
