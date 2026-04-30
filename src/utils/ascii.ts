import { getDiff } from './game';
import { Theme } from '../themes';

export function generateDick(size: number): string {
  const shaftLen = Math.max(1, Math.min(22, Math.round(size * 0.85)));
  return `8${'='.repeat(shaftLen)}D`;
}

export function generateJackpotBanner(theme: Theme): string {
  const line = `  ${theme.emoji} ДЖЕКПОТ! ${theme.emoji}  `;
  const border = '═'.repeat(line.length);
  return [`╔${border}╗`, `║${line}║`, `╚${border}╝`].join('\n');
}

export function generateSizeBar(size: number, target: number, theme: Theme): string {
  const total = 20;
  const range = theme.maxValue - theme.minValue;
  const pos = Math.round(((size - theme.minValue) / range) * total);
  const targetPos = Math.round(((target - theme.minValue) / range) * total);

  let bar = '';
  for (let i = 0; i <= total; i++) {
    if (i === pos && i === targetPos) bar += '★';
    else if (i === pos) bar += '▲';
    else if (i === targetPos) bar += '🎯';
    else bar += '─';
  }
  return `${theme.minValue}${theme.unit} ${bar} ${theme.maxValue}${theme.unit}`;
}

export function generateMeter(size: number, target: number, theme: Theme): string {
  const diff = getDiff(size, target);
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
  const arrow = diff > 0 ? '→' : diff < 0 ? '←' : '✓';
  return `📏 ${size}${theme.unit} ${arrow} цель ${target}${theme.unit} (${diffStr}${theme.unit})`;
}
