import { Telegraf } from 'telegraf';
import { handleInlineQuery } from './handlers/inline';
import { handleCallbackQuery } from './handlers/callback';
import {
  handleStart,
  handleNew,
  handleEnd,
  handleResults,
  handleHistory,
  handleChampions,
  handleStats,
  announceResults,
} from './handlers/commands';
import { sessionManager } from './sessions';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN env variable is required');

export const bot = new Telegraf(token);

sessionManager.setExpireCallback(async (session) => {
  await announceResults(bot.telegram, session);
});

bot.start(handleStart);
bot.help(handleStart);
bot.command('new', handleNew);
bot.command('end', handleEnd);
bot.command('results', handleResults);
bot.command('history', handleHistory);
bot.command('champions', handleChampions);
bot.command('stats', handleStats);

bot.on('inline_query', handleInlineQuery);
bot.on('callback_query', handleCallbackQuery);
