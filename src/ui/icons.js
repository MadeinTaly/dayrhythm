/** Registry of named SVG icons; the `dayrhythm/icons` entry (or dist/dayrhythm-icons.js) fills it. Model `icon: "sunrise"` resolves here. */
export const icons = {
  register(map) { if (map && typeof map === 'object') for (const [k, v] of Object.entries(map)) if (typeof v === 'string') this[k] = v; return this; },
};

const NAME = /^[a-z0-9-]+(:[a-z0-9-]+)?$/;
const warned = new Set();

/** SVG markup for a registered icon name ("sunrise", "lucide:sunrise"), else null. Unknown name-like strings warn once. */
export function namedIcon(icon) {
  if (typeof icon !== 'string' || !NAME.test(icon)) return null;
  const name = icon.replace(/^lucide:/, '');
  const svg = Object.prototype.hasOwnProperty.call(icons, name) && typeof icons[name] === 'string' ? icons[name] : null;
  if (!svg && name.length > 2 && !warned.has(name)) { warned.add(name); console.warn(`[dayrhythm] unknown icon "${icon}" (load dayrhythm/icons?), shown as text`); }
  return svg;
}
