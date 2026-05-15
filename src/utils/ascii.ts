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
  const W = 640, H = 480;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, '#07071a');
  bg.addColorStop(0.5, '#0d0824');
  bg.addColorStop(1, '#13052e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Star field (fixed positions for consistency)
  const stars = [
    [45,18,1.5],[130,38,1],[220,12,2],[310,30,1],[420,8,1.5],[510,22,1],[590,40,2],
    [75,65,1],[180,55,1.5],[360,48,1],[470,70,1],[560,15,1],[605,58,1.5],
    [30,90,1],[250,80,1],[400,95,2],[540,82,1],[620,75,1],
  ] as [number,number,number][];
  stars.forEach(([sx, sy, r]) => {
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Title ───────────────────────────────────────────────────────────────────
  ctx.shadowColor = '#e74c3c';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ПОДИУМ ЛУЗЕРОВ', W / 2, 56);
  ctx.shadowBlur = 0;

  // Fading line left/right of title
  (['left', 'right'] as const).forEach((side) => {
    const x0 = side === 'left' ? W / 2 - 155 : W / 2 + 20;
    const x1 = side === 'left' ? W / 2 - 20  : W / 2 + 155;
    const lg = ctx.createLinearGradient(x0, 0, x1, 0);
    lg.addColorStop(0, side === 'left' ? 'transparent' : '#e74c3c');
    lg.addColorStop(1, side === 'left' ? '#e74c3c' : 'transparent');
    ctx.strokeStyle = lg;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, 66);
    ctx.lineTo(x1, 66);
    ctx.stroke();
  });

  // ── Podium columns ──────────────────────────────────────────────────────────
  const [first, second, third] = entries;
  const baseY = 395;
  const colW  = 158;

  const cols = [
    {
      entry: second, cx: 148, blockH: 183,
      c0: '#b2bec3', c1: '#778ca3', c2: '#4a6278',
      glow: 'rgba(100,140,180,0.35)',
      rank: '2',
    },
    {
      entry: first,  cx: 320, blockH: 273,
      c0: '#ff8a80', c1: '#e74c3c', c2: '#8b0000',
      glow: 'rgba(220,50,30,0.55)',
      rank: '1',
    },
    {
      entry: third,  cx: 492, blockH: 95,
      c0: '#ffcc80', c1: '#d4845a', c2: '#7b3a10',
      glow: 'rgba(200,120,60,0.30)',
      rank: '3',
    },
  ];

  // Draw spotlights first (behind blocks)
  cols.forEach(({ cx, blockH, glow }) => {
    const by = baseY - blockH;
    const spot = ctx.createRadialGradient(cx, baseY + 8, 5, cx, by + blockH * 0.6, colW * 1.1);
    spot.addColorStop(0, glow);
    spot.addColorStop(1, 'transparent');
    ctx.fillStyle = spot;
    ctx.fillRect(cx - colW, by - 20, colW * 2, blockH + 40);
  });

  cols.forEach(({ entry, cx, blockH, c0, c1, c2, rank }) => {
    const bx = cx - colW / 2;
    const by = baseY - blockH;

    // Main block gradient (top-light, mid-main, bottom-dark)
    const bGrad = ctx.createLinearGradient(bx, by, bx, by + blockH);
    bGrad.addColorStop(0,   c0);
    bGrad.addColorStop(0.35, c1);
    bGrad.addColorStop(1,   c2);
    roundRect(ctx, bx, by, colW, blockH, 10);
    ctx.fillStyle = bGrad;
    ctx.fill();

    // Left-side 3D sheen
    const sheen = ctx.createLinearGradient(bx, 0, bx + colW * 0.55, 0);
    sheen.addColorStop(0,    'rgba(255,255,255,0.22)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    sheen.addColorStop(1,    'transparent');
    roundRect(ctx, bx, by, colW, blockH, 10);
    ctx.fillStyle = sheen;
    ctx.fill();

    // Top ledge highlight
    const ledge = ctx.createLinearGradient(bx, by, bx, by + 14);
    ledge.addColorStop(0, 'rgba(255,255,255,0.55)');
    ledge.addColorStop(1, 'rgba(255,255,255,0)');
    roundRect(ctx, bx - 4, by, colW + 8, 14, 5);
    ctx.fillStyle = ledge;
    ctx.fill();

    // Subtle border
    roundRect(ctx, bx, by, colW, blockH, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Big rank inside (faded)
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`#${rank}`, cx, baseY - blockH / 2 + 28);

    // Name above block with drop shadow
    const name = (entry?.name ?? '').slice(0, 16);
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, by - 16);
    ctx.shadowBlur = 0;

    // Value below platform
    ctx.fillStyle = '#8a9bae';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entry?.value ?? '', cx, baseY + 30);
  });

  // ── Platform ────────────────────────────────────────────────────────────────
  // Platform body
  const platBody = ctx.createLinearGradient(0, baseY, 0, baseY + 12);
  platBody.addColorStop(0, '#4a4a5a');
  platBody.addColorStop(1, '#20202e');
  roundRect(ctx, 18, baseY, W - 36, 12, 6);
  ctx.fillStyle = platBody;
  ctx.fill();

  // Platform top shine
  const platShine = ctx.createLinearGradient(18, baseY, W - 18, baseY);
  platShine.addColorStop(0,   'transparent');
  platShine.addColorStop(0.2, 'rgba(255,255,255,0.18)');
  platShine.addColorStop(0.8, 'rgba(255,255,255,0.18)');
  platShine.addColorStop(1,   'transparent');
  roundRect(ctx, 18, baseY, W - 36, 4, 3);
  ctx.fillStyle = platShine;
  ctx.fill();

  // Subtle block reflections on platform
  cols.forEach(({ cx, c1 }) => {
    ctx.save();
    ctx.globalAlpha = 0.12;
    const refGrad = ctx.createLinearGradient(0, baseY + 12, 0, baseY + 45);
    refGrad.addColorStop(0, c1);
    refGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = refGrad;
    ctx.fillRect(cx - colW / 2, baseY + 12, colW, 33);
    ctx.restore();
  });

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
