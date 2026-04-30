import * as dotenv from 'dotenv';
dotenv.config();

import { bot } from './bot';

async function main(): Promise<void> {
  console.log('🤖 Запускаю Пятничного Замерщика...');

  await bot.launch({
    allowedUpdates: ['message', 'inline_query', 'chosen_inline_result', 'callback_query'],
  });

  console.log('✅ Бот запущен и готов к замерам!');
}

main().catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
