import { Telegraf } from 'telegraf';
import { handleInlineQuery } from './handlers/inline';
import { handleCallbackQuery } from './handlers/callback';
import {
  handleStart,
  handleHelp,
  handleNew,
  handleEnd,
  handleResults,
  handleHistory,
  handleChampions,
  handleTop,
  handleStats,
  handleDuel,
  handleSchedule,
  handleUnschedule,
  announceResults,
  startGameSession,
} from './handlers/commands';
import { formatGameMessage } from './utils/messages';
import { sessionManager } from './sessions';
import { scheduler } from './scheduler';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN env variable is required');

export const bot = new Telegraf(token);

sessionManager.setCallbacks({
  onExpire: async (session) => { await announceResults(bot.telegram, session); },
  onUpdate: async (session) => {
    try {
      await bot.telegram.editMessageText(
        session.chatId, session.messageId, undefined,
        formatGameMessage(session),
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎲 Участвовать!', callback_data: `join:${session.id}` }],
              [{ text: '🏁 Завершить',    callback_data: `end:${session.id}`  }],
            ],
          },
        },
      );
    } catch { /* ignore rate limit / too old */ }
  },
});

scheduler.init(bot.telegram, startGameSession);

bot.start(handleStart);
bot.help(handleHelp);
bot.command('new',          handleNew);
bot.command('end',          handleEnd);
bot.command('results',      handleResults);
bot.command('history',      handleHistory);
bot.command('champions',    handleChampions);
bot.command('top',          handleTop);
bot.command('stats',        handleStats);
bot.command('duel',         handleDuel);
bot.command('schedule',     handleSchedule);
bot.command('unschedule',   handleUnschedule);

bot.on('inline_query',  handleInlineQuery);
bot.on('callback_query', handleCallbackQuery);
