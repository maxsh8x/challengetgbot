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
}

type ExpireCallback = (session: GameSession) => Promise<void>;

class SessionManager {
  private sessions = new Map<string, GameSession>();
  private chatSessions = new Map<number, string>();
  private timers = new Map<string, NodeJS.Timeout>();
  private onExpire: ExpireCallback | null = null;

  setExpireCallback(cb: ExpireCallback): void {
    this.onExpire = cb;
  }

  create(session: GameSession): void {
    const existingId = this.chatSessions.get(session.chatId);
    if (existingId) this.cancel(existingId);

    this.sessions.set(session.id, session);
    this.chatSessions.set(session.chatId, session.id);

    const delay = session.deadline - Date.now();
    if (delay > 0 && this.onExpire) {
      const cb = this.onExpire;
      const timer = setTimeout(() => {
        const s = this.sessions.get(session.id);
        if (s?.status === 'active') {
          s.status = 'finished';
          this.chatSessions.delete(s.chatId);
          void cb(s);
        }
      }, delay);
      this.timers.set(session.id, timer);
    }
  }

  getByChat(chatId: number): GameSession | undefined {
    const id = this.chatSessions.get(chatId);
    return id ? this.sessions.get(id) : undefined;
  }

  getById(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  addParticipant(sessionId: string, participant: Participant): 'ok' | 'already' | 'no_session' {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return 'no_session';
    if (session.participants.some((p) => p.userId === participant.userId)) return 'already';
    session.participants.push(participant);
    return 'ok';
  }

  finish(sessionId: string): GameSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') return undefined;
    session.status = 'finished';
    this.chatSessions.delete(session.chatId);
    this.cancel(sessionId);
    return session;
  }

  private cancel(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.timers.delete(sessionId);
  }
}

export const sessionManager = new SessionManager();
