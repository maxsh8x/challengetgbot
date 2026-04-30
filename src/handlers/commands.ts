import { Context, Telegram } from 'telegraf';
import { storage, GameResult } from '../storage';
import { sessionManager, GameSession } from '../sessions';
import {
  formatGameMessage,
  formatGameResults,
  formatHistory,
  formatChampions,
  formatStats,
  formatNoActiveGame,
  escapeHtml,
} from '../utils/messages';
import {
  getRandomTarget,
  getRandomSize,
  getRandomName,
  getToday,
  generateId,
  getAbsDiff,
  getDiff,
} from '../utils/game';
import { THEME_LIST, getTheme } from '../themes';
import { DEFAULT_DURATION_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES } from '../constants';

export async function handleStart(ctx: Context): Promise<void> {
  const name = ctx.from?.first_name ?? 'друг';
  const text = [
    `👋 <b>Привет, ${escapeHtml(name)}! Я — Рулетка Пятницы!</b>`,
    '',
    '🎲 Определяю, кто будет готовить видео на пятницу!',
    '',
    '📏 <b>Правила:</b>',
    '• Кто-то запускает голосование командой /new',
    '• Выбирается тема и рандомная цель',
    '• Остальные нажимают <b>«Участвовать!»</b>',
    '• Победитель — ближе всего к цели',
    '• Лузер готовит видос на пятницу! 🎬',
    '',
    '⚙️ <b>Команды:</b>',
    '/new — запустить голосование',
    '/new 60 — на 60 минут',
    '/end — завершить досрочно',
    '/results — текущие результаты',
    '/history — история голосований',
    '/champions — зал славы чата',
    '/stats — твоя статистика',
  ].join('\n');

  await ctx.reply(text, { parse_mode: 'HTML' });
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

  // Parse duration from command argument
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const arg = text.trim().split(/\s+/)[1];
  let duration = DEFAULT_DURATION_MINUTES;
  if (arg) {
    const parsed = parseInt(arg, 10);
    if (!isNaN(parsed)) {
      duration = Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, parsed));
    }
  }

  // Build theme selection keyboard (2 columns)
  const buttons = [];
  for (let i = 0; i < THEME_LIST.length; i += 2) {
    const row = [
      { text: `${THEME_LIST[i].emoji} ${THEME_LIST[i].name}`, callback_data: `theme:${THEME_LIST[i].id}:${duration}` },
    ];
    if (THEME_LIST[i + 1]) {
      row.push({
        text: `${THEME_LIST[i + 1].emoji} ${THEME_LIST[i + 1].name}`,
        callback_data: `theme:${THEME_LIST[i + 1].id}:${duration}`,
      });
    }
    buttons.push(row);
  }

  await ctx.reply(
    [
      '🎲 <b>Выбери тему голосования</b>',
      `⏱ Продолжительность: <b>${duration} мин</b>`,
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    },
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
    await ctx.reply('❌ Завершить может только тот, кто запустил голосование.', {
      parse_mode: 'HTML',
    });
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
  const text = formatHistory(results);
  await ctx.reply(text, { parse_mode: 'HTML' });
}

export async function handleChampions(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const champions = storage.getChampions(ctx.chat.id);
  const text = formatChampions(champions);
  await ctx.reply(text, { parse_mode: 'HTML' });
}

export async function handleStats(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const stats = storage.getUserStats(ctx.from.id);
  const text = formatStats(ctx.from.first_name, stats);
  await ctx.reply(text, { parse_mode: 'HTML' });
}

export async function announceResults(telegram: Telegram, session: GameSession): Promise<void> {
  const theme = getTheme(session.themeId);
  const { participants, target } = session;

  // Save historical game result
  const sorted = [...participants].sort(
    (a, b) => getAbsDiff(a.size, target) - getAbsDiff(b.size, target),
  );
  const winner = sorted[0] ?? null;
  const loser = sorted.length >= 2 ? sorted[sorted.length - 1] : null;

  const gameResult: GameResult = {
    id: generateId(),
    chatId: session.chatId,
    date: getToday(),
    timestamp: Date.now(),
    themeId: session.themeId,
    themeName: theme.name,
    themeEmoji: theme.emoji,
    target,
    unit: theme.unit,
    participantCount: participants.length,
    winner: winner
      ? { userId: winner.userId, firstName: winner.firstName, size: winner.size, diff: getAbsDiff(winner.size, target) }
      : null,
    loser: loser
      ? { userId: loser.userId, firstName: loser.firstName, size: loser.size, diff: getAbsDiff(loser.size, target) }
      : null,
  };
  storage.addGameResult(gameResult);

  // Save individual plays
  const today = getToday();
  for (const p of participants) {
    storage.addPlay({
      id: generateId(),
      userId: p.userId,
      firstName: p.firstName,
      username: p.username,
      size: p.size,
      funnyName: p.funnyName,
      date: today,
      timestamp: p.timestamp,
    });
  }

  const resultsText = formatGameResults(session);

  try {
    await telegram.editMessageText(
      session.chatId,
      session.messageId,
      undefined,
      '✅ <b>Голосование завершено!</b> Смотри результаты ниже.',
      { parse_mode: 'HTML' },
    );
  } catch {
    // Message may be too old or not modified
  }

  await telegram.sendMessage(session.chatId, resultsText, { parse_mode: 'HTML' });
}

export async function startGameWithTheme(
  ctx: Context,
  themeId: string,
  duration: number,
  pickerMsgId: number,
): Promise<void> {
  if (!ctx.from || !ctx.chat) return;

  const theme = getTheme(themeId);
  const target = getRandomTarget(theme);
  const sessionId = generateId();
  const deadline = Date.now() + duration * 60 * 1000;
  const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');

  const session: GameSession = {
    id: sessionId,
    chatId: ctx.chat.id,
    messageId: 0,
    initiatorId: ctx.from.id,
    initiatorName: displayName,
    themeId,
    target,
    deadline,
    durationMinutes: duration,
    participants: [],
    status: 'active',
  };

  const gameText = formatGameMessage(session);

  // Delete the theme picker message
  try {
    await ctx.telegram.deleteMessage(ctx.chat.id, pickerMsgId);
  } catch {
    // Ignore if can't delete
  }

  const sent = await ctx.telegram.sendMessage(ctx.chat.id, gameText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎲 Участвовать!', callback_data: `join:${sessionId}` }],
        [{ text: '🏁 Завершить', callback_data: `end:${sessionId}` }],
      ],
    },
  });

  session.messageId = sent.message_id;
  sessionManager.create(session);
}
