import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isDayKey,
  isPastDeliveryTime,
  localDayKey,
  nextOccurrence,
  parseTimeOfDay,
  pruneByDay,
  retainedDays,
  shiftDay,
} from '../src/shared/day.js';

test('localDayKey buckets by the local calendar day, not UTC', () => {
  assert.equal(localDayKey(new Date(2026, 0, 5, 0, 0, 1)), '2026-01-05');
  assert.equal(localDayKey(new Date(2026, 0, 5, 23, 59, 59)), '2026-01-05');
  assert.equal(localDayKey(new Date(2026, 11, 31, 23, 30)), '2026-12-31');
  assert.equal(localDayKey(new Date(2026, 0, 6, 0, 0)), '2026-01-06');
});

test('isDayKey validates the format', () => {
  assert.ok(isDayKey('2026-01-05'));
  for (const bad of ['2026-1-5', 'today', '', null, 20260105]) assert.ok(!isDayKey(bad));
});

test('shiftDay crosses month and year boundaries', () => {
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDay('2028-03-01', -1), '2028-02-29');
});

test('retainedDays lists today and the previous days', () => {
  assert.deepEqual(retainedDays('2026-03-02', 3), ['2026-03-02', '2026-03-01', '2026-02-28']);
});

test('pruneByDay keeps the last 7 days and drops older or malformed keys', () => {
  const byDay = {};
  for (let i = 0; i < 10; i++) byDay[shiftDay('2026-01-10', -i)] = i;
  byDay.garbage = 1;
  const pruned = pruneByDay(byDay, '2026-01-10', 7);
  assert.equal(Object.keys(pruned).length, 7);
  assert.ok('2026-01-04' in pruned);
  assert.ok(!('2026-01-03' in pruned));
  assert.ok(!('garbage' in pruned));
  assert.deepEqual(pruneByDay(undefined, '2026-01-10', 7), {});
});

test('parseTimeOfDay', () => {
  assert.deepEqual(parseTimeOfDay('21:00'), { hours: 21, minutes: 0 });
  assert.deepEqual(parseTimeOfDay('7:05'), { hours: 7, minutes: 5 });
  assert.equal(parseTimeOfDay('25:00'), null);
  assert.equal(parseTimeOfDay('12:5'), null);
  assert.equal(parseTimeOfDay(null), null);
});

test('nextOccurrence picks today when still ahead, otherwise tomorrow', () => {
  const morning = new Date(2026, 0, 5, 8, 0).getTime();
  assert.equal(nextOccurrence(morning, '21:00'), new Date(2026, 0, 5, 21, 0).getTime());
  const evening = new Date(2026, 0, 5, 21, 0).getTime();
  assert.equal(nextOccurrence(evening, '21:00'), new Date(2026, 0, 6, 21, 0).getTime());
  const lateNight = new Date(2026, 0, 31, 23, 0).getTime();
  assert.equal(nextOccurrence(lateNight, '21:00'), new Date(2026, 1, 1, 21, 0).getTime());
  assert.equal(nextOccurrence(morning, 'bad'), new Date(2026, 0, 5, 21, 0).getTime());
});

test('isPastDeliveryTime', () => {
  assert.ok(!isPastDeliveryTime(new Date(2026, 0, 5, 20, 59).getTime(), '21:00'));
  assert.ok(isPastDeliveryTime(new Date(2026, 0, 5, 21, 0).getTime(), '21:00'));
});
