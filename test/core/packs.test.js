import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { packs } from '../../packs/index.js';
import { validate } from '../../schema/validate.js';
import { validateDay, validateWeek, tryParseTime } from '../../src/core/index.js';
import { mergeConfig, jsonSafe } from '../../src/ui/config.js';

const schema = JSON.parse(readFileSync(new URL('../../schema/config.schema.json', import.meta.url), 'utf8'));
const EXPECTED = ['light-scenes', 'aquarium-reef', 'screen-filter', 'thermostat', 'irrigation', 'blinds', 'pool-pump', 'ev-charging', 'grow-light', 'office-hours', 'water-heater', 'ventilation', 'pet-feeder', 'presence-simulation', 'garden-lighting', 'sleep-wake'];
const WEEKLY = new Set(['thermostat', 'irrigation', 'blinds', 'ev-charging', 'office-hours', 'water-heater', 'sleep-wake']);

test('all 16 packs from the spec exist, each with a file and a demo page', () => {
  assert.deepEqual(Object.keys(packs).sort(), [...EXPECTED].sort());
  const files = readdirSync(new URL('../../packs/', import.meta.url));
  const pages = readdirSync(new URL('../../examples/packs/', import.meta.url));
  for (const id of EXPECTED) {
    assert.ok(files.includes(`${id}.js`), `${id}.js`);
    assert.ok(pages.includes(`${id}.html`), `${id}.html demo page`);
  }
});

for (const id of EXPECTED) {
  test(`pack ${id}: JSON-safe, matches the config schema, models/presets/messages complete`, () => {
    const p = packs[id];
    assert.equal(p.id, id);
    // plain JSON (round-trips unchanged) => exportConfig-compatible
    assert.deepEqual(jsonSafe(p), JSON.parse(JSON.stringify(p)));
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
    const errs = validate(schema, JSON.parse(JSON.stringify(p)));
    assert.deepEqual(errs, []);
    assert.equal(!!(p.week === 'top'), WEEKLY.has(id), 'default mode matches the spec table');

    const ids = p.models.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length, 'unique model ids');
    for (const m of p.models) {
      assert.ok(m.icon, `${m.id}: icon`);
      assert.ok(m.off || m.preview || m.previewScale, `${m.id}: preview colour`);
      for (const f of m.fields || []) {
        if (f.type === 'range' || f.type === 'number') {
          assert.ok(f.min < f.max, `${m.id}.${f.key} range`);
          assert.ok(f.default >= f.min && f.default <= f.max, `${m.id}.${f.key} default in range`);
        }
      }
      const d = m.defaults || {};
      for (const f of m.fields || []) if (f.default !== undefined && f.type !== 'text') assert.ok(f.key in d || f.default !== undefined);
    }
    assert.ok(p.presets.length >= 2, 'at least two presets');
    for (const pr of p.presets) {
      for (const s of pr.slots) {
        assert.ok(tryParseTime(s.time) != null, `${pr.id} ${s.time}`);
        assert.ok(ids.includes(s.model), `${pr.id}: unknown model ${s.model}`);
      }
      assert.deepEqual(validateDay(pr.slots, { minGap: p.minGap || 30, models: p.models }), [], `preset ${pr.id} valid`);
    }
    // en + it labels for everything user-visible
    for (const lang of ['en', 'it']) {
      const m = p.messages[lang];
      assert.ok(m, lang);
      for (const mo of p.models) assert.ok(m[`model.${mo.id}`], `${lang} model.${mo.id}`);
      for (const pr of p.presets) assert.ok(m[`preset.${pr.id}`], `${lang} preset.${pr.id}`);
      for (const mo of p.models) for (const f of mo.fields || []) assert.ok(m[`field.${f.key}`], `${lang} field.${f.key}`);
    }
    // initial value is valid
    if (p.value) {
      if (Array.isArray(p.value)) assert.deepEqual(validateDay(p.value, { minGap: p.minGap || 30, models: p.models }), []);
      else assert.deepEqual(validateWeek(p.value, { minGap: p.minGap || 30, models: p.models }), []);
    }
  });
}

test('mergeConfig: deep for objects, arrays replace, undefined skipped', () => {
  const m = mergeConfig(packs.thermostat, { messages: { en: { title: 'X' } }, models: [{ id: 'a' }], week: undefined });
  assert.equal(m.week, 'top');
  assert.equal(m.messages.en.title, 'X');
  assert.ok(m.messages.en['model.eco'], 'pack messages kept');
  assert.deepEqual(m.models, [{ id: 'a' }]);
  assert.notEqual(m.presets, packs.thermostat.presets, 'copied, not shared');
});
