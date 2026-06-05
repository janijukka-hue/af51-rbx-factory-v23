// m2/Ohjaus/entity-manager.js
// M2 Entity Manager - AL-olioiden hallinta
// - Entity lifecycle
// - Entity registry
// - State management
// - Communication between entities

import { fnv1a32 } from "../../k1/Ydin/alydin.js";
import { RING_TIER } from "../../k1/Ydin/muisti.js";
import { DECISION_PRIORITY } from "../../k1/Ydin/paatos.js";

const ENTITY_MANAGER_VERSION = "1.0.0";

/* =============================================================================
   ENTITY STATE
============================================================================= */

export const ENTITY_STATE = {
  CREATED: "CREATED",
  INITIALIZING: "INITIALIZING",
  IDLE: "IDLE",
  ACTIVE: "ACTIVE",
  BUSY: "BUSY",
  PAUSED: "PAUSED",
  ERROR: "ERROR",
  TERMINATED: "TERMINATED"
};

/* =============================================================================
   ENTITY TYPE
============================================================================= */

export const ENTITY_TYPE = {
  WORKER: "WORKER",
  OBSERVER: "OBSERVER",
  GUARDIAN: "GUARDIAN",
  COORDINATOR: "COORDINATOR",
  SPECIALIST: "SPECIALIST",
  CUSTOM: "CUSTOM"
};

/* =============================================================================
   ENTITY PRIORITY
============================================================================= */

export const ENTITY_PRIORITY = {
  CRITICAL: 10,
  HIGH: 8,
  NORMAL: 5,
  LOW: 3,
  BACKGROUND: 1
};

/* =============================================================================
   BASE ENTITY
============================================================================= */

export class Entity {

  constructor(opts = {}) {
    this.id = opts.id || null;
    this.name = opts.name || "Unnamed Entity";
    this.type = opts.type || ENTITY_TYPE.WORKER;
    this.priority = opts.priority || ENTITY_PRIORITY.NORMAL;

    this.state = ENTITY_STATE.CREATED;
    this.createdAt = opts.createdAt || 0;
    this.updatedAt = opts.createdAt || 0;

    // Capabilities
    this.capabilities = opts.capabilities || [];

    // Configuration
    this.config = {
      autoStart: opts.autoStart !== false,
      energyCost: opts.energyCost || 1,
      timeout: opts.timeout || 30000,
      retries: opts.retries || 3,
      ...opts.config
    };

    // Runtime state
    this.runtime = {
      taskCount: 0,
      successCount: 0,
      errorCount: 0,
      lastTaskAt: null,
      lastError: null,
      currentTask: null
    };

    // Metadata
    this.meta = {
      description: opts.description || "",
      version: opts.version || "1.0.0",
      author: opts.author || "system",
      tags: opts.tags || [],
      ...opts.meta
    };

    // Relationships
    this.relationships = {
      parentId: opts.parentId || null,
      childIds: [],
      siblingIds: [],
      dependencies: opts.dependencies || []
    };

    // Event handlers
    this._handlers = new Map();

    // Manager reference
    this._manager = null;
  }

  /* =========================================================
     LIFECYCLE
  ========================================================= */

  async initialize() {
    if (this.state !== ENTITY_STATE.CREATED) {
      throw new Error(`Cannot initialize entity in state: ${this.state}`);
    }

    this.state = ENTITY_STATE.INITIALIZING;

    try {
      await this.onInitialize();
      this.state = ENTITY_STATE.IDLE;
      this._emit("initialized", { entityId: this.id });
      return true;
    } catch (err) {
      this.state = ENTITY_STATE.ERROR;
      this.runtime.lastError = err.message;
      this._emit("error", { entityId: this.id, error: err.message });
      throw err;
    }
  }

  async activate() {
    if (this.state !== ENTITY_STATE.IDLE && this.state !== ENTITY_STATE.PAUSED) {
      throw new Error(`Cannot activate entity in state: ${this.state}`);
    }

    this.state = ENTITY_STATE.ACTIVE;
    this.updatedAt = Date.now();

    await this.onActivate();
    this._emit("activated", { entityId: this.id });

    return true;
  }

