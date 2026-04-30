import { Context } from 'telegraf';
import { InlineQueryResultArticle } from 'telegraf/typings/core/types/typegram';

export async function handleInlineQuery(ctx: Context): Promise<void> {
  if (!ctx.inlineQuery) return;

  const result: InlineQueryResultArticle = {
    type: 'article',
    id: 'info',
    title: '🎲 Пятничный Замерщик',
    description: 'Добавь бота в групповой чат и запусти /new',
    input_message_content: {
      message_text: [
        '🎲 <b>Пятничный Замерщик</b>',
        '',
        'Добавь меня в групповой чат и запусти:',
        '<code>/new</code> — голосование на 30 минут',
        '<code>/new 60</code> — на 60 минут',
        '',
        'Участники нажимают кнопку «Участвовать!»',
        'Победитель — ближе всего к секретной цели!',
        'Лузер готовит видос на пятницу 🎬',
      ].join('\n'),
      parse_mode: 'HTML',
    },
  };

  await ctx.answerInlineQuery([result], { cache_time: 60, is_personal: false });
}
