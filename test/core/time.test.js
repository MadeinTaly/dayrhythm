import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, tryParseTime, formatTime, minutesOf, weekdayOf, WEEKDAYS } from '../../src/core/index.js';

test('parseTime / tryParseTime', () => {
  assert.equal(parseTime('00:00'), 0);
  assert.equal(parseTime('23:59'), 1439);
  assert.equal(parseTime('07:05'), 425);
  for (const bad of ['24:00', '7:00', '07:60', '', 'ab:cd', '07:00:00']) {
    assert.throws(() => parseTime(bad), RangeError, bad);
    assert.equal(tryParseTime(bad), null);
  }
  assert.equal(tryParseTime(null), null);
});

test('formatTime wraps and supports 12h', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(1440), '00:00');
  assert.equal(formatTime(-30), '23:30');
  assert.equal(formatTime(425), '07:05');
  assert.equal(formatTime(0, { format: '12h' }), '12:00 AM');
  assert.equal(formatTime(13 * 60 + 5, { format: '12h' }), '1:05 PM');
  assert.equal(formatTime(12 * 60, { format: '12h' }), '12:00 PM');
});

test('minutesOf: strings, numbers, Dates with offsets and zones', () => {
  assert.equal(minutesOf('07:30'), 450);
  assert.equal(minutesOf('07:30:30'), 450.5);
  assert.equal(minutesOf(1500), 60);
  assert.equal(minutesOf(-60), 1380);
  const d = new Date('2026-03-10T06:00:00Z');
  assert.equal(minutesOf(d, { utcOffsetMinutes: 120 }), 480);
  assert.equal(minutesOf(d, { utcOffsetMinutes: -390 }), 1440 - 30);
  assert.equal(minutesOf(d, { timeZone: 'Europe/Rome' }), 420);
  assert.throws(() => minutesOf('25:00'), RangeError);
});

test('weekdayOf follows the zone, not the runtime', () => {
  const d = new Date('2026-01-04T23:30:00Z'); // Sunday in UTC
  assert.equal(weekdayOf(d, { utcOffsetMinutes: 0 }), 'sun');
  assert.equal(weekdayOf(d, { utcOffsetMinutes: 120 }), 'mon');
  assert.equal(weekdayOf(d, { timeZone: 'America/Los_Angeles' }), 'sun');
  assert.deepEqual([...WEEKDAYS], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
});
