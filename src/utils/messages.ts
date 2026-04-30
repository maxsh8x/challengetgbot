import { GameSession, Participant } from '../sessions';
import { GameResult } from '../storage';
import { TITLES } from '../constants';
import { Theme, getTheme } from '../themes';
import { getDiff, getAbsDiff, getSizeEmoji, getRoast, formatDate, formatTimeLeft } from './game';
import { generateDick, generateJackpotBanner, generateSizeBar, generateMeter } from './ascii';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mention(userId: number, firstName: string): string {
  return `<a href="tg://user?id=${userId}">${escapeHtml(firstName)}</a>`;
}

export function formatJoinMessage(p: Participant, target: number, theme: Theme): string {
  const emoji = getSizeEmoji(p.size, target);
  const roast = getRoast(p.size, target, theme.roasts);
  const bar = generateSizeBar(p.size, target, theme);
  const meter = generateMeter(p.size, target, theme);
  const isJackpot = p.size === target;

  const parts: string[] = [
    `👤 <b>${mention(p.userId, p.firstName)}</b>`,
    `${theme.emoji} <b>${escapeHtml(p.funnyName)}</b> у меня <b>${p.size}${theme.unit}</b> ${emoji}`,
  ];

  if (theme.id === 'classic') {
    parts.push('', `<code>${generateDick(p.size)}</code>`);
  }

  parts.push(`<code>${bar}</code>`, meter, '', roast);

  if (isJackpot) {
    parts.unshift(`<pre>${generateJackpotBanner(theme)}</pre>`, '');
    parts.push('', `🎊🎊🎊 <b>ДЖЕКПОТ! ПРЯМО В ЯБЛОЧКО!</b> 🎊🎊🎊`);
  }

  return parts.join('\n');
}

export function formatGameMessage(session: GameSession): string {
  const theme = getTheme(session.themeId);
  const timeLeft = session.deadline - Date.now();
  const deadlineStr = new Date(session.deadline).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = [
    `${theme.emoji} <b>ГОЛОСОВАНИЕ: ${theme.name.toUpperCase()}</b>`,
    '━━━━━━━━━━━━━━━━━━━━━',
    `🎯 Цель: <b>${session.target}${theme.unit}</b>`,
    `⏰ До конца: <b>${deadlineStr}</b> (осталось ${formatTimeLeft(timeLeft)})`,
    `👥 Участников: <b>${session.participants.length}</b>`,
    `🚀 Организатор: ${mention(session.initiatorId, session.initiatorName)}`,
    '',
  ];

  if (session.participants.length > 0) {
    lines.push('<b>Уже сыграли:</b>');
    for (const p of session.participants) {
      const emoji = getSizeEmoji(p.size, session.target);
      lines.push(`• ${mention(p.userId, p.firstName)} — ${p.size}${theme.unit} ${emoji}`);
    }
    lines.push('');
  } else {
    lines.push('<i>Никто ещё не участвовал. Нажми кнопку!</i>', '');
  }

  return lines.join('\n');
}

