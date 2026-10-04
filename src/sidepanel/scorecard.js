/**
 * Draws the shareable scorecard onto a canvas. Geometry comes from
 * scorecard-layout.js and content from shared/scorecard-model.js; this module
 * only paints, so `drawScorecard` works with any 2D context.
 */

import { BAR_COUNT, computeBars, computeLayout, DEFAULT_FORMAT } from './scorecard-layout.js';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MAX_EXPORT_SCALE = 2;

export const THEMES = Object.freeze({
  dark: {
    id: 'dark',
    label: 'Dark',
    bgFrom: '#09090b',
    bgTo: '#111827',
    glow: 'rgba(59, 130, 246, 0.22)',
    grid: 'rgba(148, 163, 184, 0.05)',
    panel: 'rgba(255, 255, 255, 0.045)',
    border: 'rgba(255, 255, 255, 0.10)',
    text: '#fafafa',
    muted: '#a1a1aa',
    faint: '#71717a',
    accent: '#3b82f6',
    accentSoft: '#60a5fa',
    track: 'rgba(255, 255, 255, 0.09)',
    missed: 'rgba(248, 113, 113, 0.55)',
    markText: '#ffffff',
  },
  light: {
    id: 'light',
    label: 'Light',
    bgFrom: '#ffffff',
    bgTo: '#eef4ff',
    glow: 'rgba(59, 130, 246, 0.16)',
    grid: 'rgba(15, 23, 42, 0.045)',
    panel: 'rgba(15, 23, 42, 0.04)',
    border: 'rgba(15, 23, 42, 0.10)',
    text: '#0a0a0a',
    muted: '#52525b',
    faint: '#71717a',
    accent: '#2563eb',
    accentSoft: '#3b82f6',
    track: 'rgba(15, 23, 42, 0.09)',
    missed: 'rgba(239, 68, 68, 0.45)',
    markText: '#ffffff',
  },
});

const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws text; shrinks the font until it fits `maxWidth`. */
function text(ctx, value, x, y, { size, weight = 400, color, align = 'left', maxWidth, spacing }) {
  let fontSize = size;
  ctx.font = font(fontSize, weight);
  if ('letterSpacing' in ctx) ctx.letterSpacing = spacing ? `${spacing}px` : '0px';
  while (maxWidth && fontSize > 10 && ctx.measureText(value).width > maxWidth) {
    fontSize -= 1;
    ctx.font = font(fontSize, weight);
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
  const width = ctx.measureText(value).width;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return width;
}

function drawBackground(ctx, { width, height }, theme) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.bgFrom);
  gradient.addColorStop(1, theme.bgTo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 40) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();

  const radius = Math.max(width, height) * 0.7;
  const glow = ctx.createRadialGradient(width, 0, 0, width, 0, radius);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawHeader(ctx, layout, model, theme) {
  const { header } = layout;
  const mark = header.h;
  const gradient = ctx.createLinearGradient(header.x, header.y, header.x + mark, header.y + mark);
  gradient.addColorStop(0, theme.accentSoft);
  gradient.addColorStop(1, theme.accent);
  ctx.fillStyle = gradient;
  roundRectPath(ctx, header.x, header.y, mark, mark, mark * 0.28);
  ctx.fill();

  // "X" glyph inside the brand mark.
  const inset = mark * 0.3;
  ctx.strokeStyle = theme.markText;
  ctx.lineWidth = mark * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(header.x + inset, header.y + inset);
  ctx.lineTo(header.x + mark - inset, header.y + mark - inset);
  ctx.moveTo(header.x + mark - inset, header.y + inset);
  ctx.lineTo(header.x + inset, header.y + mark - inset);
  ctx.stroke();

  const baseline = header.y + mark / 2 + mark * 0.23;
  text(ctx, 'XQuiz', header.x + mark + 16, baseline, {
    size: mark * 0.66,
    weight: 800,
    color: theme.text,
  });
  text(ctx, model.rangeLabel, header.x + header.w, baseline, {
    size: mark * 0.42,
    weight: 500,
    color: theme.muted,
    align: 'right',
  });
}

