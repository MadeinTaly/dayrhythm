import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleOf, pointAt, minutesAt, arcPath } from '../../src/ui/dial-geometry.js';

test('dial: midnight on top, clockwise', () => {
  assert.equal(angleOf(0), 0);
  assert.equal(angleOf(360), Math.PI / 2);
  const p = pointAt(360, 10);
  assert.ok(Math.abs(p.x - 110) < 1e-9 && Math.abs(p.y - 100) < 1e-9);
});

test('dial: minutesAt inverts pointAt', () => {
  for (let m = 0; m < 1440; m += 7) {
    const p = pointAt(m, 50);
    assert.ok(Math.abs(minutesAt(p.x, p.y) - m) < 1e-6, `minute ${m}`);
  }
});

test('dial: arcs across midnight, full ring, large-arc flag', () => {
  for (const [a, b] of [[1380, 1500], [0, 1440], [100, 900], [100, 700]]) assert.ok(!arcPath(a, b, 62, 88).includes('NaN'));
  assert.equal((arcPath(0, 1440, 62, 88).match(/A/g) || []).length, 4);
  assert.match(arcPath(100, 900, 62, 88), /A88 88 0 1 1/);
  assert.match(arcPath(100, 700, 62, 88), /A88 88 0 0 1/);
});
