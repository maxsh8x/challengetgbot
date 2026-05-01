import { Theme, ThemeRoasts } from '../themes';

export function getRandomTarget(theme: Theme): number {
  return (
    Math.floor(Math.random() * (theme.targetMax - theme.targetMin + 1)) + theme.targetMin
  );
}

export function getRandomSize(theme: Theme): number {
  let size: number;
  const mid = (theme.targetMin + theme.targetMax) / 2;
  const spread = (theme.maxValue - theme.minValue) / 4;
  do {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    size = Math.round(mid + spread * z);
  } while (size < theme.minValue || size > theme.maxValue);
  return size;
}

export function getRandomName(theme: Theme): string {
  const names = theme.objectNames;
  return names[Math.floor(Math.random() * names.length)];
}

export function getDiff(size: number, target: number): number {
  return size - target;
}

export function getAbsDiff(size: number, target: number): number {
  return Math.abs(getDiff(size, target));
}

export function getSizeEmoji(size: number, target: number, range = 25): string {
  const diff = getDiff(size, target);
  const rel = diff / range; // signed, normalized to theme range

  if (diff === 0)       return pickRandom(['🏆', '👑', '⚡', '🌟', '🎊', '🔥']);
  if (Math.abs(rel) <= 0.04) return pickRandom(['🎯', '😮', '💨', '🤏', '😲']);
  if (rel > 0.30)       return pickRandom(['🚀', '😱', '💥', '🛸', '🐘', '🤯']);
  if (rel > 0.14)       return pickRandom(['😁', '💪', '😈', '🤘', '👀', '🥴']);
  if (rel > 0)          return pickRandom(['😏', '😎', '🙃', '😌', '🫣', '😼']);
  if (rel < -0.30)      return pickRandom(['😭', '💔', '☠️', '🫥', '🥶', '😵']);
  if (rel < -0.14)      return pickRandom(['😢', '😔', '🥺', '😿', '😰', '😓']);
  return                       pickRandom(['😞', '😬', '🤦', '😟', '🙁', '😒']);
}

export function getRoast(size: number, target: number, roasts: ThemeRoasts): string {
  const diff = getDiff(size, target);
  const absDiff = Math.abs(diff);
  if (diff === 0) return pickRandom(roasts.jackpot);
  if (absDiff <= 1) return pickRandom(roasts.veryClose);
  if (diff > target * 0.6) return pickRandom(roasts.huge);
  if (diff > target * 0.25) return pickRandom(roasts.big);
  if (diff > 0) return pickRandom(roasts.slightlyAbove);
  if (absDiff <= target * 0.15) return pickRandom(roasts.slightlyBelow);
  if (absDiff <= target * 0.4) return pickRandom(roasts.small);
  return pickRandom(roasts.tiny);
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]}`;
}

export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'время вышло';
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) return `${seconds}с`;
  return `${minutes}м ${seconds.toString().padStart(2, '0')}с`;
}
