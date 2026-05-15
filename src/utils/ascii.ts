import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import { getDiff } from './game';
import { Theme } from '../themes';

export function generateDick(size: number): string {
  const n = Math.max(1, Math.min(22, Math.round(size * 0.85)));
  return `8${'='.repeat(n)}D`;
}

export function generateJackpotBanner(theme: Theme): string {
  const line = `  ${theme.emoji} ДЖЕКПОТ! ${theme.emoji}  `;
  const border = '═'.repeat(line.length);
  return [`╔${border}╗`, `║${line}║`, `╚${border}╝`].join('\n');
}

export function generateSizeBar(size: number, target: number, theme: Theme): string {
  const total = 20;
  const range = theme.maxValue - theme.minValue;
  const pos    = Math.round(((size   - theme.minValue) / range) * total);
  const tPos   = Math.round(((target - theme.minValue) / range) * total);

  let bar = '';
  for (let i = 0; i <= total; i++) {
    if (i === pos && i === tPos) bar += '★';
    else if (i === pos)          bar += '▲';
    else if (i === tPos)         bar += '🎯';
    else                         bar += '─';
  }
  return `${theme.minValue}${theme.unit} ${bar} ${theme.maxValue}${theme.unit}`;
}

export function generateMeter(size: number, target: number, theme: Theme): string {
  const diff    = getDiff(size, target);
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
  const arrow   = diff > 0 ? '→' : diff < 0 ? '←' : '✓';
  return `📏 ${size}${theme.unit} ${arrow} цель ${target}${theme.unit} (${diffStr}${theme.unit})`;
}

// ── PNG Podium ────────────────────────────────────────────────────────────────

export function generatePodiumImage(
  entries: Array<{ name: string; value: string }>,
): Buffer {
  const W = 580, H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f0c29');
  bg.addColorStop(1, '#302b63');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ПОДИУМ ЛУЗЕРОВ', W / 2, 48);

  // Title underline
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 130, 60);
  ctx.lineTo(W / 2 + 130, 60);
  ctx.stroke();

  const [first, second, third] = entries;
  const baseY = 345;
  const colW  = 150;

  // Layout: left=2nd, center=1st(loser), right=3rd
  const cols = [
    { entry: second, cx: W / 2 - colW - 15, blockH: 155, color: '#7f8c8d', rank: '#2' },
    { entry: first,  cx: W / 2,              blockH: 235, color: '#e74c3c', rank: '#1' },
    { entry: third,  cx: W / 2 + colW + 15,  blockH: 75,  color: '#d4845a', rank: '#3' },
  ];

  for (const { entry, cx, blockH, color, rank } of cols) {
    const bx = cx - colW / 2;
    const by = baseY - blockH;

    // Block body
    roundRect(ctx, bx, by, colW, blockH, 8);
    ctx.fillStyle = color;
    ctx.fill();

    // Top highlight
    const hi = ctx.createLinearGradient(bx, by, bx, by + blockH);
    hi.addColorStop(0, 'rgba(255,255,255,0.18)');
    hi.addColorStop(0.5, 'rgba(255,255,255,0)');
    roundRect(ctx, bx, by, colW, blockH, 8);
    ctx.fillStyle = hi;
    ctx.fill();

    // Rank number inside block
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font = `bold 52px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rank, cx, baseY - blockH / 2 + 18);

    // Name above block (truncate long names)
    const name = (entry?.name ?? '').slice(0, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, by - 12);

    // Value below base
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entry?.value ?? '', cx, baseY + 26);
  }

  // Base platform
  const plat = ctx.createLinearGradient(0, baseY, 0, baseY + 8);
  plat.addColorStop(0, '#555');
  plat.addColorStop(1, '#333');
  roundRect(ctx, 30, baseY, W - 60, 8, 4);
  ctx.fillStyle = plat;
  ctx.fill();

  return canvas.toBuffer('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function generatePodium(
  entries: Array<{ name: string; value: string; medal: string }>,
): string {
  if (entries.length === 0) return '';

  const [first, second, third] = entries;
  const BLOCK = '████████';
  const BLANK = '        ';

  // Columns: left=2nd(h=2), center=1st(h=3), right=3rd(h=1)
  const cols = [
    { entry: second, height: 2 },
    { entry: first,  height: 3 },
    { entry: third,  height: 1 },
  ].map(({ entry, height }) => {
    const name  = (entry?.name  ?? '').slice(0, 8).padEnd(8);
    const medal = (entry?.medal ?? '').padEnd(8);
    // Column lines from top: name, medal, then blocks
    return [name, medal, ...Array(height).fill(BLOCK)];
  });

  const maxH = 3;
  // Each column is padded at the top so all bases align at the same row
  const padded = cols.map((col, i) => {
    const pad = maxH - [2, 3, 1][i]; // spaces to prepend
    return [...Array(pad).fill(BLANK), ...col];
  });

  const totalRows = maxH + 2; // name + medal + blocks
  const lines: string[] = [];
  for (let r = 0; r < totalRows; r++) {
    lines.push(`${padded[0][r]}  ${padded[1][r]}  ${padded[2][r]}`);
  }

  // Values at the base
  const v1 = (second?.value ?? '').slice(0, 8).padEnd(8);
  const v2 = first.value.slice(0, 8).padEnd(8);
  const v3 = (third?.value  ?? '').slice(0, 8).padEnd(8);
  lines.push(`${v1}  ${v2}  ${v3}`);

  return lines.join('\n');
}
