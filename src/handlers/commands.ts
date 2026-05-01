import { Context, Telegram } from 'telegraf';
import { storage, GameResult, ChatSchedule } from '../storage';
import { sessionManager, duelManager, GameSession, Duel } from '../sessions';
import { scheduler } from '../scheduler';
import {
  formatGameMessage,
  formatGameResults,
  formatHistory,
  formatChampions,
  formatStats,
  formatNoActiveGame,
  formatScheduleInfo,
  formatCompare,
  formatDuelChallenge,
  formatDuelResult,
  formatNewAchievements,
  formatAchievementsList,
  escapeHtml,
  mention,
} from '../utils/messages';
import {
  getRandomTarget,
  getRandomSize,
  getRandomName,
  getToday,
  generateId,
  getAbsDiff,
} from '../utils/game';
import { THEME_LIST, getTheme } from '../themes';
import { DEFAULT_DURATION_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES } from '../constants';
import { checkAchievements, ACHIEVEMENT_LIST } from '../achievements';

export async function handleStart(ctx: Context): Promise<void> {
  const name = ctx.from?.first_name ?? 'друг';
  const text = [
    `👋 <b>Привет, ${escapeHtml(name)}!</b>`,
    '',
    'Я определяю, кто готовит видео на пятницу — методом случайного замера.',
    'Победитель ближе всего к цели. Лузер снимает видос. 🎬',
    '',
    'Добавь меня в групповой чат и запусти /new.',
    '',
    '/help — список команд',
  ].join('\n');

  await ctx.reply(text, { parse_mode: 'HTML' });
}

const COMMAND_HELP: Record<string, string> = {
  new: [
    '🎲 <b>/new</b> — запустить голосование',
    '',
    'Бот предложит выбрать тему, затем все участники жмут «Участвовать!».',
    'По истечении времени объявляется победитель (ближайший к цели) и лузер.',
    '',
    '<b>Опции:</b>',
    '/new 60 — длительность 60 минут (по умолчанию 30)',
    '/new anon — анонимный режим (размеры скрыты до конца)',
    '/new 45 anon — комбинировать',
    '',
    `Мин. ${MIN_DURATION_MINUTES} мин, макс. ${MAX_DURATION_MINUTES} мин.`,
  ].join('\n'),

  end: [
    '🏁 <b>/end</b> — завершить голосование досрочно',
    '',
    'Доступно только организатору (тому, кто запустил /new).',
    'Результаты объявляются немедленно.',
  ].join('\n'),

  results: [
    '📊 <b>/results</b> — текущее голосование',
    '',
    'Показывает активное голосование: тему, цель, время и список участников.',
    'Можно присоединиться прямо из сообщения.',
  ].join('\n'),

  top: [
    '🏆 <b>/top</b> — зал славы чата',
    '',
    '/top — за всё время',
    '/top week — за последние 7 дней',
    '/top month — за последние 30 дней',
  ].join('\n'),

  stats: [
    '📈 <b>/stats</b> — твоя статистика',
    '',
    'Показывает: всего игр, побед, процент, текущий стрик и количество достижений.',
  ].join('\n'),

  achievements: [
    '🎖 <b>/achievements</b> — твои достижения',
    '',
    'Достижения выдаются автоматически за особые результаты:',
    '💥 Джекпот — попасть точно в цель',
    '🎯 Снайпер — промах ≤ 1 от цели',
    '🔥 Хет-трик — 3 победы подряд',
    '⚡ Непобедимый — 5 побед подряд',
    '💀 Мальчик для битья — 3 поражения подряд',
    '😈 Вечный лузер — 5 поражений подряд',
    '🎖 Ветеран — 10 игр в чате',
    '⚔️ Дуэлянт — победить в дуэли',
    '🕵️ Инкогнито — победить в анонимном режиме',
  ].join('\n'),

  duel: [
    '⚔️ <b>/duel @username</b> — вызвать на дуэль',
    '',
    'Противник получает 5 минут на принятие вызова.',
    'Если принимает — оба получают случайный результат, победитель определяется автоматически.',
    '',
    'Пользователь должен был хотя бы раз поиграть в чате.',
  ].join('\n'),

  compare: [
    '⚖️ <b>/compare @username</b> — сравнить статистику',
    '',
    'Показывает таблицу: победы, поражения, игры и стрики двух игроков.',
    'Пользователь должен был хотя бы раз поиграть в чате.',
  ].join('\n'),

  history: [
    '📜 <b>/history</b> — история голосований',
    '',
    'Последние 10 завершённых голосований в этом чате: тема, цель, победитель, лузер.',
  ].join('\n'),

  champions: [
    '🥇 <b>/champions</b> — зал славы чата (за всё время)',
    '',
    'Рейтинг по победам. Внизу — самый частый лузер.',
    'Для периода используй /top week или /top month.',
  ].join('\n'),

  schedule: [
    '📅 <b>/schedule</b> — автозапуск голосования',
    '',
    '<b>Просмотр текущего расписания:</b>',
    '/schedule',
    '',
    '<b>Установить:</b>',
    '/schedule 15:00 — каждый день в 15:00 UTC',
    '/schedule 15:00 пн пт — по понедельникам и пятницам',
    '/schedule 15:00 будни — пн–пт',
    '/schedule 15:00 выходные — сб и вс',
    '',
    '<b>Дополнительные опции:</b>',
    '/schedule 15:00 пт pizza — тема пицца',
    '/schedule 15:00 пт 45 — длительность 45 мин',
    '/schedule 15:00 пт anon — анонимный режим',
    '',
    'Время всегда UTC. Список тем: classic, pizza, iq, beer, salary, bench, temp.',
    '/unschedule — отключить расписание.',
  ].join('\n'),
};