  async pause() {
    if (this.state !== ENTITY_STATE.ACTIVE && this.state !== ENTITY_STATE.IDLE) {
      return false;
    }

    this.state = ENTITY_STATE.PAUSED;
    this.updatedAt = Date.now();

    await this.onPause();
    this._emit("paused", { entityId: this.id });

    return true;
  }

  async terminate() {
    if (this.state === ENTITY_STATE.TERMINATED) {
      return false;
    }

    const prevState = this.state;
    this.state = ENTITY_STATE.TERMINATED;
    this.updatedAt = Date.now();

    await this.onTerminate();
    this._emit("terminated", { entityId: this.id, previousState: prevState });

    return true;
  }

  /* =========================================================
     LIFECYCLE HOOKS (Override in subclasses)
  ========================================================= */

  async onInitialize() {
    // Override in subclass
  }

  async onActivate() {
    // Override in subclass
  }

  async onPause() {
    // Override in subclass
  }

  async onTerminate() {
    // Override in subclass
  }

  /* =========================================================
     TASK EXECUTION
  ========================================================= */

  async execute(task) {
    if (this.state !== ENTITY_STATE.ACTIVE && this.state !== ENTITY_STATE.IDLE) {
      throw new Error(`Entity not ready for execution (state: ${this.state})`);
    }

    const prevState = this.state;
    this.state = ENTITY_STATE.BUSY;
    this.runtime.currentTask = task;
    this.runtime.taskCount += 1;
    this.runtime.lastTaskAt = Date.now();

    this._emit("task:started", { entityId: this.id, task });

    try {
      const result = await this.onExecute(task);

      this.runtime.successCount += 1;
      this.state = prevState === ENTITY_STATE.IDLE ? ENTITY_STATE.IDLE : ENTITY_STATE.ACTIVE;
      this.runtime.currentTask = null;

      this._emit("task:completed", { entityId: this.id, task, result });

      return {
        ok: true,
        result,
        entityId: this.id
      };

    } catch (err) {
      this.runtime.errorCount += 1;
      this.runtime.lastError = err.message;
      this.state = prevState === ENTITY_STATE.IDLE ? ENTITY_STATE.IDLE : ENTITY_STATE.ACTIVE;
      this.runtime.currentTask = null;

      this._emit("task:failed", { entityId: this.id, task, error: err.message });

      return {
        ok: false,
        error: err.message,
        entityId: this.id
      };
    }
  }

  async onExecute(task) {
    // Override in subclass
    return { message: "Base entity executed", task };
  }

  /* =========================================================
     CAPABILITIES
  ========================================================= */

  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  addCapability(capability) {
    if (!this.capabilities.includes(capability)) {
      this.capabilities.push(capability);
    }
    return this;
  }

