#!/usr/bin/env node
// Validate a dayrhythm config JSON: schema + sanity checks + icon names.
// Usage: node validate.mjs config.json [--catalog path/to/catalog.json]
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const ci = args.indexOf('--catalog');
const catalogArg = ci >= 0 ? args.splice(ci, 2)[1] : null;
const file = args[0];
if (!file) { console.error('usage: node validate.mjs config.json [--catalog icons/catalog.json]'); process.exit(2); }

// Locate the dayrhythm package root: node_modules (cwd, then up from here), then the repo this skill ships in.
const here = dirname(fileURLToPath(import.meta.url));
const roots = [];
for (let d of [process.cwd(), here]) for (;;) { roots.push(join(d, 'node_modules', 'dayrhythm')); const p = dirname(d); if (p === d) break; d = p; }
roots.push(resolve(here, '../../..'));
const root = roots.find((r) => existsSync(join(r, 'schema', 'validate.js')) && existsSync(join(r, 'schema', 'config.schema.json')));
if (!root) { console.error('Cannot find the dayrhythm package (npm i dayrhythm, or run from the repo).'); process.exit(2); }
const { validate } = await import(pathToFileURL(join(root, 'schema', 'validate.js')).href);
const schema = JSON.parse(readFileSync(join(root, 'schema', 'config.schema.json'), 'utf8'));

let config;
try { config = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`ERROR: ${file} is not valid JSON (${e.message})`); process.exit(1); }

const errors = [], warns = [];
for (const e of validate(schema, config)) errors.push(`${e.path}: ${e.message}`);

// ---- icon names
let names = null; // Set of catalog names + aliases
const catPath = [catalogArg, join(root, 'icons', 'catalog.json')].filter(Boolean).find(existsSync);
if (catPath) {
  const cat = JSON.parse(readFileSync(catPath, 'utf8'));
  names = new Set(cat.flatMap((i) => [i.name, ...(i.aliases || [])]));
} else {
  const reg = join(root, 'icons', 'index.js');
  if (existsSync(reg)) names = new Set(Object.keys((await import(pathToFileURL(reg).href)).icons));
}
if (!names) warns.push('no icons catalog found: icon names were not checked');

const isName = (s) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s);
function checkIcon(icon, path) {
  if (typeof icon !== 'string') return; // {src} objects are checked by the schema
  const s = icon.trim();
  if (!s || s.startsWith('<svg') || /^(https?:|data:|\/|\.\/|\.\.\/)/.test(s)) return;
  if (isName(s)) {
    if (names && !names.has(s)) errors.push(`${path}: icon "${s}" is not in the catalog. Search icons/catalog.json by keyword and use an existing name.`);
    return;
  }
  if (/^[\x20-\x7e]+$/.test(s) && s.length > 3) warns.push(`${path}: icon "${s}" is neither a catalog name, svg, URL nor emoji`);
}