export async function handleHelp(ctx: Context): Promise<void> {
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const arg  = text.trim().split(/\s+/)[1]?.toLowerCase().replace(/^\//, '');

  if (arg && arg in COMMAND_HELP) {
    await ctx.reply(COMMAND_HELP[arg], { parse_mode: 'HTML' });
    return;
  }

  const overview = [
    '📖 <b>Команды</b>',
    '',
    '<b>Игра</b>',
    '/new — запустить голосование',
    '/end — завершить досрочно',
    '/results — текущее голосование',
    '',
    '<b>Статистика</b>',
    '/top — зал славы чата',
    '/history — история голосований',
    '/stats — твоя статистика',
    '/achievements — твои достижения',
    '/compare @user — сравнение с игроком',
    '',
    '<b>Дополнительно</b>',
    '/duel @user — вызов на дуэль',
    '/schedule — автозапуск по расписанию',
    '',
    '💡 Подробнее о команде: /help new, /help schedule, /help duel и т.д.',
  ].join('\n');

  await ctx.reply(overview, { parse_mode: 'HTML' });
}

export async function handleNew(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  if (ctx.chat.type === 'private') {
    await ctx.reply(
      '⚠️ Голосование нужно запускать в <b>групповом чате</b>, куда добавлен бот.',
      { parse_mode: 'HTML' },
    );
    return;
  }

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const args = text.trim().split(/\s+/).slice(1);
  let duration = DEFAULT_DURATION_MINUTES;
  let anonymous = false;

  for (const arg of args) {
    const parsed = parseInt(arg, 10);
    if (!isNaN(parsed)) duration = Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, parsed));
    if (arg === 'anon' || arg === 'anonymous') anonymous = true;
  }

  // Build theme selection keyboard (2 columns)
  const buttons = [];
  for (let i = 0; i < THEME_LIST.length; i += 2) {
    const anonSuffix = anonymous ? ':anon' : '';
    const row = [
      { text: `${THEME_LIST[i].emoji} ${THEME_LIST[i].name}`, callback_data: `theme:${THEME_LIST[i].id}:${duration}${anonSuffix}` },
    ];
    if (THEME_LIST[i + 1]) {
      row.push({
        text: `${THEME_LIST[i + 1].emoji} ${THEME_LIST[i + 1].name}`,
        callback_data: `theme:${THEME_LIST[i + 1].id}:${duration}${anonSuffix}`,
      });
    }
    buttons.push(row);
  }

  const anonNote = anonymous ? '\n🕵️ <i>Анонимный режим</i>' : '';
  await ctx.reply(
    [`🎲 <b>Выбери тему голосования</b>`, `⏱ Продолжительность: <b>${duration} мин</b>${anonNote}`].join('\n'),
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
  );
}

