// Tiny DOM helpers shared by the UI modules.
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

/** Fills `target` with a text glyph or an <img> (never HTML). */
export function fillIcon(target, icon) {
  target.setAttribute('aria-hidden', 'true');
  if (icon && typeof icon === 'object' && icon.src) {
    const i = document.createElement('img');
    i.alt = ''; i.src = icon.src; i.decoding = 'async';
    target.replaceChildren(i);
  } else target.textContent = icon ? String(icon) : '';
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}