// ---- model checks
const models = Array.isArray(config.models) ? config.models : [];
const ids = new Set();
const weekly = !!(config.value && !Array.isArray(config.value) && config.value.week);
models.forEach((m, i) => {
  const p = `/models/${i}`;
  if (!m || typeof m !== 'object') return;
  if (ids.has(m.id)) errors.push(`${p}/id: duplicate model id "${m.id}"`);
  ids.add(m.id);
  checkIcon(m.icon, `${p}/icon`);
  if (!m.off && !m.preview && !m.previewScale) warns.push(`${p}: model "${m.id}" has no preview colour (preview or previewScale)`);
  const keys = new Set();
  (m.fields || []).forEach((f, j) => {
    const fp = `${p}/fields/${j}`;
    if (!f || typeof f !== 'object') return;
    if (keys.has(f.key)) errors.push(`${fp}/key: duplicate field key "${f.key}"`);
    keys.add(f.key);
    if (['range', 'number'].includes(f.type)) {
      if (f.min == null || f.max == null) warns.push(`${fp}: ${f.type} field "${f.key}" should set min and max`);
      else if (f.min >= f.max) errors.push(`${fp}: min (${f.min}) must be lower than max (${f.max})`);
      if (typeof f.default === 'number' && f.min != null && f.max != null && (f.default < f.min || f.default > f.max)) errors.push(`${fp}/default: ${f.default} is outside ${f.min}..${f.max}`);
      if (f.default == null) warns.push(`${fp}: field "${f.key}" has no default`);
    }
    if (f.type === 'select') {
      if (!f.options || !f.options.length) errors.push(`${fp}: select field "${f.key}" needs options`);
      else if (f.default != null && !f.options.some((o) => o.value === f.default)) errors.push(`${fp}/default: "${f.default}" is not one of the options`);
    }
  });
  if (m.defaults && m.fields) for (const k of Object.keys(m.defaults)) if (!keys.has(k)) warns.push(`${p}/defaults/${k}: no field named "${k}" in this model`);
  if (m.previewScale && !keys.has(m.previewScale.field)) errors.push(`${p}/previewScale/field: "${m.previewScale.field}" is not a field of this model`);
  const known = new Set([...keys, ...Object.keys(m.defaults || {}), 'value']);
  for (const key of [...`${m.summary || ''} ${m.preview || ''}`.matchAll(/\{(\w+)\}/g)].map((x) => x[1])) if (!known.has(key)) errors.push(`${p}: template uses {${key}} but the model has no such field or default`);
  if (m.days && !weekly) warns.push(`${p}/days: only meaningful in weekly mode`);
});
(config.presets || []).forEach((pr, i) => checkIcon(pr.icon, `/presets/${i}/icon`));

// ---- slot checks (value, presets, days)
const minGap = config.minGap ?? 5;
const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
function checkDay(slots, p) {
  if (!Array.isArray(slots)) return;
  const seen = new Set();
  slots.forEach((s, i) => {
    if (!s || typeof s.time !== 'string' || !/^\d\d:\d\d$/.test(s.time)) return; // the schema reports it
    if (seen.has(s.time)) errors.push(`${p}/${i}/time: two slots start at ${s.time}`);
    seen.add(s.time);
    if (ids.size && s.model && !ids.has(s.model)) errors.push(`${p}/${i}/model: unknown model "${s.model}"`);
  });
  if (weekly && p.startsWith('/value')) return; // weekly days carry over: no cyclic gap rule
  const t = [...seen].map(toMin).sort((a, b) => a - b);
  if (t.length < 2) return;
  t.forEach((m, i) => {
    const gap = i + 1 < t.length ? t[i + 1] - m : t[0] + 1440 - m;
    if (gap < minGap) errors.push(`${p}: slots at ${fmt(m)} and ${fmt((m + gap) % 1440)} are ${gap} min apart, minGap is ${minGap}`);
  });
}
if (Array.isArray(config.value)) checkDay(config.value, '/value');
else if (weekly) for (const [d, v] of Object.entries(config.value.week)) checkDay(v, `/value/week/${d}`);
(config.presets || []).forEach((pr, i) => checkDay(pr.slots, `/presets/${i}/slots`));
(config.days || []).forEach((d, i) => checkDay(d.slots, `/days/${i}/slots`));
if (weekly && config.week === 'off') warns.push('/week is "off" but value is weekly');
if (!weekly && config.value && ['top', 'bottom'].includes(config.week)) warns.push('/week is set but value is a daily array');

// ---- theme
const knownThemes = ['organic', 'neutral', 'flat', 'none', 'dose', 'glow', 'arcade', 'lumen', 'midnight', 'kiln', 'blueprint', 'console', 'terminal', 'ultraviolet', 'brutal', 'garden', 'sticker'];
if (typeof config.theme === 'string' && !knownThemes.includes(config.theme)) warns.push(`/theme: "${config.theme}" is not a known theme id (fine if you register it yourself)`);

for (const w of warns) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR: ${e}`);
console.log(errors.length ? `\n${errors.length} error(s), ${warns.length} warning(s)` : `OK: ${file} is valid (${models.length} models${warns.length ? `, ${warns.length} warning(s)` : ''})`);
process.exit(errors.length ? 1 : 0);
