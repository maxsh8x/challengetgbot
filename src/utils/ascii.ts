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
