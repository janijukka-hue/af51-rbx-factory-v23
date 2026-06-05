// m2/Ohjaus/session-manager.js
// M2 Session Manager - istuntojen ja kontekstin hallinta
// - Session lifecycle
// - Context tracking
// - Session persistence
// - Multi-session support

import { fnv1a32 } from "../../k1/Ydin/alydin.js";
import { RING_TIER } from "../../k1/Ydin/muisti.js";

const SESSION_MANAGER_VERSION = "1.0.0";

/* =============================================================================
   SESSION STATE
============================================================================= */

export const SESSION_STATE = {
  CREATED: "CREATED",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  EXPIRED: "EXPIRED",
  CLOSED: "CLOSED"
};

/* =============================================================================
   SESSION
============================================================================= */

export class Session {

  constructor(opts = {}) {
    this.id = opts.id || null;
    this.state = SESSION_STATE.CREATED;
    this.createdAt = opts.createdAt || 0;
    this.lastActiveAt = opts.createdAt || 0;
    this.expiresAt = opts.expiresAt || null;

    // Context
    this.context = {
      role: opts.role || "AL2",
      domain: opts.domain || "SYSTEM",
      locale: opts.locale || "fi-FI",
      timezone: opts.timezone || "Europe/Helsinki",
      ...opts.context
    };

    // Metadata
    this.meta = {
      userAgent: opts.userAgent || null,
      source: opts.source || "unknown",
      ...opts.meta
    };

    // Session data (key-value)
    this.data = {};

    // History
    this.history = [];
    this.historyLimit = opts.historyLimit || 100;

    // Stats
    this.stats = {
      commands: 0,
      decisions: 0,
      errors: 0
    };
  }

  /* =========================================================
     DATA
  ========================================================= */

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    return this;
  }

  remove(key) {
    delete this.data[key];
    return this;
  }

  has(key) {
    return key in this.data;
  }

  clear() {
    this.data = {};
    return this;
  }

  /* =========================================================
     CONTEXT
  ========================================================= */

  getContext() {
    return { ...this.context };
  }

  setContext(key, value) {
    this.context[key] = value;
    return this;
  }

  mergeContext(obj) {
    this.context = { ...this.context, ...obj };
    return this;
  }

  /* =========================================================
     HISTORY
  ========================================================= */

  addHistory(entry) {
    this.history.push({
      ...entry,
      ts: entry.ts || Date.now()
    });

    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }

    return this;
  }

  getHistory(count = 20) {
    return this.history.slice(-count);
  }

  clearHistory() {
    this.history = [];
    return this;
  }

  /* =========================================================
     STATS
  ========================================================= */

  incrementStat(key, amount = 1) {
    this.stats[key] = (this.stats[key] || 0) + amount;
    return this;
  }

  getStats() {
    return { ...this.stats };
  }

  /* =========================================================
     STATE
  ========================================================= */

  activate(ts) {
    this.state = SESSION_STATE.ACTIVE;
    this.lastActiveAt = ts || Date.now();
    return this;
  }

  pause() {
    this.state = SESSION_STATE.PAUSED;
    return this;
  }

  expire() {
    this.state = SESSION_STATE.EXPIRED;
    return this;
  }

  close() {
    this.state = SESSION_STATE.CLOSED;
    return this;
  }

  isActive() {
    return this.state === SESSION_STATE.ACTIVE;
  }

  isExpired(now) {
    if (!this.expiresAt) return false;
    return now > this.expiresAt;
  }

  /* =========================================================
     SERIALIZE
  ========================================================= */

  toJSON() {
    return {
      id: this.id,
      state: this.state,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      expiresAt: this.expiresAt,
      context: this.context,
      meta: this.meta,
      data: this.data,
      history: this.history,
      stats: this.stats
    };
  }

  static fromJSON(json) {
    const session = new Session({
      id: json.id,
      createdAt: json.createdAt,
      expiresAt: json.expiresAt,
      context: json.context,
      meta: json.meta,
      historyLimit: json.history?.length || 100
    });

    session.state = json.state || SESSION_STATE.CREATED;
    session.lastActiveAt = json.lastActiveAt || json.createdAt;
    session.data = json.data || {};
    session.history = json.history || [];
    session.stats = json.stats || { commands: 0, decisions: 0, errors: 0 };

    return session;
  }
}

