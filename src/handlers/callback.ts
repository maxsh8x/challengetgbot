import { Context } from 'telegraf';
import { sessionManager } from '../sessions';
import {
  formatGameMessage,
  escapeHtml,
  mention,
} from '../utils/messages';
import { getRandomSize, getRandomName, generateId, getSizeEmoji } from '../utils/game';
import { getTheme } from '../themes';
import { announceResults, startGameWithTheme } from './commands';

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  if (!ctx.from) return;

  const data = ctx.callbackQuery.data;
  const chatId =
    'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.chat?.id : undefined;
  const msgId =
    'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.message_id : undefined;

  // ── Theme selection ──────────────────────────────────────────────────────────
  if (data.startsWith('theme:')) {
    const parts = data.split(':');
    const themeId = parts[1];
    const duration = parseInt(parts[2] ?? '30', 10);

    if (!chatId || !msgId) {
      await ctx.answerCbQuery('❌ Ошибка — нет контекста чата.', { show_alert: true });
      return;
    }

    const theme = getTheme(themeId);
    await ctx.answerCbQuery(`${theme.emoji} ${theme.name} выбрана! Запускаю...`);
    await startGameWithTheme(ctx, themeId, duration, msgId);
    return;
  }

  // ── Join game ────────────────────────────────────────────────────────────────
  if (data.startsWith('join:')) {
    const sessionId = data.slice(5);
    const session = sessionManager.getById(sessionId);

    if (!session || session.status !== 'active') {
      await ctx.answerCbQuery('❌ Голосование уже завершено или не найдено.', {
        show_alert: true,
      });
      return;
    }

    const existing = session.participants.find((p) => p.userId === ctx.from!.id);
    if (existing) {
      const theme = getTheme(session.themeId);
      await ctx.answerCbQuery(
        `Ты уже участвуешь!\n${theme.emoji} ${existing.funnyName}: ${existing.size}${theme.unit}`,
        { show_alert: true },
      );
      return;
    }

    const theme = getTheme(session.themeId);
    const size = getRandomSize(theme);
    const funnyName = getRandomName(theme);
    const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');

    const participant = {
      userId: ctx.from.id,
      firstName: ctx.from.first_name,
      username: ctx.from.username ?? '',
      size,
      funnyName,
      timestamp: Date.now(),
    };

    const result = sessionManager.addParticipant(sessionId, participant);
    if (result !== 'ok') {
      await ctx.answerCbQuery('❌ Не удалось добавить. Попробуй ещё раз.', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery(`${theme.emoji} ${size}${theme.unit}!`);

    // Post participant result to chat
    if (chatId) {
      const joinText = formatJoinLine(ctx.from.id, displayName, funnyName, size, theme.unit, theme.emoji, session.target);
      await ctx.telegram.sendMessage(chatId, joinText, { parse_mode: 'HTML' });
    }

    // Update game message
    if (chatId && msgId) {
      const updatedSession = sessionManager.getById(sessionId);
      if (updatedSession) {
        try {
          await ctx.telegram.editMessageText(
            chatId,
            msgId,
            undefined,
            formatGameMessage(updatedSession),
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🎲 Участвовать!', callback_data: `join:${sessionId}` }],
                  [{ text: '🏁 Завершить', callback_data: `end:${sessionId}` }],
                ],
              },
            },
          );
        } catch {
          // Ignore edit failures
        }
      }
    }

    return;
  }

  // ── End game ─────────────────────────────────────────────────────────────────
  if (data.startsWith('end:')) {
    const sessionId = data.slice(4);
    const session = sessionManager.getById(sessionId);

    if (!session || session.status !== 'active') {
      await ctx.answerCbQuery('❌ Голосование уже завершено.', { show_alert: true });
      return;
    }

    if (session.initiatorId !== ctx.from.id) {
      await ctx.answerCbQuery('❌ Завершить может только организатор.', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('🏁 Завершаю...');

    const finished = sessionManager.finish(sessionId);
    if (finished) {
      await announceResults(ctx.telegram, finished);
    }

    return;
  }
}

function formatJoinLine(
  userId: number,
  displayName: string,
  funnyName: string,
  size: number,
  unit: string,
  themeEmoji: string,
  target: number,
): string {
  const emoji = getSizeEmoji(size, target);
  return `🎲 <b>${mention(userId, displayName)}</b>\n${themeEmoji} <b>${escapeHtml(funnyName)}</b> у меня <b>${size}${unit}</b> ${emoji}`;
}
