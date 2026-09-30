// Pure (DOM-free) parts of the UI layer. The element itself is not instantiated here: no DOM in plain Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, jsonSafe, parseAttr, defaults, ATTRS, KNOWN } from '../../src/ui/config.js';
import { makeT, locales } from '../../src/i18n/index.js';
import { buildLayout, pieceAt, gradientStops } from '../../src/ui/layout.js';
import { coerceField, fmtField, interp, modelPreview, modelSummary, inWindow, modelsFor, defaultValues } from '../../src/ui/model.js';
import { adapterFrom } from '../../src/storage.js';
import { offsetFor } from '../../src/ui/clock.js';

const S = (id, time) => ({ id, time, model: 'm' });

test('importing the element module in Node does not throw (SSR-safe)', async () => {
  const m = await import('../../src/element.js');
  assert.equal(typeof m.DayRhythmElement, 'function');
  const idx = await import('../../src/index.js');
  assert.ok(idx.core.activeSlotAt);
});

test('config: attribute parsing follows the toggle convention', () => {
  assert.equal(parseAttr('toggle', 'off'), false);
  assert.equal(parseAttr('toggle', '0'), false);
  assert.equal(parseAttr('toggle', 'false'), false);
  assert.equal(parseAttr('toggle', ''), true);
  assert.equal(parseAttr('toggle', 'yes'), true);
  assert.equal(parseAttr('int', '45'), 45);
  assert.equal(parseAttr('int', 'x'), undefined);
  assert.deepEqual(parseAttr('json', '{"a":1}'), { a: 1 });
  assert.throws(() => parseAttr('json', '{oops'));
  assert.equal(parseAttr('str', 'false'), false);
  // every attribute maps to a known config key (or `value`)
  for (const [, [key]] of Object.entries(ATTRS)) assert.ok(KNOWN.has(key), key);
});

test('config: layers merge deeply, arrays replace, later wins', () => {
  const m = mergeConfig(defaults, { classes: { slot: 'a' }, models: [{ id: 'x' }] }, { classes: { slotActive: 'b' }, theme: 'flat' });
  assert.deepEqual(m.classes, { slot: 'a', slotActive: 'b' });
  assert.deepEqual(m.models, [{ id: 'x' }]);
  assert.equal(m.theme, 'flat');
  assert.equal(defaults.theme, 'organic', 'defaults untouched');
  assert.equal(mergeConfig({ maxSlots: 3 }, { maxSlots: null }).maxSlots, null, 'null overrides');
});

test('config: jsonSafe drops functions, undefined and function-only objects', () => {
  const out = jsonSafe({ a: 1, f() {}, u: undefined, storage: { list() {}, save() {} }, nested: { x: [1, () => 1] }, cls: { k: 'v' } });
  assert.deepEqual(out, { a: 1, nested: { x: [1, null] }, cls: { k: 'v' } });
});

test('i18n: en/it, region fallback, interpolation, plurals, overrides, per-locale messages', () => {
  const en = makeT('en', {});
  const it = makeT('it-IT', {});
  assert.equal(en('apply' in {} ? 'x' : 'add'), 'Add slot');
  assert.equal(it('add'), 'Aggiungi fascia');
  assert.equal(en('slotDefault', { n: 3 }), 'Slot 3');
  assert.equal(en('nope'), 'nope');
  assert.equal(makeT('fr', {})('add'), 'Add slot', 'unknown locale falls back to en');
  assert.equal(makeT('en', { add: 'Plus' })('add'), 'Plus');
  const per = makeT('it', { en: { add: 'EN only' }, it: { add: 'Solo IT' }, remove: 'Flat' });
  assert.equal(per('add'), 'Solo IT');
  assert.equal(per('remove'), 'Flat');
  assert.equal(makeT('en', { 'x_one': '{count} thing', 'x_other': '{count} things' })('x', { count: 1 }), '1 thing');
  assert.equal(makeT('en', { 'x_one': '{count} thing', 'x_other': '{count} things' })('x', { count: 2 }), '2 things');
  locales.register('xx', { add: 'XX add' });
  assert.equal(makeT('xx-YY', {})('add'), 'XX add');
  assert.equal(makeT('xx', {})('remove'), 'Remove slot');
});

