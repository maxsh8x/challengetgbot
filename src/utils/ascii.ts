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

  // Build column strings (name on top of podium block)
  const col = (label: string, height: number, medal: string) => {
    const nameRow   = label.slice(0, 8).padEnd(8);
    const medalRow  = medal.padEnd(8);
    const block     = '████████';
    return { nameRow, medalRow, block, height };
  };

  const c1 = col(second?.name ?? '',  2, second?.medal ?? '');
  const c2 = col(first.name,          3, first.medal);
  const c3 = col(third?.name  ?? '',  1, third?.medal  ?? '');

  const maxH = 3;
  const lines: string[] = [];

  // Name row
  lines.push(`${c1.nameRow}  ${c2.nameRow}  ${c3.nameRow}`);
  // Medal row
  lines.push(`${c1.medalRow}  ${c2.medalRow}  ${c3.medalRow}`);

  // Podium blocks (tallest = 3 rows)
  for (let row = maxH; row >= 1; row--) {
    const p1 = row <= c1.height ? c1.block : ' '.repeat(8);
    const p2 = row <= c2.height ? c2.block : ' '.repeat(8);
    const p3 = row <= c3.height ? c3.block : ' '.repeat(8);
    lines.push(`${p1}  ${p2}  ${p3}`);
  }

  // Values below podium
  const v1 = (second?.value ?? '').slice(0, 8).padEnd(8);
  const v2 = first.value.slice(0, 8).padEnd(8);
  const v3 = (third?.value  ?? '').slice(0, 8).padEnd(8);
  lines.push(`${v1}  ${v2}  ${v3}`);

  return lines.join('\n');
}