export function formatGameResults(session: GameSession): string {
  const theme = getTheme(session.themeId);
  const { participants, target } = session;

  if (participants.length === 0) {
    return [
      `🏁 <b>ГОЛОСОВАНИЕ ЗАВЕРШЕНО: ${theme.name}</b>`,
      '',
      `🎯 Цель была: <b>${target}${theme.unit}</b>`,
      '',
      '😴 Никто так и не сыграл. Стесняшки...',
    ].join('\n');
  }

  const sorted = [...participants].sort(
    (a, b) => getAbsDiff(a.size, target) - getAbsDiff(b.size, target),
  );
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];
  const medals = ['🥇', '🥈', '🥉'];

  const rows = sorted.map((p, i) => {
    const medal = medals[i] ?? `${i + 1}.`;
    const diff = getDiff(p.size, target);
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    const crown = i === 0 ? ' 👑' : '';
    return `${medal} ${mention(p.userId, p.firstName)} — ${escapeHtml(p.funnyName)} <b>${p.size}${theme.unit}</b> (${diffStr}${theme.unit})${crown}`;
  });

  const isJackpot = getAbsDiff(winner.size, target) === 0;

  const lines = [
    `🏁 <b>ГОЛОСОВАНИЕ ЗАВЕРШЕНО: ${theme.name} ${theme.emoji}</b>`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🎯 Цель была: <b>${target}${theme.unit}</b>`,
    `👥 Участников: <b>${participants.length}</b>`,
    '',
    ...rows,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  if (isJackpot) {
    lines.push(`${theme.emoji}🎊 <b>ДЖЕКПОТ! ${mention(winner.userId, winner.firstName)} попал ТОЧНО В ЦЕЛЬ!</b>`);
  } else {
    lines.push(`🏆 <b>Победитель:</b> ${mention(winner.userId, winner.firstName)} — ${winner.size}${theme.unit} (ближе всех!)`);
  }

  if (participants.length >= 2) {
    lines.push(`💀 <b>Лузер:</b> ${mention(loser.userId, loser.firstName)} — готовь видос, братан! 🎬`);
  }

  return lines.join('\n');
}

export function formatHistory(results: GameResult[]): string {
  if (results.length === 0) {
    return [
      '📜 <b>История голосований</b>',
      '',
      'Пока ни одного завершённого голосования в этом чате.',
      'Запусти первое: /new',
    ].join('\n');
  }

  const lines = [
    '📜 <b>ИСТОРИЯ ГОЛОСОВАНИЙ</b>',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  for (const r of results) {
    const date = formatDate(r.date);
    lines.push(`${r.themeEmoji} <b>${date}</b> — ${r.themeName} | цель: ${r.target}${r.unit}`);
    if (r.winner) {
      lines.push(`  🏆 Победитель: ${mention(r.winner.userId, r.winner.firstName)} (${r.winner.size}${r.unit}, разница: ${r.winner.diff}${r.unit})`);
    }
    if (r.loser) {
      lines.push(`  💀 Лузер: ${mention(r.loser.userId, r.loser.firstName)} (готовил видос)`);
    }
    lines.push(`  👥 Участников: ${r.participantCount}`, '');
  }

  return lines.join('\n');
}

export function formatChampions(
  champions: Array<{ userId: number; firstName: string; wins: number; losses: number; games: number }>,
): string {
  if (champions.length === 0) {
    return [
      '🏆 <b>Зал славы</b>',
      '',
      'Пока нет данных. Сыграйте несколько партий!',
    ].join('\n');
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = [
    '🏆 <b>ЗАЛ СЛАВЫ ЧАТА</b>',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  champions.forEach((c, i) => {
    const medal = medals[i] ?? `${i + 1}.`;
    const title = getTitle(c.wins);
    lines.push(
      `${medal} ${mention(c.userId, c.firstName)} — ${title}`,
      `   🏆 Побед: ${c.wins} | 💀 Лузеров: ${c.losses} | 🎲 Игр: ${c.games}`,
      '',
    );
  });

  const mostLosses = [...champions].sort((a, b) => b.losses - a.losses)[0];
  if (mostLosses && mostLosses.losses > 0) {
    lines.push(`😈 <b>Постоянный лузер чата:</b> ${mention(mostLosses.userId, mostLosses.firstName)} (${mostLosses.losses} видосов наготовил)`);
  }

  return lines.join('\n');
}

export function formatStats(
  firstName: string,
  stats: { totalPlays: number; wins: number; bestDiff: number | null },
): string {
  const title = getTitle(stats.wins);
  const winRate = stats.totalPlays > 0
    ? Math.round((stats.wins / stats.totalPlays) * 100)
    : 0;

  const lines = [
    `📈 <b>Статистика: ${escapeHtml(firstName)}</b>`,
    `🎖 Звание: ${title}`,
    '━━━━━━━━━━━━━━━━━━',
    `🎲 Всего замеров: <b>${stats.totalPlays}</b>`,
    `🏆 Побед: <b>${stats.wins}</b>`,
    `📊 Процент побед: <b>${winRate}%</b>`,
  ];

  if (stats.bestDiff !== null) {
    lines.push(`🎯 Лучший результат: <b>${stats.bestDiff} от цели</b>`);
    if (stats.bestDiff === 0) lines.push('⚡ Был ДЖЕКПОТ! Легенда!');
  } else {
    lines.push('❌ Ещё нет результатов');
  }

  return lines.join('\n');
}

export function formatNoActiveGame(): string {
  return ['😴 Нет активного голосования.', '', 'Запусти новое: /new или /new 30'].join('\n');
}

function getTitle(wins: number): string {
  const sorted = [...TITLES].sort((a, b) => b.minWins - a.minWins);
  for (const t of sorted) {
    if (wins >= t.minWins) return t.title;
  }
  return TITLES[0].title;
}
