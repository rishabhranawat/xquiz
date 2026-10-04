import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeBars,
  computeLayout,
  FORMATS,
  splitColumns,
} from '../src/sidepanel/scorecard-layout.js';

const inside = (rect, width, height) =>
  rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= width && rect.y + rect.h <= height;

test('formats have the documented pixel sizes', () => {
  assert.deepEqual([FORMATS.wide.width, FORMATS.wide.height], [1200, 630]);
  assert.deepEqual([FORMATS.square.width, FORMATS.square.height], [1080, 1080]);
});

for (const id of ['wide', 'square']) {
  test(`${id} layout keeps every region inside the canvas without overlap`, () => {
    const layout = computeLayout(id);
    const { width, height } = layout;
    for (const rect of [layout.header, layout.chart, ...layout.chips]) {
      assert.ok(inside(rect, width, height), `${JSON.stringify(rect)} is out of bounds`);
    }
    assert.equal(layout.chips.length, 3);

    const ringBottom = layout.ring.cy + layout.ring.r + layout.ring.stroke / 2;
    const ringTop = layout.ring.cy - layout.ring.r - layout.ring.stroke / 2;
    assert.ok(ringTop >= layout.header.y + layout.header.h, 'ring overlaps header');
    assert.ok(ringBottom <= layout.chart.y, 'ring overlaps chart');

    // Vertical flow: header < chips < chart < footer.
    const chipsBottom = Math.max(...layout.chips.map((chip) => chip.y + chip.h));
    assert.ok(layout.header.y + layout.header.h <= layout.chips[0].y);
    assert.ok(chipsBottom <= layout.chart.y, 'chips overlap chart');
    assert.ok(layout.chart.y + layout.chart.h < layout.footer.y, 'chart overlaps footer');
    assert.ok(layout.footer.y < height);

    // Chips do not overlap each other.
    layout.chips.slice(1).forEach((chip, i) => {
      assert.ok(chip.x >= layout.chips[i].x + layout.chips[i].w);
    });

    // Chart internals stay inside the chart panel.
    const { plot, labelY } = layout.chartParts;
    assert.ok(plot.y >= layout.chart.y && plot.y + plot.h < labelY);
    assert.ok(labelY < layout.chart.y + layout.chart.h);
    assert.ok(plot.x >= layout.chart.x && plot.x + plot.w <= layout.chart.x + layout.chart.w);
  });
}

test('computeLayout falls back to wide for unknown formats', () => {
  assert.equal(computeLayout('nope').width, 1200);
});

test('splitColumns divides a rect evenly', () => {
  const cols = splitColumns({ x: 10, y: 5, w: 320, h: 40 }, 3, 10);
  assert.deepEqual(
    cols.map((c) => c.x),
    [10, 120, 230]
  );
  assert.ok(Math.abs(cols[2].x + cols[2].w - 330) < 1e-9);
});

test('computeBars scales bars to the busiest day and splits correct/missed', () => {
  const plot = { x: 0, y: 100, w: 700, h: 100 };
  const days = [
    { answered: 10, correct: 5 },
    { answered: 0, correct: 0 },
    { answered: 5, correct: 5 },
    { answered: 1, correct: 0 },
    { answered: 0, correct: 0 },
    { answered: 0, correct: 0 },
    { answered: 0, correct: 0 },
  ];
  const bars = computeBars(plot, days);
  assert.equal(bars.length, 7);
  assert.equal(bars[0].total.h, 100);
  assert.equal(bars[0].correct.h, 50);
  assert.equal(bars[0].missed.h, 50);
  assert.equal(bars[2].total.h, 50);
  assert.equal(bars[2].missed.h, 0);
  assert.equal(bars[1].empty, true);
  assert.ok(bars[3].total.h >= 6, 'tiny days still get a visible bar');
  for (const bar of bars) {
    assert.ok(bar.x >= plot.x && bar.x + bar.w <= plot.x + plot.w);
    assert.ok(bar.total.y >= plot.y && bar.total.y + bar.total.h <= plot.y + plot.h + 1e-9);
  }
});

test('computeBars copes with an all-zero week', () => {
  const bars = computeBars(
    { x: 0, y: 0, w: 70, h: 40 },
    Array(7).fill({ answered: 0, correct: 0 })
  );
  assert.ok(bars.every((bar) => bar.empty));
});
