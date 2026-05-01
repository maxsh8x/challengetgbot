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
  handleAchievements,
  handleCompare,
  handleDuel,
  handleSchedule,
  handleUnschedule,
  announceResults,
  startGameSession,
} from './handlers/commands';
import { sessionManager } from './sessions';
import { scheduler } from './scheduler';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN env variable is required');

export const bot = new Telegraf(token);

sessionManager.setCallbacks({
  onExpire: async (session) => { await announceResults(bot.telegram, session); },
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
bot.command('achievements', handleAchievements);
bot.command('compare',      handleCompare);
bot.command('duel',         handleDuel);
bot.command('schedule',     handleSchedule);
bot.command('unschedule',   handleUnschedule);

bot.on('inline_query',  handleInlineQuery);
bot.on('callback_query', handleCallbackQuery);
