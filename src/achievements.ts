export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
}

export const ACHIEVEMENT_LIST: Achievement[] = [
  { id: 'first_win',     emoji: '🏆', name: 'Первая победа',     description: 'Выиграй первую игру в чате' },
  { id: 'jackpot',       emoji: '💥', name: 'Джекпот',           description: 'Попади точно в цель' },
  { id: 'close_call',   emoji: '🎯', name: 'Снайпер',            description: 'Оказаться ≤ 1 от цели' },
  { id: 'win_streak_3',  emoji: '🔥', name: 'Хет-трик',          description: '3 победы подряд' },
  { id: 'win_streak_5',  emoji: '⚡', name: 'Непобедимый',        description: '5 побед подряд' },
  { id: 'loss_streak_3', emoji: '💀', name: 'Мальчик для битья', description: 'Проиграть 3 раза подряд' },
  { id: 'loss_streak_5', emoji: '😈', name: 'Вечный лузер',      description: 'Проиграть 5 раз подряд' },
  { id: 'games_10',      emoji: '🎖', name: 'Ветеран',            description: 'Сыграть 10 игр в чате' },
  { id: 'games_50',      emoji: '🎗', name: 'Легенда',            description: 'Сыграть 50 игр в чате' },
  { id: 'duel_win',      emoji: '⚔️', name: 'Дуэлянт',           description: 'Победить в дуэли' },
  { id: 'anon_win',      emoji: '🕵️', name: 'Инкогнито',         description: 'Победить в анонимном режиме' },
];

export const ACHIEVEMENTS: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENT_LIST.map((a) => [a.id, a]),
);

export interface AchievementCheckInput {
  userId: number;
  chatId: number;
  isWinner: boolean;
  isLoser: boolean;
  diff: number;          // abs diff from target
  winStreak: number;     // streak AFTER this game
  lossStreak: number;
  chatGames: number;     // total games played in this chat AFTER this game
  isJackpot: boolean;
  anonymous: boolean;
}

export function checkAchievements(
  input: AchievementCheckInput,
  alreadyHas: (id: string) => boolean,
): Achievement[] {
  const earned: Achievement[] = [];
  const give = (id: string) => {
    if (!alreadyHas(id)) earned.push(ACHIEVEMENTS[id]);
  };

  if (input.isWinner) give('first_win');
  if (input.isJackpot) give('jackpot');
  if (input.diff <= 1 && !input.isJackpot) give('close_call');
  if (input.winStreak >= 3) give('win_streak_3');
  if (input.winStreak >= 5) give('win_streak_5');
  if (input.lossStreak >= 3) give('loss_streak_3');
  if (input.lossStreak >= 5) give('loss_streak_5');
  if (input.chatGames >= 10) give('games_10');
  if (input.chatGames >= 50) give('games_50');
  if (input.isWinner && input.anonymous) give('anon_win');

  return earned;
}