function drawRing(ctx, layout, model, theme) {
  const { cx, cy, r, stroke } = layout.ring;
  ctx.lineCap = 'round';
  ctx.lineWidth = stroke;
  ctx.strokeStyle = theme.track;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (model.accuracy) {
    const start = -Math.PI / 2;
    const gradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gradient.addColorStop(0, theme.accentSoft);
    gradient.addColorStop(1, theme.accent);
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + (Math.PI * 2 * Math.min(model.accuracy, 100)) / 100);
    ctx.stroke();
  }

  const valueSize = r * 0.78;
  const label = model.accuracy === null ? '--' : String(model.accuracy);
  const numberWidth = text(ctx, label, cx, cy + valueSize * 0.28, {
    size: valueSize,
    weight: 800,
    color: theme.text,
    align: 'center',
    maxWidth: r * 1.5,
  });
  if (model.accuracy !== null) {
    text(ctx, '%', cx + numberWidth / 2 + 4, cy + valueSize * 0.28 - valueSize * 0.36, {
      size: valueSize * 0.4,
      weight: 700,
      color: theme.muted,
    });
  }
  text(ctx, 'ACCURACY', cx, cy + r * 0.62, {
    size: r * 0.15,
    weight: 700,
    color: theme.muted,
    align: 'center',
    spacing: 2,
  });
}

function drawRank(ctx, layout, model, theme) {
  const { rank, tagline } = layout;
  text(ctx, model.rank.title, rank.x, rank.y, {
    size: rank.size,
    weight: 800,
    color: theme.text,
    align: rank.align,
    maxWidth: rank.maxWidth,
  });
  text(ctx, model.rank.tagline, tagline.x, tagline.y, {
    size: tagline.size,
    weight: 500,
    color: theme.muted,
    align: tagline.align,
    maxWidth: tagline.maxWidth,
  });
}

function drawChips(ctx, layout, model, theme) {
  const items = [
    { label: 'SCORE', value: `${model.score.correct}/${model.score.total}`, accent: false },
    { label: 'STREAK', value: String(model.streak), accent: model.streak > 0 },
    { label: 'BEST STREAK', value: String(model.bestStreak), accent: false },
  ];
  layout.chips.forEach((chip, i) => {
    ctx.fillStyle = theme.panel;
    roundRectPath(ctx, chip.x, chip.y, chip.w, chip.h, 18);
    ctx.fill();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    const padX = chip.h * 0.28;
    text(ctx, items[i].label, chip.x + padX, chip.y + chip.h * 0.34, {
      size: chip.h * 0.15,
      weight: 700,
      color: theme.muted,
      spacing: 1.5,
    });
    text(ctx, items[i].value, chip.x + padX, chip.y + chip.h * 0.8, {
      size: chip.h * 0.42,
      weight: 800,
      color: items[i].accent ? theme.accentSoft : theme.text,
      maxWidth: chip.w - padX * 2,
    });
  });
}

