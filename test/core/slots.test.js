import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortSlots, normalizeDay, slotRanges, resolveValues, removeSlotById, retimeSlot, validateDay, nextChange, activeSlotAt, genId,
} from '../../src/core/index.js';

const day = [{ id: 'c', time: '23:00', model: 'x' }, { id: 'a', time: '07:00', model: 'x' }, { id: 'b', time: '19:30', model: 'y' }];

test('sortSlots / normalizeDay: sorted, ids assigned, input untouched', () => {
  const input = [{ time: '10:00', model: 'a' }, { time: '08:00', model: 'b', id: 'keep' }];
  const out = normalizeDay(input);
  assert.deepEqual(out.map((s) => s.time), ['08:00', '10:00']);
  assert.equal(out[0].id, 'keep');
  assert.ok(out[1].id);
  assert.equal(input[0].id, undefined);
  assert.deepEqual(sortSlots(day).map((s) => s.id), ['a', 'b', 'c']);
});

test('genId is unique enough', () => {
  const ids = new Set(Array.from({ length: 5000 }, genId));
  assert.equal(ids.size, 5000);
});

test('slotRanges: wrap slot ends after 1440; cyclic:false ends at 1440', () => {
  const r = slotRanges(day);
  assert.deepEqual(r.map((x) => [x.start, x.end, x.duration]), [[420, 1170, 750], [1170, 1380, 210], [1380, 1860, 480]]);
  assert.equal(r.reduce((s, x) => s + x.duration, 0), 1440);
  const w = slotRanges(day, { cyclic: false });
  assert.equal(w[2].end, 1440);
});

test('resolveValues: field defaults < model defaults < slot values', () => {
  const models = [{ id: 'm', defaults: { a: 2 }, fields: [{ key: 'a', type: 'range', default: 1 }, { key: 'b', type: 'range', default: 5 }] }, { id: 'plain' }];
  assert.deepEqual(resolveValues({ model: 'm' }, models), { a: 2, b: 5 });
  assert.deepEqual(resolveValues({ model: 'm', values: { a: 9, z: 1 } }, models), { a: 9, b: 5, z: 1 });
  assert.equal(resolveValues({ model: 'plain' }, models), undefined);
  assert.deepEqual(resolveValues({ model: 'ghost', values: { q: 1 } }, models), { q: 1 });
});

test('removeSlotById honours minSlots and locks', () => {
  assert.equal(removeSlotById(day, 'a').length, 2);
  assert.deepEqual(removeSlotById([day[0]], 'c', { minSlots: 1 }), { error: 'min-slots' });
  assert.equal(removeSlotById([day[0]], 'c', { minSlots: 0 }).length, 0);
  assert.deepEqual(removeSlotById([{ ...day[0], locked: ['remove'] }, day[1]], 'c'), { error: 'locked' });
});

test('retimeSlot may reorder but keeps gaps and uniqueness', () => {
  const ok = retimeSlot(day, 'a', '20:30');
  assert.deepEqual(ok.slots.map((s) => s.id), ['b', 'a', 'c']);
  assert.deepEqual(retimeSlot(day, 'a', '19:30'), { error: 'duplicate-time' });
  assert.deepEqual(retimeSlot(day, 'a', '19:45'), { error: 'min-gap' });
  assert.deepEqual(retimeSlot(day, 'a', '7am'), { error: 'time-format' });
  // gap across midnight is checked too
  assert.deepEqual(retimeSlot(day, 'a', '23:20'), { error: 'min-gap' });
});

test('validateDay flags bad times, duplicates, short gaps and unknown models', () => {
  const issues = validateDay([
    { id: '1', time: '08:00', model: 'ok' }, { id: '2', time: '08:10', model: 'ghost' }, { id: '3', time: '08:10', model: 'ok' }, { id: '4', time: '25:00', model: 'ok' },
  ], { minGap: 30, models: [{ id: 'ok' }] });
  const codes = issues.map((i) => i.code).sort();
  assert.deepEqual(codes, ['duplicate-time', 'min-gap', 'time-format', 'unknown-model']);
  assert.deepEqual(validateDay(day, { minGap: 30 }), []);
});

test('nextChange (daily)', () => {
  const r = nextChange(day, '07:10');
  assert.equal(r.slot.id, 'b');
  assert.ok(Math.abs(r.inMinutes - 740) < 1e-9);
  assert.equal(nextChange([day[0]], '10:00'), null);
  assert.equal(nextChange(day, '23:30').slot.id, 'a');
});

test('activeSlotAt reports elapsed/remaining (wrap slot)', () => {
  const r = activeSlotAt(day, '01:00');
  assert.equal(r.slot.id, 'c');
  assert.equal(r.elapsed, 120);
  assert.equal(r.remaining, 360);
  assert.equal(r.end, 1860);
});

test('pushBoundary: pushes neighbours instead of stopping, never reorders', async () => {
  const { pushBoundary } = await import('../../src/core/index.js');
  const d = [{ id: 'a', time: '07:00' }, { id: 'b', time: '12:00' }, { id: 'c', time: '13:00' }, { id: 'd', time: '22:00' }];
  // forward: b to 12:50 pushes c to 13:20
  let r = pushBoundary(d, 'b', 12 * 60 + 50, { minGap: 30 });
  assert.deepEqual(r.slots.map((s) => s.time), ['07:00', '12:50', '13:20', '22:00']);
  assert.deepEqual(r.pushed, ['c']);
  // forward to the limit: cyclic last slot <= first + 1440 - gap (and <= 23:59)
  r = pushBoundary(d, 'b', 1439, { minGap: 30 });
  assert.deepEqual(r.slots.map((s) => s.time), ['07:00', '22:55', '23:25', '23:55']);
  assert.ok(r.clamped);
  // backward: c to 07:10 pushes b but never the first (anchor) slot
  r = pushBoundary(d, 'c', 7 * 60 + 10, { minGap: 30 });
  assert.deepEqual(r.slots.map((s) => s.time), ['07:00', '07:30', '08:00', '22:00']);
  // dragging the first slot pushes only forward
  r = pushBoundary(d, 'a', 12 * 60 + 40, { minGap: 30 });
  assert.deepEqual(r.slots.map((s) => s.time), ['12:40', '13:10', '13:40', '22:00']);
  r = pushBoundary(d, 'a', 0, { minGap: 30 });
  assert.equal(r.slots[0].time, '00:00');
  assert.equal(r.slots[3].time, '22:00');
  // weekly (non-cyclic): pushes down to 00:00 and up to 23:59
  r = pushBoundary(d, 'b', 0, { minGap: 30, cyclic: false });
  assert.deepEqual(r.slots.map((s) => s.time), ['00:00', '00:30', '13:00', '22:00']);
  // locked slot is a wall
  const l = d.map((s) => (s.id === 'c' ? { ...s, locked: ['time'] } : s));
  r = pushBoundary(l, 'b', 14 * 60, { minGap: 30 });
  assert.equal(r.slots[1].time, '12:30');
  assert.equal(r.slots[2].time, '13:00');
});
