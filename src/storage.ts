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
  anonymous: boolean;
  winner: { userId: number; firstName: string; size: number; diff: number } | null;
  loser:  { userId: number; firstName: string; size: number; diff: number } | null;
}

export interface ChatSchedule {
  id: string;
  chatId: number;
  time: string;        // "HH:MM" UTC
  days: number[];      // 0=Sun,1=Mon,...,6=Sat — empty means every day
  themeId: string;
  duration: number;
  anonymous: boolean;
  customTarget?: number;
  enabled: boolean;
}

interface UserStreak {
  wins: number;
  losses: number;
}

interface StorageData {
  plays: Record<string, Play[]>;
  gameResults: GameResult[];
  streaks: Record<string, UserStreak>;   // `${chatId}_${userId}`
  achievements: Record<string, string[]>; // `${userId}` → achievementId[]
  chatGames: Record<string, number>;      // `${chatId}_${userId}` → game count
  schedules: ChatSchedule[];
  usernames: Record<string, number>;     // username → userId
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'plays.json');

class Storage {
  private data: StorageData = {
    plays: {},
    gameResults: [],
    streaks: {},
    achievements: {},
    chatGames: {},
    schedules: [],
    usernames: {},
  };
  private playIndex = new Map<string, Play>();

  constructor() { this.load(); }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      if (fs.existsSync(DATA_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Partial<StorageData>;
        this.data = {
          plays:        parsed.plays        ?? {},
          gameResults:  parsed.gameResults  ?? [],
          streaks:      parsed.streaks      ?? {},
          achievements: parsed.achievements ?? {},
          chatGames:    parsed.chatGames    ?? {},
          schedules:    (parsed.schedules ?? []).map((s: ChatSchedule) => ({ ...s, days: s.days ?? [] })),
          usernames:    parsed.usernames    ?? {},
        };
        for (const plays of Object.values(this.data.plays))
          for (const p of plays) this.playIndex.set(p.id, p);
      }
    } catch (e) { console.error('Storage load error:', e); }
  }

  private save(): void {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2)); }
    catch (e) { console.error('Storage save error:', e); }
  }

  // ── Plays ────────────────────────────────────────────────────────────────────

  addPlay(play: Play): { isNew: boolean; existing?: Play } {
    const { date } = play;
    if (!this.data.plays[date]) this.data.plays[date] = [];
    const existing = this.data.plays[date].find((p) => p.userId === play.userId);
    if (existing) return { isNew: false, existing };
    this.data.plays[date].push(play);
    this.playIndex.set(play.id, play);
    if (play.username) this.data.usernames[play.username.toLowerCase()] = play.userId;
    this.save();
    return { isNew: true };
  }

  getPlayById(id: string): Play | undefined { return this.playIndex.get(id); }
  getUserPlayForDate(userId: number, date: string): Play | undefined {
    return this.data.plays[date]?.find((p) => p.userId === userId);
  }

  // ── Game results ─────────────────────────────────────────────────────────────

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

  getChampions(chatId: number, since?: number): Array<{
    userId: number; firstName: string;
    wins: number; losses: number; games: number;
  }> {
    const results = this.data.gameResults.filter(
      (r) => r.chatId === chatId && (!since || r.timestamp >= since),
    );
    const map = new Map<number, { firstName: string; wins: number; losses: number; games: number }>();

    const touch = (userId: number, firstName: string) => {
      if (!map.has(userId)) map.set(userId, { firstName, wins: 0, losses: 0, games: 0 });
    };

    for (const r of results) {
      const players = new Set<number>();
      if (r.winner) { touch(r.winner.userId, r.winner.firstName); players.add(r.winner.userId); map.get(r.winner.userId)!.wins++; }
      if (r.loser)  { touch(r.loser.userId,  r.loser.firstName);  players.add(r.loser.userId);  map.get(r.loser.userId)!.losses++; }
      for (const uid of players) map.get(uid)!.games++;
    }

    return [...map.entries()]
      .map(([userId, d]) => ({ userId, ...d }))
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  }

  // ── Streaks ──────────────────────────────────────────────────────────────────

  getStreak(chatId: number, userId: number): UserStreak {
    return this.data.streaks[`${chatId}_${userId}`] ?? { wins: 0, losses: 0 };
  }

  updateStreak(chatId: number, userId: number, isWin: boolean): UserStreak {
    const key = `${chatId}_${userId}`;
    const cur = this.data.streaks[key] ?? { wins: 0, losses: 0 };
    const next: UserStreak = isWin
      ? { wins: cur.wins + 1, losses: 0 }
      : { wins: 0, losses: cur.losses + 1 };
    this.data.streaks[key] = next;
    this.save();
    return next;
  }

  // ── Achievements ─────────────────────────────────────────────────────────────

  getUserAchievements(userId: number): string[] {
    return this.data.achievements[String(userId)] ?? [];
  }

  grantAchievement(userId: number, achievementId: string): boolean {
    const key = String(userId);
    if (!this.data.achievements[key]) this.data.achievements[key] = [];
    if (this.data.achievements[key].includes(achievementId)) return false;
    this.data.achievements[key].push(achievementId);
    this.save();
    return true;
  }

  // ── Chat game counts ─────────────────────────────────────────────────────────

  incrementChatGames(chatId: number, userId: number): number {
    const key = `${chatId}_${userId}`;
    this.data.chatGames[key] = (this.data.chatGames[key] ?? 0) + 1;
    this.save();
    return this.data.chatGames[key];
  }

  getChatGames(chatId: number, userId: number): number {
    return this.data.chatGames[`${chatId}_${userId}`] ?? 0;
  }

  // ── Schedules ────────────────────────────────────────────────────────────────

  getSchedules(): ChatSchedule[] { return this.data.schedules; }

  getChatSchedule(chatId: number): ChatSchedule | undefined {
    return this.data.schedules.find((s) => s.chatId === chatId);
  }

  upsertSchedule(schedule: ChatSchedule): void {
    const idx = this.data.schedules.findIndex((s) => s.chatId === schedule.chatId);
    if (idx >= 0) this.data.schedules[idx] = schedule;
    else this.data.schedules.push(schedule);
    this.save();
  }

  removeSchedule(chatId: number): boolean {
    const before = this.data.schedules.length;
    this.data.schedules = this.data.schedules.filter((s) => s.chatId !== chatId);
    if (this.data.schedules.length !== before) { this.save(); return true; }
    return false;
  }

  // ── Username index ───────────────────────────────────────────────────────────

  indexUser(username: string, userId: number): void {
    this.data.usernames[username.toLowerCase()] = userId;
  }

  getUserIdByUsername(username: string): number | undefined {
    return this.data.usernames[username.replace('@', '').toLowerCase()];
  }

  // ── Misc ─────────────────────────────────────────────────────────────────────

  getUserStats(userId: number): { totalPlays: number; wins: number; bestDiff: number | null } {
    let totalPlays = 0;
    for (const plays of Object.values(this.data.plays)) {
      if (plays.some((p) => p.userId === userId)) totalPlays++;
    }

    let wins = 0;
    let bestDiff: number | null = null;
    for (const r of this.data.gameResults) {
      if (r.winner?.userId === userId) {
        wins++;
        if (bestDiff === null || r.winner.diff < bestDiff) bestDiff = r.winner.diff;
      } else if (r.loser?.userId === userId) {
        if (bestDiff === null || r.loser.diff < bestDiff) bestDiff = r.loser.diff;
      }
    }

    return { totalPlays, wins, bestDiff };
  }
}

export const storage = new Storage();
