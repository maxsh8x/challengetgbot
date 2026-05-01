import { Context } from 'telegraf';
import { sessionManager, duelManager } from '../sessions';
import { formatGameMessage, escapeHtml, mention } from '../utils/messages';
import { getRandomSize, getRandomName, generateId, getSizeEmoji } from '../utils/game';
import { getTheme, getDisplayEmoji } from '../themes';
import { announceResults, startGameWithTheme, resolveDuel } from './commands';
import { storage } from '../storage';
import { formatJoinMessage } from '../utils/messages';

export async function handleCallbackQuery(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
  if (!ctx.from) return;

  const data  = ctx.callbackQuery.data;
  const chatId = 'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.chat?.id : undefined;
  const msgId  = 'message' in ctx.callbackQuery ? ctx.callbackQuery.message?.message_id : undefined;

  // ── Theme selection ──────────────────────────────────────────────────────────
  if (data.startsWith('theme:')) {
    const parts    = data.split(':');
    const themeId  = parts[1];
    const duration = parseInt(parts[2] ?? '30', 10);
    const anonymous = parts[3] === 'anon';

    if (!chatId || !msgId) {
      await ctx.answerCbQuery('❌ Ошибка — нет контекста чата.', { show_alert: true });
      return;
    }

    const theme = getTheme(themeId);
    await ctx.answerCbQuery(`${theme.emoji} ${theme.name} выбрана! Запускаю...`);
    await startGameWithTheme(ctx, themeId, duration, msgId, anonymous);
    return;
  }

  // ── Join game ────────────────────────────────────────────────────────────────
  if (data.startsWith('join:')) {
    const sessionId = data.slice(5);
    const session   = sessionManager.getById(sessionId);

    if (!session || session.status !== 'active') {
      await ctx.answerCbQuery('❌ Голосование уже завершено или не найдено.', { show_alert: true });
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

    const theme       = getTheme(session.themeId);
    const size        = getRandomSize(theme);
    const funnyName   = getRandomName(theme);
    const displayName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' ');

    const participant = {
      userId:    ctx.from.id,
      firstName: ctx.from.first_name,
      username:  ctx.from.username ?? '',
      size,
      funnyName,
      timestamp: Date.now(),
    };

    // Index username for /compare and /duel
    if (ctx.from.username) storage.indexUser(ctx.from.username, ctx.from.id);

    const result = sessionManager.addParticipant(sessionId, participant);
    if (result !== 'ok') {
      await ctx.answerCbQuery('❌ Не удалось добавить. Попробуй ещё раз.', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery(`${theme.emoji} ${size}${theme.unit}!`);

    // Post participant result to chat
    if (chatId) {
      const joinText = formatJoinMessage(participant, session.target, theme, session.anonymous);
      await ctx.telegram.sendMessage(chatId, joinText, { parse_mode: 'HTML' });
    }

    // Update game message
    if (chatId && msgId) {
      const updated = sessionManager.getById(sessionId);
      if (updated) {
        try {
          await ctx.telegram.editMessageText(chatId, msgId, undefined, formatGameMessage(updated), {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎲 Участвовать!', callback_data: `join:${sessionId}` }],
                [{ text: '🏁 Завершить',    callback_data: `end:${sessionId}`  }],
              ],
            },
          });
        } catch { /* ignore edit failures */ }
      }
    }

    return;
  }

  // ── End game ─────────────────────────────────────────────────────────────────
  if (data.startsWith('end:')) {
    const sessionId = data.slice(4);
    const session   = sessionManager.getById(sessionId);

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
    if (finished) await announceResults(ctx.telegram, finished);
    return;
  }

  // ── Duel accept ──────────────────────────────────────────────────────────────
  if (data.startsWith('duel_accept:')) {
    const duelId = data.slice(12);
    const duel   = duelManager.get(duelId);

    if (!duel || duel.status !== 'pending') {
      await ctx.answerCbQuery('❌ Дуэль уже недействительна.', { show_alert: true });
      return;
    }

    if (duel.challengedId !== ctx.from.id) {
      await ctx.answerCbQuery('❌ Это не твоя дуэль.', { show_alert: true });
      return;
    }

    const resolved = duelManager.resolve(duelId, 'accepted');
    if (!resolved) {
      await ctx.answerCbQuery('❌ Ошибка.', { show_alert: true });
      return;
    }

    await ctx.answerCbQuery('⚔️ Принято! Начинаем...');

    // Edit duel message to show accepted
    if (chatId && msgId) {
      try {
        await ctx.telegram.editMessageText(
          chatId, msgId, undefined,
          `⚔️ <b>Дуэль ПРИНЯТА!</b>\n${mention(duel.challengerId, duel.challengerName)} vs ${mention(duel.challengedId, duel.challengedName)}\nРасчёт...`,
          { parse_mode: 'HTML' },
        );
      } catch { /* ignore */ }
    }

    await resolveDuel(ctx.telegram, resolved);
    return;
  }

  // ── Duel decline ─────────────────────────────────────────────────────────────
  if (data.startsWith('duel_decline:')) {
    const duelId = data.slice(13);
    const duel   = duelManager.get(duelId);

    if (!duel || duel.status !== 'pending') {
      await ctx.answerCbQuery('❌ Дуэль уже недействительна.', { show_alert: true });
      return;
    }

    if (duel.challengedId !== ctx.from.id) {
      await ctx.answerCbQuery('❌ Это не твоя дуэль.', { show_alert: true });
      return;
    }

    duelManager.resolve(duelId, 'declined');
    await ctx.answerCbQuery('Дуэль отклонена.');

    if (chatId && msgId) {
      try {
        await ctx.telegram.editMessageText(
          chatId, msgId, undefined,
          `⚔️ <b>Дуэль отклонена.</b>\n${mention(duel.challengedId, duel.challengedName)} отказал ${mention(duel.challengerId, duel.challengerName)}.`,
          { parse_mode: 'HTML' },
        );
      } catch { /* ignore */ }
    }
    return;
  }

  await ctx.answerCbQuery();
}
