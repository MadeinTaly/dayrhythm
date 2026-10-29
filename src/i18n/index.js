import en from './en.js';
import it from './it.js';

const table = { en, it };

/** Registry of message tables. `register('fr', { add: '...' })` (partial is fine). */
export const locales = {
  en, it,
  register(code, messages) {
    table[code] = { ...(table[code] || {}), ...messages };
    this[code] = table[code];
  },
  get: (code) => table[code],
};

/** Resolves `xx-YY` -> `xx` -> `en`. */
export function pickLocale(code) {
  const c = String(code || 'en').toLowerCase();
  return { full: table[c] || null, base: table[c.split('-')[0]] || null };
}

/**
 * Builds t(key, vars). Order: config messages (per-locale table, then flat) -> locale -> en.
 * `messages` may be flat ({key: string}) or per-locale ({it: {key: string}}).
 */
export function makeT(code, messages) {
  const lang = String(code || 'en').toLowerCase();
  const base = lang.split('-')[0];
  const flat = {};
  const per = {};
  for (const k of Object.keys(messages || {})) {
    const v = messages[k];
    if (v && typeof v === 'object') per[k.toLowerCase()] = v;
    else flat[k] = v;
  }
  const chain = [per[lang], per[base], flat, table[lang], table[base], en].filter(Boolean);
  let pr;
  try { pr = new Intl.PluralRules(base); } catch (e) { pr = null; }
  const lookup = (k) => { for (const t of chain) if (t[k] != null) return t[k]; return undefined; };
  const t = (key, vars) => {
    let s;
    if (vars && typeof vars.count === 'number' && pr) s = lookup(`${key}_${pr.select(vars.count)}`);
    if (s == null) s = lookup(key);
    if (s == null) return key;
    // a variable passed but empty shows '?', not '{k}'
    return vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : k in vars ? '?' : m)) : String(s);
  };
  t.has = (key) => lookup(key) !== undefined;
  return t;
}
