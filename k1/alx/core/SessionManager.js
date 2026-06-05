// k1/alx/core/SessionManager.js
// Session Manager - User session tracking

export class SessionManager {
  constructor(options = {}) {
    this._clock = options.clock;
    this._sessions = new Map();
    this._maxSessions = options.maxSessions || 1000;
    this._sessionTimeout = options.sessionTimeout || 3600000;
  }

  create(userId) {
    const sessionId = this._generateSessionId(userId);
    
    const session = {
      id: sessionId,
      userId,
      createdAt: this._clock?.now() || Date.now(),
      lastActivity: this._clock?.now() || Date.now(),
      commandCount: 0,
      context: {},
      history: []
    };
    
    this._sessions.set(sessionId, session);
    this._cleanup();
    
    return session;
  }

  get(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;
    
    const now = this._clock?.now() || Date.now();
    if (now - session.lastActivity > this._sessionTimeout) {
      this._sessions.delete(sessionId);
      return null;
    }
    
    return session;
  }

  getByUser(userId) {
    for (const session of this._sessions.values()) {
      if (session.userId === userId) {
        const now = this._clock?.now() || Date.now();
        if (now - session.lastActivity <= this._sessionTimeout) {
          return session;
        }
      }
    }
    return null;
  }

  getOrCreate(userId) {
    const existing = this.getByUser(userId);
    if (existing) return existing;
    return this.create(userId);
  }

  update(sessionId, updates = {}) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;
    
    session.lastActivity = this._clock?.now() || Date.now();
    session.commandCount++;
    
    if (updates.context) {
      session.context = { ...session.context, ...updates.context };
    }
    
    if (updates.historyEntry) {
      session.history.push({
        ...updates.historyEntry,
        timestamp: session.lastActivity
      });
      
      if (session.history.length > 100) {
        session.history = session.history.slice(-50);
      }
    }
    
    return session;
  }

  end(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return { ok: false, error: "Session not found" };
    
    this._sessions.delete(sessionId);
    return { ok: true, duration: (this._clock?.now() || Date.now()) - session.createdAt };
  }

  _generateSessionId(userId) {
    const ts = this._clock?.now() || Date.now();
    return `session_${userId}_${ts}`;
  }

  _cleanup() {
    const now = this._clock?.now() || Date.now();
    
    for (const [id, session] of this._sessions) {
      if (now - session.lastActivity > this._sessionTimeout) {
        this._sessions.delete(id);
      }
    }
    
    if (this._sessions.size > this._maxSessions) {
      const sorted = Array.from(this._sessions.entries())
        .sort((a, b) => a[1].lastActivity - b[1].lastActivity);
      
      const toRemove = this._sessions.size - this._maxSessions;
      for (let i = 0; i < toRemove; i++) {
        this._sessions.delete(sorted[i][0]);
      }
    }
  }

  getStats() {
    return {
      activeSessions: this._sessions.size,
      maxSessions: this._maxSessions,
      timeoutMs: this._sessionTimeout
    };
  }
}

export function createSessionManager(options) {
  return new SessionManager(options);
}

export default SessionManager;