test('i18n: en and it define exactly the same keys, none of the removed apply keys', () => {
  const a = Object.keys(locales.en).sort(), b = Object.keys(locales.it).sort();
  assert.deepEqual(a, b);
  for (const k of ['apply', 'sending', 'applied', 'applyFailed', 'dirty', 'revert']) assert.ok(!(k in locales.en), k);
});

test('layout: daily origin=first / midnight / frozen seam / weekly carry', () => {
  const day = [S('a', '07:00'), S('b', '22:00')];
  const dur = (l) => l.pieces.map((p) => `${p.key}:${p.dur}`);
  assert.deepEqual(dur(buildLayout(day, { origin: 'first' })), ['main:a:900', 'main:b:540']);
  assert.equal(buildLayout(day, { origin: 'first' }).origin, 420);
  assert.deepEqual(dur(buildLayout(day, { origin: 'midnight' })), ['tail:420', 'main:a:900', 'main:b:120']);
  assert.deepEqual(dur(buildLayout(day, { origin: 'first', frozen: true })), ['tail:0', 'main:a:900', 'main:b:540', 'tail-end:0']);
  const w = buildLayout(day, { cyclic: false, carry: S('z', '10:00') });
  assert.deepEqual(dur(w), ['carry:420', 'main:a:900', 'main:b:120']);
  assert.equal(w.pieces.reduce((s, p) => s + p.dur, 0), 1440);
  assert.deepEqual(dur(buildLayout([], { cyclic: false, carry: S('z', '10:00') })), ['carry:1440']);
  assert.deepEqual(buildLayout([], {}).pieces, []);
  // every layout covers exactly 24 h
  for (const o of [{ origin: 'first' }, { origin: 'midnight' }, { origin: 'first', frozen: true }]) {
    assert.equal(buildLayout(day, o).pieces.reduce((s, p) => s + p.dur, 0), 1440);
  }
  // single slot
  assert.equal(buildLayout([S('only', '09:00')], { origin: 'midnight' }).pieces.reduce((s, p) => s + p.dur, 0), 1440);
});

test('layout: pieceAt places the now line, gradientStops builds a strip', () => {
  const day = [S('a', '07:00'), S('b', '22:00')];
  const mid = buildLayout(day, { origin: 'midnight' });
  assert.equal(pieceAt(mid, 60).piece.key, 'tail');
  assert.equal(pieceAt(mid, 60).frac, 60 / 420);
  assert.equal(pieceAt(mid, 7 * 60).piece.key, 'main:a');
  const first = buildLayout(day, { origin: 'first' });
  assert.equal(pieceAt(first, 60).piece.key, 'main:b'); // 01:00 is inside the wrapping slot
  assert.ok(Math.abs(pieceAt(first, 22 * 60 + 270).frac - 0.5) < 1e-9);
  assert.equal(gradientStops(mid.pieces, (s) => s.id), 'b 0.00% 29.17%,a 29.17% 91.67%,b 91.67% 100.00%');
});

test('model: field coercion clamps, steps and falls back to the default', () => {
  const f = { key: 'k', type: 'range', min: 10, max: 50, step: 5, default: 20 };
  assert.equal(coerceField(f, '27'), 25);
  assert.equal(coerceField(f, 999), 50);
  assert.equal(coerceField(f, -4), 10);
  assert.equal(coerceField(f, 'abc'), 20);
  assert.equal(coerceField({ ...f, step: 0.5, min: 5, max: 30 }, 20.3), 20.5);
  const sel = { key: 's', type: 'select', default: 'b', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] };
  assert.equal(coerceField(sel, 'a'), 'a');
  assert.equal(coerceField(sel, 'zzz'), 'b');
  assert.equal(coerceField({ key: 't', type: 'toggle' }, 'true'), true);
  assert.equal(coerceField({ key: 'c', type: 'color', default: '#000' }, 'red'), '#000');
  assert.equal(coerceField({ key: 'n', type: 'text', default: '' }, 5), '');
});