/* =============================================================================
   SESSION MANAGER
============================================================================= */

export class SessionManager {

  constructor(opts = {}) {
    this.cfg = {
      prefix: opts.prefix || "m2",
      defaultTTL: opts.defaultTTL || 3600000, // 1 hour
      maxSessions: opts.maxSessions || 100,
      cleanupInterval: opts.cleanupInterval || 60000, // 1 min
      persistSessions: opts.persistSessions !== false,
      ...opts.config
    };

    this.clock = opts.clock || { now: () => Date.now() };
    this.store = opts.store || null;
    this.orchestrator = opts.orchestrator || null;

    // Sessions
    this._sessions = new Map();
    this._activeSessionId = null;

    // Storage key
    this._storeKey = `${this.cfg.prefix}:sessions`;

    // Cleanup timer
    this._cleanupTimer = null;

    // Stats
    this._stats = {
      created: 0,
      expired: 0,
      closed: 0
    };
  }

  /* =========================================================
     LIFECYCLE
  ========================================================= */

  async start() {
    // Load persisted sessions
    if (this.cfg.persistSessions && this.store) {
      await this._loadSessions();
    }

    // Start cleanup timer
    this._startCleanup();

    return this;
  }

  async stop() {
    // Stop cleanup
    this._stopCleanup();

    // Persist sessions
    if (this.cfg.persistSessions && this.store) {
      await this._saveSessions();
    }

    return this;
  }

  /* =========================================================
     SESSION CRUD
  ========================================================= */

  create(opts = {}) {
    const ts = this.clock.now();
    const id = this._generateId(ts);

    const session = new Session({
      id: id,
      createdAt: ts,
      expiresAt: ts + (opts.ttl || this.cfg.defaultTTL),
      role: opts.role,
      domain: opts.domain,
      locale: opts.locale,
      timezone: opts.timezone,
      context: opts.context,
      meta: opts.meta,
      userAgent: opts.userAgent,
      source: opts.source,
      historyLimit: opts.historyLimit
    });

    // Enforce max sessions
    if (this._sessions.size >= this.cfg.maxSessions) {
      this._evictOldest();
    }

    this._sessions.set(id, session);
    this._stats.created += 1;

    // Auto-activate if no active session
    if (!this._activeSessionId) {
      this.activate(id);
    }

    this._persistAsync();

    return session;
  }

