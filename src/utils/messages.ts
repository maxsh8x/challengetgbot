import { GameSession, Participant, Duel } from '../sessions';
import { GameResult } from '../storage';
import { TITLES } from '../constants';
import { Theme, getTheme, getDisplayEmoji } from '../themes';
import { Achievement } from '../achievements';
import { getDiff, getAbsDiff, getSizeEmoji, getRoast, formatDate, formatTimeLeft } from './game';
import { formatDays } from './game';
import { generateDick, generateJackpotBanner, generateSizeBar, generateMeter, generatePodium } from './ascii';

export function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mention(userId: number, firstName: string): string {
  return `<a href="tg://user?id=${userId}">${escapeHtml(firstName)}</a>`;
}

// ── Join message (per participant) ────────────────────────────────────────────

export function formatJoinMessage(p: Participant, target: number, theme: Theme, anonymous: boolean): string {
  if (anonymous) {
    return `🕵️ <b>Кто-то тайно замерился...</b>`;
  }

  const emoji  = getSizeEmoji(p.size, target, theme.maxValue - theme.minValue);
  const roast  = getRoast(p.size, target, theme.roasts);
  const bar    = generateSizeBar(p.size, target, theme);
  const meter  = generateMeter(p.size, target, theme);
  const isJackpot = p.size === target;

  const parts: string[] = [
    `👤 <b>${mention(p.userId, p.firstName)}</b>`,
    `${getDisplayEmoji(theme)} <b>${escapeHtml(p.funnyName)}</b> у меня <b>${p.size}${theme.unit}</b> ${emoji}`,
  ];

  if (theme.id === 'classic') parts.push('', `<code>${generateDick(p.size)}</code>`);
  parts.push(`<code>${bar}</code>`, meter, '', roast);

  if (isJackpot) {
    parts.unshift(`<pre>${generateJackpotBanner(theme)}</pre>`, '');
    parts.push('', `🎊🎊🎊 <b>ДЖЕКПОТ! ПРЯМО В ЯБЛОЧКО!</b> 🎊🎊🎊`);
  }

  return parts.join('\n');
}

// ── Active game message ───────────────────────────────────────────────────────

export function formatGameMessage(session: GameSession): string {
  const theme      = getTheme(session.themeId);
  const timeLeft   = session.deadline - Date.now();
  const deadlineStr = new Date(session.deadline).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const anonBadge  = session.anonymous ? ' 🕵️ <i>анонимный</i>' : '';

  const lines = [
    `${theme.emoji} <b>ГОЛОСОВАНИЕ: ${theme.name.toUpperCase()}</b>${anonBadge}`,
    '━━━━━━━━━━━━━━━━━━━━━',
    `🎯 Цель: <b>${session.target}${theme.unit}</b>`,
    `⏰ До конца: <b>${deadlineStr}</b> (осталось ${formatTimeLeft(timeLeft)})`,
    `👥 Участников: <b>${session.participants.length}</b>`,
    `🚀 Организатор: ${session.initiatorId ? mention(session.initiatorId, session.initiatorName) : escapeHtml(session.initiatorName)}`,
    '',
  ];

  if (session.participants.length > 0) {
    lines.push('<b>Уже сыграли:</b>');
    for (const p of session.participants) {
      if (session.anonymous) {
        lines.push(`• 🕵️ <i>участник засекречен</i>`);
      } else {
        const emoji = getSizeEmoji(p.size, session.target, theme.maxValue - theme.minValue);
        lines.push(`• ${mention(p.userId, p.firstName)} — ${p.size}${theme.unit} ${emoji}`);
      }
    }
    lines.push('');
  } else {
    lines.push('<i>Никто ещё не участвовал. Нажми кнопку!</i>', '');
  }

  return lines.join('\n');
}

// ── Game results ──────────────────────────────────────────────────────────────

