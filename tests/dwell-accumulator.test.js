import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDwellAccumulator } from '../src/content/dwell-accumulator.js';

const post = (id) => ({ author: 'a', text: `post ${id}`, displayName: 'A', hasMedia: false });
const dwellOf = (batch, id) => batch.find((p) => p.id === id)?.dwellMs;

test('accrues dwell only while a post is visible', () => {
  const acc = createDwellAccumulator({ now: 0 });
  acc.noteActivity(0);
  acc.setVisible('1', true, 1000, post('1'));
  acc.noteActivity(3000);
  acc.setVisible('1', false, 4000);
  acc.noteActivity(9000); // time after leaving does not count
  const batch = acc.collect(10_000);
  assert.equal(dwellOf(batch, '1'), 3000);
  assert.equal(batch[0].visits, 1);
});

test('tracks several visible posts independently', () => {
  const acc = createDwellAccumulator({ now: 0 });
  acc.setVisible('1', true, 0, post('1'));
  acc.setVisible('2', true, 2000, post('2'));
  acc.setVisible('1', false, 5000);
  const batch = acc.collect(6000);
  assert.equal(dwellOf(batch, '1'), 5000);
  assert.equal(dwellOf(batch, '2'), 4000);
});

test('pauses while the page is hidden or unfocused', () => {
  const acc = createDwellAccumulator({ now: 0 });
  acc.setVisible('1', true, 0, post('1'));
  acc.setPageActive(false, 5000);
  acc.setPageActive(true, 15_000);
  acc.noteActivity(16_000);
  assert.equal(dwellOf(acc.collect(20_000), '1'), 5000 + 5000);
});

test('stops accruing at the idle deadline, not when idleness is noticed', () => {
  const acc = createDwellAccumulator({ idleMs: 30_000, now: 0 });
  acc.noteActivity(0);
  acc.setVisible('1', true, 0, post('1'));
  // No input at all for 5 minutes: only the first 30s count.
  assert.equal(dwellOf(acc.collect(300_000), '1'), 30_000);
});

test('activity after an idle gap resumes accrual', () => {
  const acc = createDwellAccumulator({ idleMs: 30_000, now: 0 });
  acc.noteActivity(0);
  acc.setVisible('1', true, 0, post('1'));
  acc.noteActivity(100_000); // credits 0-30s, then idle until 100s
  acc.noteActivity(110_000); // 10s of fresh activity window
  assert.equal(dwellOf(acc.collect(110_000), '1'), 30_000 + 10_000);
});

test('continuous activity keeps crediting past the idle window', () => {
  const acc = createDwellAccumulator({ idleMs: 30_000, now: 0 });
  acc.setVisible('1', true, 0, post('1'));
  for (let t = 10_000; t <= 120_000; t += 10_000) acc.noteActivity(t);
  assert.equal(dwellOf(acc.collect(120_000), '1'), 120_000);
});

test('collect resets counters but keeps visible posts accruing', () => {
  const acc = createDwellAccumulator({ now: 0 });
  acc.setVisible('1', true, 0, post('1'));
  assert.equal(dwellOf(acc.collect(4000), '1'), 4000);
  acc.noteActivity(5000);
  const second = acc.collect(6000);
  assert.equal(dwellOf(second, '1'), 2000);
  assert.equal(second[0].visits, 0); // the single visit was reported in the first batch
  acc.setVisible('1', false, 6000);
  assert.deepEqual(acc.collect(7000), []);
  assert.equal(acc.visibleCount, 0);
});

test('revisits are counted as additional visits', () => {
  const acc = createDwellAccumulator({ now: 0 });
  acc.setVisible('1', true, 0, post('1'));
  acc.setVisible('1', false, 2000);
  acc.setVisible('1', true, 5000, post('1'));
  acc.setVisible('1', true, 5500, post('1')); // duplicate observer entry is not a new visit
  acc.setVisible('1', false, 8000);
  const [entry] = acc.collect(9000);
  assert.equal(entry.visits, 2);
  assert.equal(entry.dwellMs, 5000);
  assert.equal(entry.firstSeen, 0);
  assert.equal(entry.lastSeen, 8000);
});

test('posts that never accrued dwell are not reported', () => {
  const acc = createDwellAccumulator({ now: 0 });
  acc.setVisible('1', true, 1000, post('1'));
  acc.setVisible('1', false, 1000);
  assert.deepEqual(acc.collect(2000), []);
});

test('ignores clock going backwards', () => {
  const acc = createDwellAccumulator({ now: 10_000 });
  acc.setVisible('1', true, 10_000, post('1'));
  acc.noteActivity(5000);
  assert.equal(dwellOf(acc.collect(10_500), '1'), 500);
});