  removeCapability(capability) {
    this.capabilities = this.capabilities.filter(c => c !== capability);
    return this;
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, []);
    }
    this._handlers.get(event).push(handler);
    return this;
  }

  off(event, handler) {
    if (!this._handlers.has(event)) return;
    const handlers = this._handlers.get(event);
    this._handlers.set(event, handlers.filter(h => h !== handler));
    return this;
  }

  _emit(event, data = {}) {
    const handlers = this._handlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        // Ignore handler errors
      }
    }

    // Notify manager
    if (this._manager) {
      this._manager._onEntityEvent(this.id, event, data);
    }
  }

  /* =========================================================
     COMMUNICATION
  ========================================================= */

  async sendMessage(targetId, message) {
    if (!this._manager) {
      throw new Error("Entity not registered with manager");
    }
    return this._manager.sendMessage(this.id, targetId, message);
  }

  async receiveMessage(fromId, message) {
    return this.onMessage(fromId, message);
  }

  async onMessage(fromId, message) {
    // Override in subclass
    return { received: true, fromId, message };
  }

  /* =========================================================
     STATE
  ========================================================= */

  getState() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      priority: this.priority,
      capabilities: [...this.capabilities],
      runtime: { ...this.runtime },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  getStats() {
    return {
      taskCount: this.runtime.taskCount,
      successCount: this.runtime.successCount,
      errorCount: this.runtime.errorCount,
      successRate: this.runtime.taskCount > 0
        ? this.runtime.successCount / this.runtime.taskCount
        : 0
    };
  }

  /* =========================================================
     SERIALIZATION
  ========================================================= */

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      priority: this.priority,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      capabilities: this.capabilities,
      config: this.config,
      runtime: this.runtime,
      meta: this.meta,
      relationships: this.relationships
    };
  }

  static fromJSON(json, EntityClass = Entity) {
    const entity = new EntityClass({
      id: json.id,
      name: json.name,
      type: json.type,
      priority: json.priority,
      createdAt: json.createdAt,
      capabilities: json.capabilities,
      config: json.config,
      meta: json.meta,
      parentId: json.relationships?.parentId,
      dependencies: json.relationships?.dependencies
    });

    entity.state = json.state || ENTITY_STATE.CREATED;
    entity.updatedAt = json.updatedAt || json.createdAt;
    entity.runtime = json.runtime || entity.runtime;
    entity.relationships = json.relationships || entity.relationships;

    return entity;
  }
}

/* =============================================================================
   ENTITY MANAGER
============================================================================= */

export class EntityManager {

  constructor(opts = {}) {
    this.cfg = {
      prefix: opts.prefix || "m2",
      maxEntities: opts.maxEntities || 100,
      autoInitialize: opts.autoInitialize !== false,
      persistEntities: opts.persistEntities !== false,
      ...opts.config
    };

    this.clock = opts.clock || { now: () => Date.now() };
    this.store = opts.store || null;
    this.orchestrator = opts.orchestrator || null;

    // Entity registry
    this._entities = new Map();
    this._entitiesByType = new Map();
    this._entitiesByCapability = new Map();

    // Message queue
    this._messageQueue = [];

    // Event handlers
    this._eventHandlers = new Map();

    // Stats
    this._stats = {
      created: 0,
      terminated: 0,
      messagesSent: 0,
      tasksExecuted: 0
    };

    // Storage key
    this._storeKey = `${this.cfg.prefix}:entities`;
  }

  /* =========================================================
     LIFECYCLE
  ========================================================= */

  async start() {
    // Load persisted entities
    if (this.cfg.persistEntities && this.store) {
      await this._loadEntities();
    }

    return this;
  }

  async stop() {
    // Terminate all entities
    for (const entity of this._entities.values()) {
      if (entity.state !== ENTITY_STATE.TERMINATED) {
        await entity.terminate();
      }
    }

    // Persist
    if (this.cfg.persistEntities && this.store) {
      await this._saveEntities();
    }

    return this;
  }

  /* =========================================================
     ENTITY CRUD
  ========================================================= */

  async create(opts = {}) {
    const ts = this.clock.now();
    const id = opts.id || this._generateId(ts);

    // Check limit
    if (this._entities.size >= this.cfg.maxEntities) {
      throw new Error(`Max entities reached: ${this.cfg.maxEntities}`);
    }

    // Check duplicate
    if (this._entities.has(id)) {
      throw new Error(`Entity already exists: ${id}`);
    }

    const entity = new Entity({
      ...opts,
      id,
      createdAt: ts
    });

    entity._manager = this;

    // Register
    this._entities.set(id, entity);
    this._indexEntity(entity);
    this._stats.created += 1;

    // Auto-initialize
    if (this.cfg.autoInitialize) {
      await entity.initialize();
    }

    // Persist
    this._persistAsync();

    this._emitManagerEvent("entity:created", { entityId: id, entity: entity.getState() });

    return entity;
  }

