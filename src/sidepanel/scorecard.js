/**
 * Renders the shareable scorecard image onto a canvas.
 */

const WIDTH = 600;
const HEIGHT = 400;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(1, '#141414');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle grid
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Accent glow in the corner
  const glow = ctx.createRadialGradient(WIDTH - 50, 50, 0, WIDTH - 50, 50, 200);
  glow.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
  glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawText(ctx, text, x, y, { color, size, bold = false }) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.fillText(text, x, y);
}

/**
 * Draws the scorecard and returns it as a PNG data URL.
 * @param {{accuracy: number, streak: number, bestStreak: number}} stats
 * @returns {string}
 */
export function renderScorecard({ accuracy, streak, bestStreak }) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx);

  drawText(ctx, 'XQuiz', 40, 50, { color: '#3b82f6', size: 28, bold: true });
  drawText(ctx, 'Attention & Retention Tracker', 40, 75, { color: '#71717a', size: 14 });

  drawText(ctx, `${accuracy}%`, 40, 180, { color: '#fafafa', size: 72, bold: true });
  drawText(ctx, 'RETENTION ACCURACY', 40, 210, { color: '#71717a', size: 16 });

  drawText(ctx, `${streak}`, 40, 290, { color: '#fafafa', size: 48, bold: true });
  drawText(ctx, '🔥', 40 + ctx.measureText(`${streak}`).width + 10, 290, {
    color: '#f97316',
    size: 48,
  });
  drawText(ctx, 'CURRENT STREAK', 40, 320, { color: '#71717a', size: 16 });

  if (bestStreak > 0) {
    ctx.fillStyle = '#27272a';
    roundRect(ctx, WIDTH - 160, HEIGHT - 70, 120, 40, 8);
    ctx.fill();
    drawText(ctx, 'BEST', WIDTH - 145, HEIGHT - 45, { color: '#71717a', size: 12 });
    drawText(ctx, `${bestStreak} 🏆`, WIDTH - 100, HEIGHT - 45, {
      color: '#fafafa',
      size: 16,
      bold: true,
    });
  }

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 12);
  ctx.stroke();

  drawText(ctx, 'Testing attention on X/Twitter', 40, HEIGHT - 30, { color: '#52525b', size: 12 });

  return canvas.toDataURL('image/png');
}