  get(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  getActive() {
    if (!this._activeSessionId) return null;
    return this._sessions.get(this._activeSessionId) || null;
  }

  activate(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;

    const ts = this.clock.now();

    // Check expiration
    if (session.isExpired(ts)) {
      session.expire();
      this._stats.expired += 1;
      return null;
    }

    // Deactivate previous
    if (this._activeSessionId && this._activeSessionId !== sessionId) {
      const prev = this._sessions.get(this._activeSessionId);
      if (prev) prev.pause();
    }

    // Activate
    session.activate(ts);
    this._activeSessionId = sessionId;

    this._persistAsync();

    return session;
  }

  close(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return false;

    session.close();
    this._stats.closed += 1;

    if (this._activeSessionId === sessionId) {
      this._activeSessionId = null;
    }

    this._sessions.delete(sessionId);

    this._persistAsync();

    return true;
  }

  /* =========================================================
     CONTEXT HELPERS
  ========================================================= */

  getContext() {
    const session = this.getActive();
    if (!session) return null;
    return session.getContext();
  }

  setContext(key, value) {
    const session = this.getActive();
    if (!session) return false;
    session.setContext(key, value);
    this._persistAsync();
    return true;
  }

  /* =========================================================
     DATA HELPERS
  ========================================================= */

  getData(key) {
    const session = this.getActive();
    if (!session) return undefined;
    return session.get(key);
  }

  setData(key, value) {
    const session = this.getActive();
    if (!session) return false;
    session.set(key, value);
    this._persistAsync();
    return true;
  }

  /* =========================================================
     HISTORY HELPERS
  ========================================================= */

  addToHistory(entry) {
    const session = this.getActive();
    if (!session) return false;
    session.addHistory(entry);
    return true;
  }

  recordCommand(command, result) {
    const session = this.getActive();
    if (!session) return false;

    session.addHistory({
      type: "COMMAND",
      command: command?.intent || command,
      result: result?.ok ? "OK" : "FAIL",
      code: result?.code
    });

    session.incrementStat("commands");
    if (!result?.ok) {
      session.incrementStat("errors");
    }

    return true;
  }

  recordDecision(decision) {
    const session = this.getActive();
    if (!session) return false;

    session.addHistory({
      type: "DECISION",
      decisionId: decision?.id,
      status: decision?.status
    });

    session.incrementStat("decisions");

    return true;
  }

  /* =========================================================
     TOUCH (extend TTL)
  ========================================================= */

  touch(sessionId = null) {
    const id = sessionId || this._activeSessionId;
    if (!id) return false;

    const session = this._sessions.get(id);
    if (!session) return false;

    const ts = this.clock.now();
    session.lastActiveAt = ts;
    session.expiresAt = ts + this.cfg.defaultTTL;

    this._persistAsync();

    return true;
  }

  /* =========================================================
     QUERIES
  ========================================================= */

  list() {
    const result = [];
    for (const [id, session] of this._sessions) {
      result.push({
        id: id,
        state: session.state,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt,
        isActive: id === this._activeSessionId
      });
    }
    return result;
  }

  count() {
    return this._sessions.size;
  }

  getStats() {
    return {
      ...this._stats,
      active: this._sessions.size,
      currentSessionId: this._activeSessionId
    };
  }

  /* =========================================================
     CLEANUP
  ========================================================= */

  _startCleanup() {
    if (this._cleanupTimer) return;

    this._cleanupTimer = setInterval(() => {
      this._cleanup();
    }, this.cfg.cleanupInterval);
  }

  _stopCleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  _cleanup() {
    const ts = this.clock.now();
    const toRemove = [];

    for (const [id, session] of this._sessions) {
      if (session.isExpired(ts)) {
        session.expire();
        this._stats.expired += 1;
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this._sessions.delete(id);
      if (this._activeSessionId === id) {
        this._activeSessionId = null;
      }
    }

    if (toRemove.length > 0) {
      this._persistAsync();
    }
  }

  _evictOldest() {
    let oldest = null;
    let oldestTs = Infinity;

    for (const [id, session] of this._sessions) {
      if (session.lastActiveAt < oldestTs && id !== this._activeSessionId) {
        oldest = id;
        oldestTs = session.lastActiveAt;
      }
    }

    if (oldest) {
      this._sessions.delete(oldest);
    }
  }

  /* =========================================================
     PERSISTENCE
  ========================================================= */

  _persistAsync() {
    if (!this.cfg.persistSessions || !this.store) return;

    // Debounced save
    if (this._saveTimeout) return;

    this._saveTimeout = setTimeout(() => {
      this._saveSessions().catch(() => {});
      this._saveTimeout = null;
    }, 100);
  }

  async _saveSessions() {
    if (!this.store) return;

    const data = {
      activeSessionId: this._activeSessionId,
      sessions: []
    };

    for (const [id, session] of this._sessions) {
      // Don't persist closed or expired
      if (session.state !== SESSION_STATE.CLOSED && session.state !== SESSION_STATE.EXPIRED) {
        data.sessions.push(session.toJSON());
      }
    }

    await this.store.set(this._storeKey, data);
  }

  async _loadSessions() {
    if (!this.store) return;

    const data = await this.store.get(this._storeKey);
    if (!data) return;

    const ts = this.clock.now();

    for (const json of (data.sessions || [])) {
      const session = Session.fromJSON(json);

      // Skip expired
      if (session.isExpired(ts)) {
        continue;
      }

      this._sessions.set(session.id, session);
    }

    // Restore active session
    if (data.activeSessionId && this._sessions.has(data.activeSessionId)) {
      this._activeSessionId = data.activeSessionId;
      const active = this._sessions.get(this._activeSessionId);
      if (active && !active.isExpired(ts)) {
        active.activate(ts);
      }
    }
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  _generateId(ts) {
    return `session:${ts}:${fnv1a32(String(ts) + String(Math.random()))}`;
  }

  /* =========================================================
     ORCHESTRATOR
  ========================================================= */

  setOrchestrator(orchestrator) {
    this.orchestrator = orchestrator;
    return this;
  }
}

/* =============================================================================
   FACTORY
============================================================================= */

export function createSessionManager(opts = {}) {
  return new SessionManager(opts);
}

/* =============================================================================
   EXPORTS
============================================================================= */

export {
  SESSION_MANAGER_VERSION
};

export default SessionManager;