  async createFromClass(EntityClass, opts = {}) {
    const ts = this.clock.now();
    const id = opts.id || this._generateId(ts);

    if (this._entities.size >= this.cfg.maxEntities) {
      throw new Error(`Max entities reached: ${this.cfg.maxEntities}`);
    }

    if (this._entities.has(id)) {
      throw new Error(`Entity already exists: ${id}`);
    }

    const entity = new EntityClass({
      ...opts,
      id,
      createdAt: ts
    });

    entity._manager = this;

    this._entities.set(id, entity);
    this._indexEntity(entity);
    this._stats.created += 1;

    if (this.cfg.autoInitialize) {
      await entity.initialize();
    }

    this._persistAsync();

    this._emitManagerEvent("entity:created", { entityId: id, entity: entity.getState() });

    return entity;
  }

  get(id) {
    return this._entities.get(id) || null;
  }

  async terminate(id) {
    const entity = this._entities.get(id);
    if (!entity) return false;

    await entity.terminate();

    this._unindexEntity(entity);
    this._entities.delete(id);
    this._stats.terminated += 1;

    this._persistAsync();

    this._emitManagerEvent("entity:terminated", { entityId: id });

    return true;
  }

  /* =========================================================
     INDEXING
  ========================================================= */

  _indexEntity(entity) {
    // By type
    if (!this._entitiesByType.has(entity.type)) {
      this._entitiesByType.set(entity.type, new Set());
    }
    this._entitiesByType.get(entity.type).add(entity.id);

    // By capability
    for (const cap of entity.capabilities) {
      if (!this._entitiesByCapability.has(cap)) {
        this._entitiesByCapability.set(cap, new Set());
      }
      this._entitiesByCapability.get(cap).add(entity.id);
    }
  }

  _unindexEntity(entity) {
    // By type
    const typeSet = this._entitiesByType.get(entity.type);
    if (typeSet) typeSet.delete(entity.id);

    // By capability
    for (const cap of entity.capabilities) {
      const capSet = this._entitiesByCapability.get(cap);
      if (capSet) capSet.delete(entity.id);
    }
  }

  /* =========================================================
     QUERIES
  ========================================================= */

  list() {
    return Array.from(this._entities.values()).map(e => e.getState());
  }

  getByType(type) {
    const ids = this._entitiesByType.get(type);
    if (!ids) return [];
    return Array.from(ids).map(id => this._entities.get(id)).filter(Boolean);
  }

  getByCapability(capability) {
    const ids = this._entitiesByCapability.get(capability);
    if (!ids) return [];
    return Array.from(ids).map(id => this._entities.get(id)).filter(Boolean);
  }

  getByState(state) {
    return Array.from(this._entities.values()).filter(e => e.state === state);
  }

  getActive() {
    return this.getByState(ENTITY_STATE.ACTIVE);
  }

  getIdle() {
    return this.getByState(ENTITY_STATE.IDLE);
  }

  findByPredicate(predicate) {
    return Array.from(this._entities.values()).filter(predicate);
  }

  count() {
    return this._entities.size;
  }

  /* =========================================================
     TASK EXECUTION
  ========================================================= */

  async executeTask(entityId, task) {
    const entity = this._entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    this._stats.tasksExecuted += 1;

    const result = await entity.execute(task);

    // Record to learning if orchestrator available
    if (this.orchestrator?.learningEngine) {
      await this.orchestrator.learningEngine.learnFromCommand(
        { id: entityId, intent: task.type || "EXECUTE" },
        result,
        { entityId, entityType: entity.type }
      );
    }

    return result;
  }

  async executeTaskByCapability(capability, task) {
    const entities = this.getByCapability(capability);
    
    // Find first available
    const available = entities.find(e => 
      e.state === ENTITY_STATE.ACTIVE || e.state === ENTITY_STATE.IDLE
    );

    if (!available) {
      throw new Error(`No available entity with capability: ${capability}`);
    }

    return this.executeTask(available.id, task);
  }

  /* =========================================================
     MESSAGING
  ========================================================= */

