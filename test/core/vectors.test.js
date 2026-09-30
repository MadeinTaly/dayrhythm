import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeSlotAt, moveBoundary, addSlotAt } from '../../src/core/index.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../vectors/${f}`, import.meta.url), 'utf8'));
const conv = (at) => (at && typeof at === 'object' && at.iso ? [new Date(at.iso), { utcOffsetMinutes: at.utcOffsetMinutes, timeZone: at.timeZone }] : [at, undefined]);

for (const suite of load('active-slot.json').suites) {
  test(`daily vectors: ${suite.name}`, () => {
    for (const c of suite.cases) {
      const [at, opts] = conv(c.at);
      const r = activeSlotAt(suite.slots, at, opts);
      assert.equal(r ? r.slot.id : null, c.expect, `at ${JSON.stringify(c.at)}`);
    }
  });
}

for (const suite of load('active-slot-week.json').suites) {
  test(`weekly vectors: ${suite.name}`, () => {
    for (const c of suite.cases) {
      let at = c.at, opts = { days: suite.days };
      if (c.at.iso) { const [d, o] = conv(c.at); at = d; opts = { ...opts, ...o }; }
      const r = activeSlotAt({ week: suite.week }, at, opts);
      const got = r ? { id: r.slot.id, day: r.day, dayOffset: r.dayOffset } : null;
      assert.deepEqual(got, c.expect, `at ${JSON.stringify(c.at)}`);
    }
  });
}

const mv = load('moves.json');
for (const suite of mv.moveBoundary) {
  test(`moveBoundary: ${suite.name}`, () => {
    for (const c of suite.cases) {
      const r = moveBoundary(suite.slots, c.id, c.to, { ...suite.opts, ...c.opts });
      assert.deepEqual({ time: r.time, clamped: r.clamped }, c.expect, `${c.id} -> ${c.to}`);
      // never reorders, never mutates input
      assert.deepEqual(r.slots.map((s) => s.id), suite.slots.map((s) => s.id));
    }
  });
}
for (const c of mv.addSlotAt) {
  test(`addSlotAt: ${c.name}`, () => {
    const r = addSlotAt(c.slots, c.opts);
    if (c.expect.error) assert.equal(r.error, c.expect.error);
    else {
      assert.equal(r.error, undefined);
      assert.equal(r.added.time, c.expect.time);
      assert.equal(r.added.model, c.expect.model);
      assert.equal(r.slots.length, c.slots.length + 1);
    }
  });
}