test('model: formatting, summaries and previews (JSON forms and function forms)', () => {
  const fields = [{ key: 'temp', type: 'range', unit: ' °C' }, { key: 'kelvin', type: 'range', format: '{value} K' }];
  assert.equal(fmtField(fields[0], 21), '21 °C');
  assert.equal(fmtField(fields[1], 2700), '2700 K');
  assert.equal(interp('{temp} / {kelvin} / {x}', { temp: 21, kelvin: 3000 }, fields), '21 °C / 3000 K / {x}');
  const m = { id: 'm', summary: '{temp} °C', preview: 'hsl({hue} 70% 55%)', defaults: { temp: 21, hue: 30 } };
  assert.equal(modelSummary(m, { temp: 19 }), '19 °C');
  assert.equal(modelPreview(m, 0, { hue: 200 }), 'hsl(200 70% 55%)');
  const scaled = { id: 's', previewScale: { field: 'v', min: 0, max: 100, from: '#000', to: '#fff' } };
  assert.equal(modelPreview(scaled, 0, { v: 50 }), 'color-mix(in oklab, #fff 50%, #000)');
  assert.equal(modelPreview({ id: 'f', preview: () => 'red' }, 0, {}), 'red');
  assert.equal(modelPreview({ id: 'x', preview: () => { throw new Error('boom'); } }, 2, {}).startsWith('hsl('), true);
  assert.deepEqual(defaultValues({ id: 'd', defaults: { a: 1 }, fields: [{ key: 'b', type: 'range', default: 2 }] }), { b: 2, a: 1 });
  assert.equal(defaultValues({ id: 'p' }), undefined);
});

test('model: when windows (may wrap midnight) and days filter', () => {
  assert.equal(inWindow({ from: '05:00', to: '22:00' }, 6 * 60), true);
  assert.equal(inWindow({ from: '05:00', to: '22:00' }, 23 * 60), false);
  assert.equal(inWindow({ from: '22:00', to: '05:00' }, 23 * 60), true);
  assert.equal(inWindow({ from: '22:00', to: '05:00' }, 3 * 60), true);
  assert.equal(inWindow({ from: '22:00', to: '05:00' }, 12 * 60), false);
  const models = [{ id: 'day', when: { from: '05:00', to: '22:00' } }, { id: 'night', when: { from: '22:00', to: '05:00' } }, { id: 'we', days: ['sat', 'sun'] }, { id: 'any' }];
  assert.deepEqual(modelsFor(models, { time: '12:00' }, 'mon').map((x) => x.id), ['day', 'any']);
  assert.deepEqual(modelsFor(models, { time: '23:00' }, 'sat').map((x) => x.id), ['night', 'we', 'any']);
  assert.deepEqual(modelsFor(models, { time: '12:00' }, 'sun', (s, list) => list.slice(0, 1)).map((x) => x.id), ['day']);
});

test('storage: adapterFrom understands the JSON forms', () => {
  assert.equal(adapterFrom(null), null);
  assert.equal(adapterFrom({ type: 'nope' }), null);
  const mine = { list() {}, save() {}, remove() {} };
  assert.equal(adapterFrom(mine), mine);
  const http = adapterFrom({ type: 'http', url: '/api/days' });
  assert.equal(typeof http.list, 'function');
  assert.equal(typeof adapterFrom({ type: 'local', key: 'k' }).save, 'function');
});

test('clock: offsetFor computes the difference to the browser clock', () => {
  const opts = {};
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  assert.ok(Math.abs(offsetFor(hhmm, opts)) <= 1.1);
  const plus = new Date(now.getTime() + 90 * 60000);
  const p = `${String(plus.getHours()).padStart(2, '0')}:${String(plus.getMinutes()).padStart(2, '0')}`;
  assert.ok(Math.abs(offsetFor(p, opts) - 90) <= 1.1);
});