export async function handleEnd(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  const session = sessionManager.getByChat(ctx.chat.id);
  if (!session) {
    await ctx.reply(formatNoActiveGame(), { parse_mode: 'HTML' });
    return;
  }

  if (session.initiatorId !== ctx.from.id) {
    await ctx.reply('❌ Завершить может только тот, кто запустил голосование.', { parse_mode: 'HTML' });
    return;
  }

  const finished = sessionManager.finish(session.id);
  if (!finished) return;
  await announceResults(ctx.telegram, finished);
}

export async function handleResults(ctx: Context): Promise<void> {
  if (!ctx.chat) return;

  const session = sessionManager.getByChat(ctx.chat.id);
  if (!session) {
    await ctx.reply(formatNoActiveGame(), { parse_mode: 'HTML' });
    return;
  }

  const text = formatGameMessage(session);
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎲 Участвовать!', callback_data: `join:${session.id}` }],
        [{ text: '🏁 Завершить', callback_data: `end:${session.id}` }],
      ],
    },
  });
}

export async function handleHistory(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const results = storage.getGameHistory(ctx.chat.id, 10);
  await ctx.reply(formatHistory(results), { parse_mode: 'HTML' });
}

export async function handleChampions(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const champions = storage.getChampions(ctx.chat.id);
  await ctx.reply(formatChampions(champions), { parse_mode: 'HTML' });
}

export async function handleTop(ctx: Context): Promise<void> {
  if (!ctx.chat) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const arg = text.trim().split(/\s+/)[1] ?? '';

  let since: number | undefined;
  let period: string | undefined;

  if (arg === 'week') {
    since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    period = 'неделя';
  } else if (arg === 'month') {
    since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    period = 'месяц';
  }

  const champions = storage.getChampions(ctx.chat.id, since);
  await ctx.reply(formatChampions(champions, period), { parse_mode: 'HTML' });
}

export async function handleStats(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const stats    = storage.getUserStats(ctx.from.id);
  const streak   = storage.getStreak(ctx.chat?.id ?? 0, ctx.from.id);
  const achIds   = storage.getUserAchievements(ctx.from.id);
  await ctx.reply(
    formatStats(ctx.from.id, ctx.from.first_name, stats, streak, achIds.length),
    { parse_mode: 'HTML' },
  );
}

export async function handleAchievements(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const ids  = storage.getUserAchievements(ctx.from.id);
  const list = ACHIEVEMENT_LIST.filter((a) => ids.includes(a.id));
  await ctx.reply(formatAchievementsList(ctx.from.first_name, list), { parse_mode: 'HTML' });
}