function drawChart(ctx, layout, model, theme) {
  const { chart, chartParts: parts } = layout;
  ctx.fillStyle = theme.panel;
  roundRectPath(ctx, chart.x, chart.y, chart.w, chart.h, 22);
  ctx.fill();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const headingSize = chart.h > 200 ? 22 : 18;
  const headingWidth = text(ctx, 'LAST 7 DAYS', parts.heading.x, parts.heading.y, {
    size: headingSize,
    weight: 700,
    color: theme.muted,
    spacing: 2,
  });

  // Legend
  let legendX = parts.heading.x + headingWidth + 28;
  for (const [label, color] of [
    ['Correct', theme.accent],
    ['Missed', theme.missed],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legendX + 6, parts.heading.y - headingSize * 0.35, 6, 0, Math.PI * 2);
    ctx.fill();
    legendX +=
      20 +
      text(ctx, label, legendX + 20, parts.heading.y, {
        size: headingSize * 0.9,
        weight: 500,
        color: theme.faint,
      }) +
      20;
  }

  const { today, week } = model;
  const summary = week.answered
    ? `Today ${today.answered}  ·  Week ${week.answered} answered, ${week.accuracy}%`
    : 'No answers this week yet';
  text(ctx, summary, parts.summary.x, parts.summary.y, {
    size: headingSize * 0.95,
    weight: 600,
    color: theme.text,
    align: 'right',
    maxWidth: chart.w * 0.5,
  });

  // Baseline
  const { plot } = parts;
  ctx.strokeStyle = theme.track;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y + plot.h + 6);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h + 6);
  ctx.stroke();

  const bars = computeBars(
    { ...plot, y: plot.y + 18, h: plot.h - 18 },
    model.days.slice(-BAR_COUNT)
  );
  bars.forEach((bar, i) => {
    const day = model.days[i];
    const radius = Math.min(8, bar.w / 4);
    if (bar.empty) {
      ctx.fillStyle = theme.track;
      roundRectPath(ctx, bar.x, bar.total.y, bar.w, bar.total.h, radius);
      ctx.fill();
    } else {
      ctx.save();
      roundRectPath(ctx, bar.x, bar.total.y, bar.w, bar.total.h, radius);
      ctx.clip();
      ctx.fillStyle = theme.missed;
      ctx.fillRect(bar.x, bar.missed.y, bar.w, bar.missed.h);
      const fill = ctx.createLinearGradient(0, bar.correct.y, 0, bar.correct.y + bar.correct.h);
      fill.addColorStop(0, theme.accentSoft);
      fill.addColorStop(1, theme.accent);
      ctx.fillStyle = fill;
      ctx.fillRect(bar.x, bar.correct.y, bar.w, bar.correct.h);
      ctx.restore();
      text(ctx, String(day.answered), bar.centerX, bar.total.y - 10, {
        size: 18,
        weight: 700,
        color: day.isToday ? theme.text : theme.muted,
        align: 'center',
      });
    }
    text(ctx, day.isToday ? 'Today' : day.label, bar.centerX, parts.labelY, {
      size: day.isToday ? 18 : 20,
      weight: day.isToday ? 800 : 500,
      color: day.isToday ? theme.accentSoft : theme.muted,
      align: 'center',
    });
  });
}

function drawFooter(ctx, layout, theme) {
  const { footer } = layout;
  text(ctx, 'XQuiz · Attention & retention tracker for X', footer.x, footer.y, {
    size: 20,
    weight: 500,
    color: theme.faint,
  });
  text(ctx, 'Are you actually reading your feed?', footer.x + footer.w, footer.y, {
    size: 20,
    weight: 600,
    color: theme.muted,
    align: 'right',
  });
}

/**
 * Paints the whole scorecard. The context must already be scaled so that one
 * unit equals one logical pixel of the layout.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../shared/scorecard-model.js').ScorecardModel} model
 * @param {ReturnType<typeof computeLayout>} layout
 * @param {typeof THEMES.dark} theme
 */
export function drawScorecard(ctx, model, layout, theme) {
  drawBackground(ctx, layout, theme);
  drawHeader(ctx, layout, model, theme);
  drawRing(ctx, layout, model, theme);
  drawRank(ctx, layout, model, theme);
  drawChips(ctx, layout, model, theme);
  drawChart(ctx, layout, model, theme);
  drawFooter(ctx, layout, theme);
}

/**
 * Export scale: follows the display's pixel ratio (1x-2x) so the preview and
 * the saved PNG stay crisp on hi-dpi screens without producing huge files.
 * @param {number} [devicePixelRatio]
 */
export function exportScale(devicePixelRatio = globalThis.devicePixelRatio ?? 1) {
  return Math.min(MAX_EXPORT_SCALE, Math.max(1, Math.ceil(devicePixelRatio)));
}

/**
 * Renders the scorecard to a new canvas.
 * @param {import('../shared/scorecard-model.js').ScorecardModel} model
 * @param {{format?: 'wide' | 'square', theme?: 'dark' | 'light', scale?: number}} [options]
 * @returns {HTMLCanvasElement}
 */
export function renderScorecardCanvas(
  model,
  { format = DEFAULT_FORMAT, theme = 'dark', scale } = {}
) {
  const layout = computeLayout(format);
  const pixelScale = scale ?? exportScale();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * pixelScale);
  canvas.height = Math.round(layout.height * pixelScale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.scale(pixelScale, pixelScale);
  drawScorecard(ctx, model, layout, THEMES[theme] ?? THEMES.dark);
  return canvas;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode PNG.'))),
      'image/png'
    )
  );
