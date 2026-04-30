import * as fs from 'fs';
import * as path from 'path';

export interface Play {
  id: string;
  userId: number;
  firstName: string;
  username: string;
  size: number;
  funnyName: string;
  date: string;
  timestamp: number;
}

export interface GameResult {
  id: string;
  chatId: number;
  date: string;
  timestamp: number;
  themeId: string;
  themeName: string;
  themeEmoji: string;
  target: number;
  unit: string;
  participantCount: number;
  winner: { userId: number; firstName: string; size: number; diff: number } | null;
  loser: { userId: number; firstName: string; size: number; diff: number } | null;
}

interface StorageData {
  plays: Record<string, Play[]>;
  gameResults: GameResult[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'plays.json');

class Storage {
  private data: StorageData = { plays: {}, gameResults: [] };
  private playIndex = new Map<string, Play>();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<StorageData>;
        this.data = {
          plays: parsed.plays ?? {},
          gameResults: parsed.gameResults ?? [],
        };
        for (const plays of Object.values(this.data.plays)) {
          for (const play of plays) this.playIndex.set(play.id, play);
        }
      }
    } catch (e) {
      console.error('Storage load error:', e);
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  addPlay(play: Play): { isNew: boolean; existing?: Play } {
    const { date } = play;
    if (!this.data.plays[date]) this.data.plays[date] = [];
    const existing = this.data.plays[date].find((p) => p.userId === play.userId);
    if (existing) return { isNew: false, existing };
    this.data.plays[date].push(play);
    this.playIndex.set(play.id, play);
    this.save();
    return { isNew: true };
  }

  addGameResult(result: GameResult): void {
    this.data.gameResults.push(result);
    this.save();
  }

  getGameHistory(chatId: number, limit = 10): GameResult[] {
    return this.data.gameResults
      .filter((r) => r.chatId === chatId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getChampions(chatId: number): Array<{
    userId: number;
    firstName: string;
    wins: number;
    losses: number;
    games: number;
  }> {
    const chatResults = this.data.gameResults.filter((r) => r.chatId === chatId);
    const map = new Map<number, { firstName: string; wins: number; losses: number; games: number }>();

    for (const r of chatResults) {
      const participants = new Set<number>();

      if (r.winner) {
        participants.add(r.winner.userId);
        const entry = map.get(r.winner.userId) ?? {
          firstName: r.winner.firstName,
          wins: 0,
          losses: 0,
          games: 0,
        };
        entry.wins++;
        map.set(r.winner.userId, entry);
      }
      if (r.loser) {
        participants.add(r.loser.userId);
        const entry = map.get(r.loser.userId) ?? {
          firstName: r.loser.firstName,
          wins: 0,
          losses: 0,
          games: 0,
        };
        entry.losses++;
        map.set(r.loser.userId, entry);
      }

      // Count games for all known participants (winner + loser only — sufficient for display)
      for (const [uid, entry] of map) {
        if (participants.has(uid)) entry.games++;
      }
    }

    return [...map.entries()]
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }

  getPlayById(id: string): Play | undefined {
    return this.playIndex.get(id);
  }

  getUserPlayForDate(userId: number, date: string): Play | undefined {
    return this.data.plays[date]?.find((p) => p.userId === userId);
  }

  getUserStats(userId: number): { totalPlays: number; wins: number; bestDiff: number | null } {
    let totalPlays = 0;
    let wins = 0;
    let bestDiff: number | null = null;

    for (const plays of Object.values(this.data.plays)) {
      const userPlay = plays.find((p) => p.userId === userId);
      if (!userPlay) continue;
      totalPlays++;
      const sorted = [...plays].sort(
        (a, b) => Math.abs(a.size - 13) - Math.abs(b.size - 13),
      );
      if (sorted[0].userId === userId) wins++;
      const diff = Math.abs(userPlay.size - 13);
      if (bestDiff === null || diff < bestDiff) bestDiff = diff;
    }

    return { totalPlays, wins, bestDiff };
  }
}

export const storage = new Storage();