export async function handleCompare(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const match = text.match(/@(\w+)/);
  if (!match) {
    await ctx.reply('Укажи пользователя: /compare @username', { parse_mode: 'HTML' });
    return;
  }

  const targetUserId = storage.getUserIdByUsername(match[1]);
  if (!targetUserId) {
    await ctx.reply('❌ Пользователь не найден. Он должен был сыграть хотя бы раз.', { parse_mode: 'HTML' });
    return;
  }

  const chatId = ctx.chat.id;
  const champs = storage.getChampions(chatId);

  const buildProfile = (userId: number, firstName: string) => {
    const c = champs.find((x) => x.userId === userId);
    return {
      userId,
      firstName,
      wins:   c?.wins   ?? 0,
      losses: c?.losses ?? 0,
      games:  c?.games  ?? 0,
      streak: storage.getStreak(chatId, userId),
    };
  };

  const u1 = buildProfile(ctx.from.id, ctx.from.first_name);
  const u2champ = champs.find((x) => x.userId === targetUserId);
  const u2 = buildProfile(targetUserId, u2champ?.firstName ?? match[1]);

  await ctx.reply(formatCompare(u1, u2), { parse_mode: 'HTML' });
}

export async function handleDuel(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  if (ctx.chat.type === 'private') {
    await ctx.reply('⚠️ Дуэли только в группах!', { parse_mode: 'HTML' });
    return;
  }

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const match = text.match(/@(\w+)/);
  if (!match) {
    await ctx.reply('Укажи противника: /duel @username', { parse_mode: 'HTML' });
    return;
  }

  const challengedUserId = storage.getUserIdByUsername(match[1]);
  if (!challengedUserId) {
    await ctx.reply('❌ Пользователь не найден — он должен был поиграть хотя бы раз.', { parse_mode: 'HTML' });
    return;
  }

  if (challengedUserId === ctx.from.id) {
    await ctx.reply('❌ Нельзя вызвать самого себя.', { parse_mode: 'HTML' });
    return;
  }

  const theme = getTheme('classic');
  const duelId = generateId();
  const deadline = Date.now() + 5 * 60 * 1000;

  const duel: Duel = {
    id: duelId,
    chatId: ctx.chat.id,
    messageId: 0,
    challengerId:   ctx.from.id,
    challengerName: ctx.from.first_name,
    challengedId:   challengedUserId,
    challengedName: match[1],
    themeId: 'classic',
    status: 'pending',
    deadline,
  };

  const sent = await ctx.reply(formatDuelChallenge(duel, theme), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Принять',  callback_data: `duel_accept:${duelId}` },
          { text: '❌ Отказать', callback_data: `duel_decline:${duelId}` },
        ],
      ],
    },
  });

  duel.messageId = sent.message_id;
  duelManager.create(duel);
}

export async function handleSchedule(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const args = text.trim().split(/\s+/).slice(1);

  if (args.length === 0) {
    const sched = storage.getChatSchedule(ctx.chat.id);
    await ctx.reply(formatScheduleInfo(sched), { parse_mode: 'HTML' });
    return;
  }

  const timeArg = args[0];
  if (!/^\d{1,2}:\d{2}$/.test(timeArg)) {
    await ctx.reply('❌ Формат времени: HH:MM (UTC). Пример: /schedule 15:00', { parse_mode: 'HTML' });
    return;
  }

  const themeArg = args.find((a) => THEME_LIST.some((t) => t.id === a)) ?? 'classic';
  const durArg   = args.find((a) => /^\d+$/.test(a));
  const duration = durArg ? Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, parseInt(durArg, 10))) : DEFAULT_DURATION_MINUTES;
  const anon     = args.includes('anon');
  const days     = parseDays(args);

  const schedule: ChatSchedule = {
    id:        storage.getChatSchedule(ctx.chat.id)?.id ?? generateId(),
    chatId:    ctx.chat.id,
    time:      timeArg,
    days,
    themeId:   themeArg,
    duration,
    anonymous: anon,
    enabled:   true,
  };

  storage.upsertSchedule(schedule);
  scheduler.schedule(schedule);

  const theme    = getTheme(themeArg);
  const daysStr  = days.length > 0 ? formatDays(days) : 'каждый день';
  await ctx.reply(
    [
      '📅 <b>Расписание установлено!</b>',
      `⏰ Время: <b>${timeArg} UTC</b>`,
      `📆 Дни: <b>${daysStr}</b>`,
      `${theme.emoji} Тема: <b>${theme.name}</b>`,
      `⏱ Длительность: <b>${duration} мин</b>`,
      anon ? '🕵️ <i>Анонимный режим</i>' : '',
    ].filter(Boolean).join('\n'),
    { parse_mode: 'HTML' },
  );
}

