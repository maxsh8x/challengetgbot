export interface Participant {
  userId: number;
  firstName: string;
  username: string;
  size: number;
  funnyName: string;
  timestamp: number;
}

export interface GameSession {
  id: string;
  chatId: number;
  messageId: number;
  initiatorId: number;
  initiatorName: string;
  themeId: string;
  target: number;
  deadline: number;
  durationMinutes: number;
  participants: Participant[];
  status: 'active' | 'finished';
  anonymous: boolean;
}

export interface Duel {
  id: string;
  chatId: number;
  messageId: number;
  challengerId: number;
  challengerName: string;
  challengedId: number;
  challengedName: string;
  themeId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  deadline: number;
}

type SessionCallback = (session: GameSession) => Promise<void>;

// ── Session Manager ────────────────────────────────────────────────────────────

class SessionManager {
  private sessions   = new Map<string, GameSession>();
  private chatIndex  = new Map<number, string>();
  private timers     = new Map<string, NodeJS.Timeout>();
  private reminders  = new Map<string, NodeJS.Timeout>();
  private intervals  = new Map<string, NodeJS.Timeout>();

  private onExpire:   SessionCallback | null = null;
  private onReminder: SessionCallback | null = null;
  private onUpdate:   SessionCallback | null = null;

  setCallbacks(cb: {
    onExpire:    SessionCallback;
    onReminder?: SessionCallback;
    onUpdate?:   SessionCallback;
  }): void {
    this.onExpire   = cb.onExpire;
    this.onReminder = cb.onReminder ?? null;
    this.onUpdate   = cb.onUpdate   ?? null;
  }

  create(session: GameSession): void {
    const prev = this.chatIndex.get(session.chatId);
    if (prev) this.cancelAll(prev);

    this.sessions.set(session.id, session);
    this.chatIndex.set(session.chatId, session.id);

    const delay = session.deadline - Date.now();

    // Expire timer
    if (delay > 0) {
      const t = setTimeout(() => {
        const s = this.sessions.get(session.id);
        if (s?.status === 'active') {
          s.status = 'finished';
          this.chatIndex.delete(s.chatId);
          void this.onExpire?.(s);
        }
      }, delay);
      this.timers.set(session.id, t);
    }

    // Reminder at -5 min
    const reminderDelay = delay - 5 * 60 * 1000;
    if (reminderDelay > 0 && this.onReminder) {
      const rt = setTimeout(() => {
        const s = this.sessions.get(session.id);
        if (s?.status === 'active') void this.onReminder?.(s);
      }, reminderDelay);
      this.reminders.set(session.id, rt);
    }

    // Live update every 5 min
    if (this.onUpdate) {
      const iv = setInterval(() => {
        const s = this.sessions.get(session.id);
        if (!s || s.status !== 'active') { clearInterval(iv); return; }
        void this.onUpdate?.(s);
      }, 5 * 60 * 1000) as unknown as NodeJS.Timeout;
      this.intervals.set(session.id, iv);
    }
  }

  getByChat(chatId: number): GameSession | undefined {
    const id = this.chatIndex.get(chatId);
    return id ? this.sessions.get(id) : undefined;
  }

  getById(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  addParticipant(sessionId: string, p: Participant): 'ok' | 'already' | 'no_session' {
    const s = this.sessions.get(sessionId);
    if (!s || s.status !== 'active') return 'no_session';
    if (s.participants.some((x) => x.userId === p.userId)) return 'already';
    s.participants.push(p);
    return 'ok';
  }

  finish(sessionId: string): GameSession | undefined {
    const s = this.sessions.get(sessionId);
    if (!s || s.status !== 'active') return undefined;
    s.status = 'finished';
    this.chatIndex.delete(s.chatId);
    this.cancelAll(sessionId);
    return s;
  }

  private cancelAll(id: string): void {
    [this.timers, this.reminders, this.intervals].forEach((map) => {
      const t = map.get(id);
      if (t) { clearTimeout(t); clearInterval(t); }
      map.delete(id);
    });
  }
}

// ── Duel Manager ───────────────────────────────────────────────────────────────

type DuelExpireCallback = (duel: Duel) => Promise<void>;

class DuelManager {
  private duels  = new Map<string, Duel>();
  private timers = new Map<string, NodeJS.Timeout>();
  private onExpire: DuelExpireCallback | null = null;

  setExpireCallback(cb: DuelExpireCallback): void { this.onExpire = cb; }

  create(duel: Duel): void {
    this.duels.set(duel.id, duel);
    const delay = duel.deadline - Date.now();
    if (delay > 0) {
      const t = setTimeout(() => {
        const d = this.duels.get(duel.id);
        if (d?.status === 'pending') {
          d.status = 'expired';
          void this.onExpire?.(d);
        }
      }, delay);
      this.timers.set(duel.id, t);
    }
  }

  get(id: string): Duel | undefined { return this.duels.get(id); }

  resolve(id: string, status: 'accepted' | 'declined'): Duel | undefined {
    const d = this.duels.get(id);
    if (!d || d.status !== 'pending') return undefined;
    d.status = status;
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
    return d;
  }
}

export const sessionManager = new SessionManager();
export const duelManager    = new DuelManager();