  async sendMessage(fromId, toId, message) {
    const sender = this._entities.get(fromId);
    const receiver = this._entities.get(toId);

    if (!sender) throw new Error(`Sender not found: ${fromId}`);
    if (!receiver) throw new Error(`Receiver not found: ${toId}`);

    this._stats.messagesSent += 1;

    const envelope = {
      id: this._generateId(this.clock.now()),
      from: fromId,
      to: toId,
      message,
      sentAt: this.clock.now()
    };

    this._emitManagerEvent("message:sent", envelope);

    const response = await receiver.receiveMessage(fromId, message);

    return {
      ok: true,
      envelope,
      response
    };
  }

  async broadcast(fromId, message, filter = {}) {
    const sender = this._entities.get(fromId);
    if (!sender) throw new Error(`Sender not found: ${fromId}`);

    let targets = Array.from(this._entities.values());

    // Filter
    if (filter.type) {
      targets = targets.filter(e => e.type === filter.type);
    }
    if (filter.capability) {
      targets = targets.filter(e => e.hasCapability(filter.capability));
    }
    if (filter.state) {
      targets = targets.filter(e => e.state === filter.state);
    }

    // Exclude sender
    targets = targets.filter(e => e.id !== fromId);

    const results = [];
    for (const target of targets) {
      try {
        const response = await target.receiveMessage(fromId, message);
        results.push({ entityId: target.id, ok: true, response });
      } catch (err) {
        results.push({ entityId: target.id, ok: false, error: err.message });
      }
    }

    this._emitManagerEvent("message:broadcast", { fromId, targetCount: targets.length });

    return results;
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  on(event, handler) {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event).push(handler);
    return this;
  }

  off(event, handler) {
    if (!this._eventHandlers.has(event)) return;
    const handlers = this._eventHandlers.get(event);
    this._eventHandlers.set(event, handlers.filter(h => h !== handler));
    return this;
  }

  _emitManagerEvent(event, data = {}) {
    const handlers = this._eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        // Ignore
      }
    }
  }

  _onEntityEvent(entityId, event, data) {
    this._emitManagerEvent(`entity:${event}`, { entityId, ...data });
  }

  /* =========================================================
     PERSISTENCE
  ========================================================= */

  _persistAsync() {
    if (!this.cfg.persistEntities || !this.store) return;

    if (this._saveTimeout) return;

    this._saveTimeout = setTimeout(() => {
      this._saveEntities().catch(() => {});
      this._saveTimeout = null;
    }, 100);
  }

  async _saveEntities() {
    if (!this.store) return;

    const data = {
      entities: []
    };

    for (const entity of this._entities.values()) {
      // Don't persist terminated entities
      if (entity.state !== ENTITY_STATE.TERMINATED) {
        data.entities.push(entity.toJSON());
      }
    }

    await this.store.set(this._storeKey, data);
  }

  async _loadEntities() {
    if (!this.store) return;

    const data = await this.store.get(this._storeKey);
    if (!data || !data.entities) return;

    for (const json of data.entities) {
      const entity = Entity.fromJSON(json);
      entity._manager = this;

      this._entities.set(entity.id, entity);
      this._indexEntity(entity);
    }
  }

  /* =========================================================
     STATS
  ========================================================= */

  getStats() {
    return {
      ...this._stats,
      entityCount: this._entities.size,
      byType: this._countByType(),
      byState: this._countByState()
    };
  }

  _countByType() {
    const counts = {};
    for (const [type, ids] of this._entitiesByType) {
      counts[type] = ids.size;
    }
    return counts;
  }

  _countByState() {
    const counts = {};
    for (const entity of this._entities.values()) {
      counts[entity.state] = (counts[entity.state] || 0) + 1;
    }
    return counts;
  }

  /* =========================================================
     HELPERS
  ========================================================= */

  _generateId(ts) {
    return `entity:${ts}:${fnv1a32(String(ts) + String(Math.random()))}`;
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

export function createEntityManager(opts = {}) {
  return new EntityManager(opts);
}

/* =============================================================================
   EXPORTS
============================================================================= */

export {
  ENTITY_MANAGER_VERSION
};

export default EntityManager;