export async function handleUnschedule(ctx: Context): Promise<void> {
  if (!ctx.chat) return;

  const sched = storage.getChatSchedule(ctx.chat.id);
  if (!sched) {
    await ctx.reply('📅 Расписание не настроено.', { parse_mode: 'HTML' });
    return;
  }

  scheduler.cancel(sched.id);
  storage.removeSchedule(ctx.chat.id);
  await ctx.reply('📅 Расписание отключено.', { parse_mode: 'HTML' });
}

// ── Announce results (called on expire / /end / callback end) ─────────────────

export async function announceResults(telegram: Telegram, session: GameSession): Promise<void> {
  const theme = getTheme(session.themeId);
  const { participants, target } = session;

  const sorted = [...participants].sort(
    (a, b) => getAbsDiff(a.size, target) - getAbsDiff(b.size, target),
  );
  const winner = sorted[0] ?? null;
  const loser  = sorted.length >= 2 ? sorted[sorted.length - 1] : null;

  const gameResult: GameResult = {
    id:               generateId(),
    chatId:           session.chatId,
    date:             getToday(),
    timestamp:        Date.now(),
    themeId:          session.themeId,
    themeName:        theme.name,
    themeEmoji:       theme.emoji,
    target,
    unit:             theme.unit,
    participantCount: participants.length,
    anonymous:        session.anonymous,
    winner: winner ? { userId: winner.userId, firstName: winner.firstName, size: winner.size, diff: getAbsDiff(winner.size, target) } : null,
    loser:  loser  ? { userId: loser.userId,  firstName: loser.firstName,  size: loser.size,  diff: getAbsDiff(loser.size,  target) } : null,
  };
  storage.addGameResult(gameResult);

  const today = getToday();
  for (const p of participants) {
    storage.addPlay({
      id: generateId(), userId: p.userId, firstName: p.firstName,
      username: p.username, size: p.size, funnyName: p.funnyName,
      date: today, timestamp: p.timestamp,
    });
  }

  // Streaks + achievements
  const achievementMsgs: string[] = [];
  for (const p of participants) {
    const isWinner = winner?.userId === p.userId;
    const isLoser  = loser?.userId  === p.userId;
    const streak   = storage.updateStreak(session.chatId, p.userId, isWinner);
    const games    = storage.incrementChatGames(session.chatId, p.userId);
    const diff     = getAbsDiff(p.size, target);
    const alreadyHas = (id: string) => storage.getUserAchievements(p.userId).includes(id);

    const earned = checkAchievements({
      userId: p.userId, chatId: session.chatId,
      isWinner, isLoser, diff,
      winStreak:  streak.wins,
      lossStreak: streak.losses,
      chatGames:  games,
      isJackpot:  diff === 0,
      anonymous:  session.anonymous,
    }, alreadyHas);

    for (const a of earned) storage.grantAchievement(p.userId, a.id);
    if (earned.length > 0) achievementMsgs.push(formatNewAchievements(p.userId, p.firstName, earned));
  }

  const resultsText = formatGameResults(session);

  try {
    await telegram.editMessageText(
      session.chatId, session.messageId, undefined,
      '✅ <b>Голосование завершено!</b> Смотри результаты ниже.',
      { parse_mode: 'HTML' },
    );
  } catch { /* message may be too old */ }

  await telegram.sendMessage(session.chatId, resultsText, { parse_mode: 'HTML' });

  for (const msg of achievementMsgs) {
    await telegram.sendMessage(session.chatId, msg, { parse_mode: 'HTML' });
  }
}