export function formatGameResults(session: GameSession): string {
  const theme  = getTheme(session.themeId);
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

  // Sort ASC by absDiff: closest to target first (= loser at top), furthest last (= winner at bottom)
  const sorted = [...participants].sort((a, b) => getAbsDiff(a.size, target) - getAbsDiff(b.size, target));
  const loser  = sorted[0];

  const rows = sorted.slice(0, 3).map((p, i) => {
    const diff    = getDiff(p.size, target);
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    const badge   = i === 0 ? ' 💀' : '';
    return `${i + 1}. ${mention(p.userId, p.firstName)} — ${escapeHtml(p.funnyName)} <b>${p.size}${theme.unit}</b> (${diffStr}${theme.unit})${badge}`;
  });

  // Jackpot = loser landed exactly on target
  const isJackpot = getAbsDiff(loser.size, target) === 0;

  // Podium of losers: top 3 closest to target (ASC sort = sorted[0..2])
  const loserMedals = ['💀', '🥈', '🥉'];
  const podiumEntries = sorted.slice(0, 3).map((p, i) => ({
    name:  p.firstName.slice(0, 7),
    value: `${p.size}${theme.unit}`,
    medal: loserMedals[i] ?? '',
  }));

  const lines = [
    `🏁 <b>ГОЛОСОВАНИЕ ЗАВЕРШЕНО: ${theme.name} ${theme.emoji}</b>`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🎯 Цель была: <b>${target}${theme.unit}</b>`,
    `👥 Участников: <b>${participants.length}</b>`,
    '',
    ...rows,
    '',
  ];

  if (sorted.length >= 2) {
    lines.push(`<pre>${generatePodium(podiumEntries)}</pre>`, '');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (participants.length >= 2) {
    if (isJackpot) {
      lines.push(`🏆🎯 <b>ДЖЕКПОТ! ${mention(loser.userId, loser.firstName)} попал ТОЧНО В ЦЕЛЬ!</b> Готовь видос! 🎬`);
    } else {
      lines.push(`🏆 <b>Топ лузер:</b> ${mention(loser.userId, loser.firstName)} — готовь видос, братан! 🎬`);
    }
  }

  return lines.join('\n');
}

// ── Reminder ──────────────────────────────────────────────────────────────────

export function formatReminder(session: GameSession): string {
  const theme = getTheme(session.themeId);
  return [
    `⏰ <b>Осталось 5 минут!</b>`,
    `${theme.emoji} Тема: ${theme.name} | Цель: <b>${session.target}${theme.unit}</b>`,
    `👥 Уже участвуют: ${session.participants.length} чел.`,
    'Кто ещё не замерился — последний шанс! 🔥',
  ].join('\n');
}

// ── Achievements ──────────────────────────────────────────────────────────────

export function formatNewAchievements(userId: number, firstName: string, achievements: Achievement[]): string {
  if (achievements.length === 0) return '';
  const list = achievements.map((a) => `${a.emoji} <b>${a.name}</b> — ${a.description}`).join('\n');
  return [`🎖 <b>${mention(userId, firstName)}</b> получает достижения:`, list].join('\n');
}

export function formatAchievementsList(firstName: string, achievements: Achievement[]): string {
  if (achievements.length === 0) {
    return [`🎖 <b>Достижения: ${escapeHtml(firstName)}</b>`, '', 'Пока пусто. Играй чаще!'].join('\n');
  }
  const lines = [`🎖 <b>Достижения: ${escapeHtml(firstName)}</b> (${achievements.length})`, ''];
  for (const a of achievements) lines.push(`${a.emoji} <b>${a.name}</b>\n   <i>${a.description}</i>`);
  return lines.join('\n');
}

// ── Duel ──────────────────────────────────────────────────────────────────────

export function formatDuelChallenge(duel: Duel, theme: Theme): string {
  return [
    `⚔️ <b>ДУЭЛЬ!</b>`,
    '',
    `${mention(duel.challengerId, duel.challengerName)} вызывает ${mention(duel.challengedId, duel.challengedName)} на дуэль!`,
    `${theme.emoji} Тема: <b>${theme.name}</b>`,
    '',
    `⏱ На принятие — 5 минут.`,
  ].join('\n');
}

export function formatDuelResult(
  winner: Participant, loser: Participant, target: number, theme: Theme,
): string {
  const wDiff = getAbsDiff(winner.size, target);
  const lDiff = getAbsDiff(loser.size,  target);
  return [
    `⚔️ <b>ДУЭЛЬ ЗАВЕРШЕНА!</b>`,
    `${theme.emoji} Тема: ${theme.name} | Цель: <b>${target}${theme.unit}</b>`,
    '',
    `🏆 ${mention(winner.userId, winner.firstName)} — ${winner.funnyName} <b>${winner.size}${theme.unit}</b> (разница: ${wDiff}${theme.unit})`,
    `💀 ${mention(loser.userId,  loser.firstName)}  — ${loser.funnyName}  <b>${loser.size}${theme.unit}</b>  (разница: ${lDiff}${theme.unit})`,
    '',
    `👑 Победитель: ${mention(winner.userId, winner.firstName)}`,
    `🎬 ${mention(loser.userId, loser.firstName)} готовит видос!`,
  ].join('\n');
}

// ── History & champions ───────────────────────────────────────────────────────

export function formatHistory(results: GameResult[]): string {
  if (results.length === 0) {
    return ['📜 <b>История голосований</b>', '', 'Пока ничего нет. Запусти /new!'].join('\n');
  }
  const lines = ['📜 <b>ИСТОРИЯ ГОЛОСОВАНИЙ</b>', '━━━━━━━━━━━━━━━━━━━━━━━━━━━', ''];
  for (const r of results) {
    const anonTag = r.anonymous ? ' 🕵️' : '';
    lines.push(`${r.themeEmoji} <b>${formatDate(r.date)}</b>${anonTag} — ${r.themeName} | цель: ${r.target}${r.unit}`);
    if (r.winner) lines.push(`  🏆 ${mention(r.winner.userId, r.winner.firstName)} (${r.winner.size}${r.unit}, Δ${r.winner.diff}${r.unit})`);
    if (r.loser)  lines.push(`  💀 ${mention(r.loser.userId,  r.loser.firstName)} (готовил видос)`);
    lines.push(`  👥 ${r.participantCount} уч.`, '');
  }
  return lines.join('\n');
}

export function formatChampions(
  champions: Array<{ userId: number; firstName: string; wins: number; losses: number; games: number }>,
  period?: string,
): string {
  const title = period ? `ЗАЛ СЛАВЫ — ${period.toUpperCase()}` : 'ЗАЛ СЛАВЫ ЧАТА';
  if (champions.length === 0) {
    return [`🏆 <b>${title}</b>`, '', 'Нет данных. Сыграйте несколько партий!'].join('\n');
  }
  const medals = ['🥇', '🥈', '🥉'];
  const lines  = [`🏆 <b>${title}</b>`, '━━━━━━━━━━━━━━━━━━━━━━━━━━━', ''];
  champions.forEach((c, i) => {
    lines.push(
      `${medals[i] ?? `${i + 1}.`} ${mention(c.userId, c.firstName)} — ${getTitle(c.wins)}`,
      `   🏆 Побед: ${c.wins} | 💀 Лузеров: ${c.losses} | 🎲 Игр: ${c.games}`,
      '',
    );
  });
  const top = [...champions].sort((a, b) => b.losses - a.losses)[0];
  if (top?.losses > 0) {
    lines.push(`😈 <b>Постоянный лузер:</b> ${mention(top.userId, top.firstName)} (${top.losses} видосов)`);
  }
  return lines.join('\n');
}

// ── Compare ───────────────────────────────────────────────────────────────────

export function formatCompare(
  u1: { firstName: string; userId: number; wins: number; losses: number; games: number; streak: { wins: number; losses: number } },
  u2: { firstName: string; userId: number; wins: number; losses: number; games: number; streak: { wins: number; losses: number } },
): string {
  const row = (label: string, v1: string | number, v2: string | number) => {
    const w = String(v1).length > String(v2).length ? '←' : String(v1).length < String(v2).length ? '→' : '═';
    return `${label}: <b>${v1}</b> ${w} <b>${v2}</b>`;
  };
  return [
    `⚖️ <b>СРАВНЕНИЕ</b>`,
    `${mention(u1.userId, u1.firstName)} vs ${mention(u2.userId, u2.firstName)}`,
    '━━━━━━━━━━━━━━━━━━━━━',
    row('🏆 Побед',       u1.wins,   u2.wins),
    row('💀 Лузеров',     u1.losses, u2.losses),
    row('🎲 Игр',         u1.games,  u2.games),
    row('🔥 Стрик побед', u1.streak.wins,   u2.streak.wins),
    row('💀 Стрик лузов', u1.streak.losses, u2.streak.losses),
  ].join('\n');
}

// ── Stats & misc ──────────────────────────────────────────────────────────────

export function formatStats(
  userId: number,
  firstName: string,
  stats: { totalPlays: number; wins: number; bestDiff: number | null },
  streak: { wins: number; losses: number },
  achievementCount: number,
): string {
  const title   = getTitle(stats.wins);
  const winRate = stats.totalPlays > 0 ? Math.round((stats.wins / stats.totalPlays) * 100) : 0;
  const streakLine = streak.wins > 0
    ? `🔥 Стрик побед: <b>${streak.wins}</b>`
    : streak.losses > 0
      ? `💀 Стрик лузов: <b>${streak.losses}</b>`
      : `➖ Нет стрика`;

  return [
    `📈 <b>Статистика: ${mention(userId, firstName)}</b>`,
    `🎖 Звание: ${title}`,
    `🏅 Достижений: <b>${achievementCount}</b>`,
    '━━━━━━━━━━━━━━━━━━',
    `🎲 Всего игр: <b>${stats.totalPlays}</b>`,
    `🏆 Побед: <b>${stats.wins}</b>`,
    `📊 Процент: <b>${winRate}%</b>`,
    streakLine,
    stats.bestDiff !== null
      ? `🎯 Лучший результат: <b>${stats.bestDiff} от цели</b>${stats.bestDiff === 0 ? ' ⚡ Джекпот!' : ''}`
      : '❌ Нет результатов',
  ].join('\n');
}

export function formatNoActiveGame(): string {
  return ['😴 Нет активного голосования.', '', 'Запусти: /new или /new 30'].join('\n');
}

export function formatScheduleInfo(schedule: import('../storage').ChatSchedule | undefined): string {
  if (!schedule || !schedule.enabled) {
    return [
      '📅 <b>Авторасписание</b>', '',
      'Не настроено.', '',
      '/schedule 15:00 — каждый день в 15:00 МСК',
      '/schedule 15:00 пн пт — только по понедельникам и пятницам',
      '/schedule 15:00 будни — рабочие дни',
    ].join('\n');
  }
  const theme   = getTheme(schedule.themeId);
  const daysStr = formatDays(schedule.days ?? []);
  return [
    '📅 <b>Авторасписание</b>',
    '',
    `⏰ Время: <b>${schedule.time} МСК</b>`,
    `📆 Дни: <b>${daysStr}</b>`,
    `${theme.emoji} Тема: <b>${theme.name}</b>`,
    `⏱ Длительность: <b>${schedule.duration} мин</b>`,
    `🕵️ Анонимный: <b>${schedule.anonymous ? 'да' : 'нет'}</b>`,
    '',
    '/unschedule — отключить',
  ].join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTitle(wins: number): string {
  const sorted = [...TITLES].sort((a, b) => b.minWins - a.minWins);
  for (const t of sorted) if (wins >= t.minWins) return t.title;
  return TITLES[0].title;
}
