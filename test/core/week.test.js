import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeek, resolveWeek, withDay, copyDay, weekRanges, activeSlotAt, nextChange, validateWeek, orderedWeekdays, firstDayOfWeek, WEEKDAYS, carrySlotFor,
} from '../../src/core/index.js';

const S = (id, time) => ({ id, time, model: 'm' });
const days = [{ id: 'd1', name: 'Office', slots: [S('r', '06:00'), S('s', '18:00')] }];
const week = { week: { mon: [S('a', '07:00'), S('b', '20:00')], tue: { ref: 'd1' }, wed: [S('c', '08:00')] } };

test('isWeek discriminates arrays from week objects', () => {
  assert.equal(isWeek(week), true);
  assert.equal(isWeek([]), false);
  assert.equal(isWeek({}), false);
  assert.equal(isWeek(null), false);
});

test('resolveWeek expands refs, unknown refs become empty, always seven days', () => {
  const r = resolveWeek(week, days);
  assert.deepEqual(Object.keys(r), [...WEEKDAYS]);
  assert.deepEqual(r.tue.map((s) => s.id), ['r', 's']);
  assert.deepEqual(r.thu, []);
  assert.deepEqual(resolveWeek({ week: { mon: { ref: 'nope' } } }, days).mon, []);
});

test('withDay is immutable', () => {
  const next = withDay(week, 'thu', [S('z', '10:00')]);
  assert.equal(week.week.thu, undefined);
  assert.equal(next.week.thu[0].id, 'z');
});

test('copyDay: targets, shortcuts, source excluded, refs copied as refs, new ids', () => {
  const c = copyDay(week, 'mon', 'weekdays');
  assert.deepEqual(Object.keys(c.week).sort(), ['fri', 'mon', 'thu', 'tue', 'wed']);
  assert.equal(c.week.tue.length, 2);
  assert.notEqual(c.week.tue[0].id, 'a');
  assert.equal(c.week.mon[0].id, 'a');
  const e = copyDay(week, 'mon', 'weekend', { newIds: false });
  assert.equal(e.week.sat[0].id, 'a');
  const r = copyDay(week, 'tue', ['fri']);
  assert.deepEqual(r.week.fri, { ref: 'd1' });
  assert.deepEqual(copyDay(week, 'mon', ['mon']).week.mon.map((s) => s.id), ['a', 'b']);
});

test('weekRanges: absolute minutes, last wraps to Monday', () => {
  const r = weekRanges({ week: { mon: [S('a', '07:00')], thu: [S('b', '00:00')] } });
  assert.deepEqual(r.map((x) => [x.slot.id, x.start, x.end]), [['a', 420, 4320], ['b', 4320, 10080 + 420]]);
  assert.equal(r.reduce((s, x) => s + x.duration, 0), 10080);
  assert.deepEqual(weekRanges({ week: {} }), []);
});

test('weekly activeSlotAt: Date input and duration fields', () => {
  const at = new Date('2026-01-06T09:00:00Z'); // Tuesday
  const r = activeSlotAt(week, at, { utcOffsetMinutes: 0, days });
  assert.equal(r.slot.id, 'r');
  assert.equal(r.day, 'tue');
  assert.equal(r.elapsed, 180);
  assert.equal(r.remaining, 540);
  const carry = activeSlotAt({ week: { mon: [S('a', '07:00'), S('b', '20:00')] } }, { day: 'thu', time: '12:00' });
  assert.equal(carry.slot.id, 'b');
  assert.equal(carry.dayOffset, -3);
  assert.equal(carry.elapsed, 3840); // mon 20:00 -> thu 12:00
  assert.equal(carry.remaining, 5460); // until mon 07:00 of next week
});

test('nextChange (weekly) crosses days and wraps', () => {
  const r = nextChange(week, { day: 'mon', time: '21:00' }, { days });
  assert.equal(r.slot.id, 'r');
  assert.equal(r.day, 'tue');
  assert.equal(r.inMinutes, 9 * 60);
  assert.equal(nextChange({ week: { mon: [S('a', '07:00')] } }, { day: 'mon', time: '08:00' }), null);
});

test('carrySlotFor finds the closest earlier non-empty day (wrapping)', () => {
  assert.equal(carrySlotFor(week, 'thu', days).day, 'wed');
  assert.equal(carrySlotFor(week, 'mon', days).day, 'wed');
  assert.equal(carrySlotFor({ week: { fri: [S('z', '10:00')] } }, 'fri').day, 'fri');
  assert.equal(carrySlotFor({ week: {} }, 'mon'), null);
});

test('validateWeek reports missing refs and per-day gap problems', () => {
  const issues = validateWeek({ week: { mon: [S('a', '07:00'), S('b', '07:10')], tue: { ref: 'ghost' } } }, { days, minGap: 30 });
  assert.deepEqual(issues.map((i) => `${i.day}:${i.code}`).sort(), ['mon:min-gap', 'tue:missing-ref']);
});

test('orderedWeekdays / firstDayOfWeek', () => {
  assert.deepEqual(orderedWeekdays('sun'), ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  assert.deepEqual(orderedWeekdays('wed').slice(0, 2), ['wed', 'thu']);
  assert.equal(firstDayOfWeek('it-IT'), 'mon');
  assert.equal(firstDayOfWeek('en-US'), 'sun');
  assert.equal(firstDayOfWeek('zz-invalid-locale-'), 'mon');
});