// ── Start a game from theme picker ───────────────────────────────────────────

export async function startGameWithTheme(
  ctx: Context,
  themeId: string,
  duration: number,
  pickerMsgId: number,
  anonymous = false,
): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  const theme       = getTheme(themeId);
  const target      = getRandomTarget(theme);
  const sessionId   = generateId();
  const deadline    = Date.now() + duration * 60 * 1000;
  const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');

  const session: GameSession = {
    id: sessionId, chatId: ctx.chat.id, messageId: 0,
    initiatorId: ctx.from.id, initiatorName: displayName,
    themeId, target, deadline, durationMinutes: duration,
    participants: [], status: 'active', anonymous,
  };

  const gameText = formatGameMessage(session);

  try { await ctx.telegram.deleteMessage(ctx.chat.id, pickerMsgId); } catch { /* ignore */ }

  const sent = await ctx.telegram.sendMessage(ctx.chat.id, gameText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎲 Участвовать!', callback_data: `join:${sessionId}` }],
        [{ text: '🏁 Завершить',    callback_data: `end:${sessionId}`  }],
      ],
    },
  });

  session.messageId = sent.message_id;
  sessionManager.create(session);
}

// ── Start a game from Telegram object (scheduler) ────────────────────────────

export async function startGameSession(telegram: Telegram, session: GameSession): Promise<void> {
  const gameText = formatGameMessage(session);

  const sent = await telegram.sendMessage(session.chatId, gameText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎲 Участвовать!', callback_data: `join:${session.id}` }],
        [{ text: '🏁 Завершить',    callback_data: `end:${session.id}`  }],
      ],
    },
  });

  session.messageId = sent.message_id;
  sessionManager.create(session);
}

// ── Duel result helper ───────────────────────────────────────────────────────

export async function resolveDuel(telegram: Telegram, duel: Duel): Promise<void> {
  const theme = getTheme(duel.themeId);
  const target = getRandomTarget(theme);

  const makeParticipant = (userId: number, name: string) => ({
    userId, firstName: name, username: '', size: getRandomSize(theme),
    funnyName: getRandomName(theme), timestamp: Date.now(),
  });

  const p1 = makeParticipant(duel.challengerId,  duel.challengerName);
  const p2 = makeParticipant(duel.challengedId,  duel.challengedName);

  const winner = getAbsDiff(p1.size, target) <= getAbsDiff(p2.size, target) ? p1 : p2;
  const loser  = winner === p1 ? p2 : p1;

  // Grant duel achievement to winner
  if (!storage.getUserAchievements(winner.userId).includes('duel_win')) {
    storage.grantAchievement(winner.userId, 'duel_win');
  }

  const text = formatDuelResult(winner, loser, target, theme);
  await telegram.sendMessage(duel.chatId, text, { parse_mode: 'HTML' });
}

// ── Day-of-week helpers ──────────────────────────────────────────────────────

const DAY_NAMES: Record<string, number> = {
  // Russian
  вс: 0, пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6,
  // English
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function parseDays(args: string[]): number[] {
  const days = new Set<number>();

  for (const arg of args) {
    const lower = arg.toLowerCase();
    if (lower === 'будни'   || lower === 'weekdays') { [1,2,3,4,5].forEach((d) => days.add(d)); continue; }
    if (lower === 'выходные' || lower === 'weekend')  { [0,6].forEach((d) => days.add(d)); continue; }
    if (lower in DAY_NAMES) { days.add(DAY_NAMES[lower]); continue; }
    // comma-separated: пн,вт,пт
    for (const part of lower.split(',')) {
      if (part in DAY_NAMES) days.add(DAY_NAMES[part]);
    }
  }

  return [...days].sort((a, b) => a - b);
}

export function formatDays(days: number[]): string {
  if (days.length === 0) return 'каждый день';
  return days.map((d) => DAY_LABELS[d]).join(' ');
}
