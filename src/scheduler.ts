import { Telegram } from 'telegraf';
import { storage, ChatSchedule } from './storage';
import { getTheme } from './themes';
import { getRandomTarget, generateId } from './utils/game';
import { GameSession } from './sessions';

export type StartSessionFn = (telegram: Telegram, session: GameSession) => Promise<void>;

class Scheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private telegram: Telegram | null = null;
  private startSession: StartSessionFn | null = null;

  init(telegram: Telegram, startSession: StartSessionFn): void {
    this.telegram = telegram;
    this.startSession = startSession;
    for (const s of storage.getSchedules()) {
      if (s.enabled) this.schedule(s);
    }
  }

  schedule(s: ChatSchedule): void {
    this.cancel(s.id);
    const delay = msUntilNext(s.time, s.days);
    const timer = setTimeout(() => void this.fire(s), delay);
    this.timers.set(s.id, timer);
  }

  cancel(id: string): void {
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
  }

  private async fire(s: ChatSchedule): Promise<void> {
    // Schedule next occurrence
    const next = setTimeout(() => void this.fire(s), msUntilNext(s.time, s.days));
    this.timers.set(s.id, next);

    if (!this.telegram || !this.startSession) return;

    const theme  = getTheme(s.themeId);
    const target = s.customTarget ?? getRandomTarget(theme);

    const session: GameSession = {
      id:             generateId(),
      chatId:         s.chatId,
      messageId:      0,
      initiatorId:    0,
      initiatorName:  '⏰ Авторасписание',
      themeId:        s.themeId,
      target,
      deadline:       Date.now() + s.duration * 60 * 1000,
      durationMinutes: s.duration,
      participants:   [],
      status:         'active',
      anonymous:      s.anonymous,
    };

    await this.startSession(this.telegram, session);
  }
}

const MSK_OFFSET_HOURS = 3; // MSK = UTC+3, no DST

// Returns ms until the next occurrence of `time` (HH:MM MSK) on one of `days`.
// If `days` is empty → any day of week.
function msUntilNext(time: string, days: number[]): number {
  const [hh, mm] = time.split(':').map(Number);
  // Convert MSK to UTC by subtracting offset (setUTCHours handles negative values correctly)
  const utcHH = hh - MSK_OFFSET_HOURS;
  const now = new Date();

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    candidate.setUTCHours(utcHH, mm, 0, 0);

    if (candidate.getTime() <= now.getTime()) continue;
    // Day-of-week check uses MSK day (candidate is already at correct wall-clock moment)
    const mskDay = new Date(candidate.getTime() + MSK_OFFSET_HOURS * 3600 * 1000).getUTCDay();
    if (days.length > 0 && !days.includes(mskDay)) continue;

    return candidate.getTime() - now.getTime();
  }

  return 24 * 60 * 60 * 1000;
}

export const scheduler = new Scheduler();
