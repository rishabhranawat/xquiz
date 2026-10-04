/**
 * Pure layout math for the scorecard (no DOM, no canvas), so it can be unit
 * tested. All coordinates are in logical pixels; the renderer scales them.
 */

export const FORMATS = Object.freeze({
  wide: Object.freeze({ id: 'wide', label: 'Wide', width: 1200, height: 630 }),
  square: Object.freeze({ id: 'square', label: 'Square', width: 1080, height: 1080 }),
});

export const DEFAULT_FORMAT = 'wide';
export const BAR_COUNT = 7;

/** @typedef {{x: number, y: number, w: number, h: number}} Rect */

/**
 * Splits `rect` into `count` equal columns separated by `gap`.
 * @param {Rect} rect
 * @param {number} count
 * @param {number} gap
 * @returns {Rect[]}
 */
export function splitColumns(rect, count, gap) {
  const w = (rect.w - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({
    x: rect.x + i * (w + gap),
    y: rect.y,
    w,
    h: rect.h,
  }));
}

/**
 * Geometry of the 7-day stacked bar chart inside the plot area. Each bar is a
 * "correct" segment (bottom) with a "missed" segment stacked above it. Days
 * with no answers get a small stub so the week still reads as a week.
 *
 * @param {Rect} plot Area bars may occupy (labels are drawn below it).
 * @param {{answered: number, correct: number}[]} days
 * @param {{barRatio?: number, stub?: number}} [options]
 */
export function computeBars(plot, days, { barRatio = 0.52, stub = 6 } = {}) {
  const slot = plot.w / days.length;
  const barW = Math.min(slot * barRatio, 72);
  const max = Math.max(1, ...days.map((day) => day.answered));
  return days.map((day, i) => {
    const x = plot.x + slot * i + (slot - barW) / 2;
    const bottom = plot.y + plot.h;
    if (day.answered === 0) {
      return {
        x,
        w: barW,
        centerX: x + barW / 2,
        empty: true,
        total: { y: bottom - stub, h: stub },
        correct: { y: bottom, h: 0 },
        missed: { y: bottom, h: 0 },
      };
    }
    const total = Math.max(stub, (day.answered / max) * plot.h);
    const correct = total * (day.correct / day.answered);
    return {
      x,
      w: barW,
      centerX: x + barW / 2,
      empty: false,
      total: { y: bottom - total, h: total },
      correct: { y: bottom - correct, h: correct },
      missed: { y: bottom - total, h: total - correct },
    };
  });
}

/**
 * Computes every region of the scorecard for a format.
 * @param {'wide' | 'square'} formatId
 */
export function computeLayout(formatId = DEFAULT_FORMAT) {
  const format = FORMATS[formatId] ?? FORMATS[DEFAULT_FORMAT];
  return format.id === 'square' ? squareLayout(format) : wideLayout(format);
}

/** Chart panel internals shared by both formats. */
function chartParts(panel, pad) {
  const plot = { x: panel.x + pad, y: panel.y + 60, w: panel.w - pad * 2, h: panel.h - 60 - 50 };
  return {
    heading: { x: panel.x + pad, y: panel.y + 40 },
    summary: { x: panel.x + panel.w - pad, y: panel.y + 40 },
    plot,
    labelY: plot.y + plot.h + 30,
  };
}

function wideLayout({ width, height }) {
  const pad = 56;
  const header = { x: pad, y: pad, w: width - pad * 2, h: 44 };
  const hero = { x: pad, y: header.y + header.h + 28, w: width - pad * 2, h: 204 };
  const ring = { cx: pad + 102, cy: hero.y + hero.h / 2, r: 88, stroke: 24 };
  const textX = pad + 250;
  const textW = width - pad - textX;
  const chips = splitColumns({ x: textX, y: hero.y + hero.h - 84, w: textW, h: 84 }, 3, 16);
  const footerY = height - 34;
  const chart = {
    x: pad,
    y: hero.y + hero.h + 24,
    w: width - pad * 2,
    h: footerY - 38 - (hero.y + hero.h + 24),
  };
  return {
    width,
    height,
    pad,
    header,
    ring,
    rank: { x: textX, y: hero.y + 52, size: 56, maxWidth: textW, align: 'left' },
    tagline: { x: textX, y: hero.y + 90, size: 24, maxWidth: textW, align: 'left' },
    chips,
    chart,
    chartParts: chartParts(chart, 28),
    footer: { x: pad, y: footerY, w: width - pad * 2 },
  };
}

function squareLayout({ width, height }) {
  const pad = 72;
  const header = { x: pad, y: pad, w: width - pad * 2, h: 48 };
  const ring = { cx: width / 2, cy: header.y + header.h + 56 + 130, r: 118, stroke: 28 };
  const ringBottom = ring.cy + ring.r + ring.stroke / 2;
  const centerX = width / 2;
  const rank = {
    x: centerX,
    y: ringBottom + 88,
    size: 64,
    maxWidth: width - pad * 2,
    align: 'center',
  };
  const tagline = {
    x: centerX,
    y: rank.y + 46,
    size: 28,
    maxWidth: width - pad * 2,
    align: 'center',
  };
  const chips = splitColumns({ x: pad, y: tagline.y + 40, w: width - pad * 2, h: 104 }, 3, 20);
  const footerY = height - 46;
  const chartTop = chips[0].y + chips[0].h + 28;
  const chart = { x: pad, y: chartTop, w: width - pad * 2, h: footerY - 40 - chartTop };
  return {
    width,
    height,
    pad,
    header,
    ring,
    rank,
    tagline,
    chips,
    chart,
    chartParts: chartParts(chart, 32),
    footer: { x: pad, y: footerY, w: width - pad * 2 },
  };
}
