// m2/oliot/base-al.js
// Base AL (Autonomous Learner) - Perusluokka kaikille AL-olioille

export const AL_STATE = {
  // Alkuperäiset
  DORMANT:    "DORMANT",    // Luotu mutta ei aktivoitu
  ACTIVE:     "ACTIVE",     // Valmis vastaanottamaan töitä
  WORKING:    "WORKING",    // Suorittaa tehtävää
  PAUSED:     "PAUSED",     // Väliaikaisesti pysäytetty
  ERROR:      "ERROR",      // Virhetila — vaatii recovery:n

  // Muistilistan lifecycle-tilat
  CREATED:    "CREATED",    // Spawnauksen jälkeen, ennen aktivointia
  IDLE:       "IDLE",       // Aktivoitu, ei töitä jonossa
  ASSIGNED:   "ASSIGNED",   // Tehtävä osoitettu, ei vielä käynnissä
  BLOCKED:    "BLOCKED",    // Odottaa resurssia tai lupaa
  TERMINATED: "TERMINATED"  // Pysyvästi lopetettu
};

// Sallitut tilasiirtymät — kuka saa siirtää
export var AL_TRANSITION_RULES = {
  CREATED:    ["IDLE",     "TERMINATED"],
  IDLE:       ["ASSIGNED", "PAUSED", "TERMINATED"],
  ASSIGNED:   ["WORKING",  "BLOCKED", "IDLE", "TERMINATED"],
  WORKING:    ["IDLE",     "BLOCKED", "ERROR", "PAUSED", "TERMINATED"],
  PAUSED:     ["IDLE",     "ASSIGNED", "TERMINATED"],
  BLOCKED:    ["ASSIGNED", "IDLE",    "ERROR", "TERMINATED"],
  ERROR:      ["IDLE",     "TERMINATED"],
  // Legacy-tilat pidetään yhteensopivuuden vuoksi
  DORMANT:    ["ACTIVE",   "CREATED", "TERMINATED"],
  ACTIVE:     ["WORKING",  "PAUSED",  "IDLE", "ERROR", "TERMINATED"],
  TERMINATED: []  // Terminaali
};

export const AL_ROLE = {
  WORKER: "WORKER",
  GUARDIAN: "GUARDIAN",
  COORDINATOR: "COORDINATOR",
  SPECIALIST: "SPECIALIST"
};

export class BaseAL {
  constructor(options = {}) {
    this._clock = options.clock;
    this._id = options.id || `al_${this._clock?.now() || Date.now()}`;
    this._name = options.name || "Unnamed AL";
    this._role = options.role || AL_ROLE.WORKER;
    this._owner = options.owner || null;

    this._state = AL_STATE.CREATED;
    this._createdAt   = this._clock?.now() || Date.now();
    this._activatedAt = null;
    this._terminatedAt = null;
    this._spawnedBy   = options.spawnedBy || null;   // Kuka spawnasi
    this._terminatedBy = null;                        // Kuka tappoi

    this._memory = [];
    this._maxMemory = options.maxMemory || 100;

    this._skills      = new Map();
    this._tasks       = [];
    this._currentTask = null;

    // Lifecycle audit-loki — tilasiirtymät näkyvissä
    this._lifecycleLog = [];
    this._maxLifecycleLog = 50;

    this._stats = {
      tasksCompleted:  0,
      tasksFailed:     0,
      totalWorkTimeMs: 0
    };
  }

  getId() {
    return this._id;
  }

  getName() {
    return this._name;
  }

  getRole() {
    return this._role;
  }

  getState() {
    return this._state;
  }

  // ── _transition(nextState, actor, reason) ─────────────────
  // Hallittu tilasiirtymä — tarkistaa AL_TRANSITION_RULES.
  // Kirjoittaa lifecycle-lokin.
  _transition(nextState, actor, reason) {
    var allowed = AL_TRANSITION_RULES[this._state] || [];
    if (allowed.indexOf(nextState) === -1) {
      return { ok: false, reason: "Siirtymä " + this._state + " → " + nextState + " ei sallittu." };
    }
    var prev = this._state;
    this._state = nextState;
    var entry = {
      ts:     this._clock?.now() || Date.now(),
      prev:   prev,
      next:   nextState,
      actor:  actor  || "self",
      reason: reason || null
    };
    this._lifecycleLog.push(entry);
    if (this._lifecycleLog.length > this._maxLifecycleLog) {
      this._lifecycleLog = this._lifecycleLog.slice(-this._maxLifecycleLog);
    }
    this._addMemory("STATE_TRANSITION", entry);
    return { ok: true, prev: prev, state: nextState };
  }

  // ── terminate(actor, reason) ───────────────────────────────
  // Pysyvä lopetus — ei voi peruuttaa.
  // Vain spawneri tai coordinator saa kutsua.
  terminate(actor, reason) {
    if (this._state === AL_STATE.TERMINATED) {
      return { ok: false, reason: "AL on jo terminoitu." };
    }
    var result = this._transition(AL_STATE.TERMINATED, actor, reason);
    if (result.ok) {
      this._terminatedAt = this._clock?.now() || Date.now();
      this._terminatedBy = actor || "unknown";
    }
    return result;
  }

  // ── block(reason) / unblock() ──────────────────────────────
  block(reason) {
    return this._transition(AL_STATE.BLOCKED, "system", reason || "resource_wait");
  }

  unblock(actor) {
    if (this._state !== AL_STATE.BLOCKED) {
      return { ok: false, reason: "AL ei ole BLOCKED-tilassa." };
    }
    return this._transition(AL_STATE.ASSIGNED, actor || "system", "unblocked");
  }

  activate() {
    // Tukee sekä CREATED → IDLE että legacy DORMANT → ACTIVE
    var from = this._state;
    var to   = from === AL_STATE.DORMANT ? AL_STATE.ACTIVE : AL_STATE.IDLE;
    var result = this._transition(to, "system", "activation");
    if (!result.ok) return { ok: false, reason: result.reason };

    this._activatedAt = this._clock?.now() || Date.now();
    this._addMemory("ACTIVATED", {});

    return { ok: true, activatedAt: this._activatedAt };
  }

  deactivate() {
    var result = this._transition(AL_STATE.DORMANT, "system", "deactivation");
    if (!result.ok) return { ok: false, reason: result.reason };
    this._addMemory("DEACTIVATED", {});
    return { ok: true };
  }

  pause() {
    return this._transition(AL_STATE.PAUSED, "system", "pause");
  }

  resume() {
    if (this._state !== AL_STATE.PAUSED) return { ok: false, reason: "Not paused" };
    var to = this._currentTask ? AL_STATE.WORKING : AL_STATE.IDLE;
    return this._transition(to, "system", "resume");
  }

  registerSkill(name, handler) {
    this._skills.set(name, handler);
  }

  hasSkill(name) {
    return this._skills.has(name);
  }

  getSkills() {
    return Array.from(this._skills.keys());
  }

  async assignTask(task) {
    var assignable = [AL_STATE.ACTIVE, AL_STATE.IDLE, AL_STATE.WORKING];
    if (assignable.indexOf(this._state) === -1) {
      return { ok: false, reason: "AL ei voi ottaa tehtävää tilassa " + this._state };
    }

    var newTask = Object.assign({}, task, {
      id:         task.id || "task_" + (this._clock?.now() || Date.now()),
      assignedAt: this._clock?.now() || Date.now(),
      status:     "PENDING",
      assignedBy: task.assignedBy || "orchestrator"
    });
    this._tasks.push(newTask);

    // Siirry ASSIGNED-tilaan jos IDLE
    if (this._state === AL_STATE.IDLE) {
      this._transition(AL_STATE.ASSIGNED, task.assignedBy || "orchestrator", "task_assigned");
    }

    return { ok: true, taskId: newTask.id };
  }

  async executeNextTask() {
    if (this._state !== AL_STATE.ACTIVE) {
      return { ok: false, reason: "AL not active" };
    }

    const task = this._tasks.find(t => t.status === "PENDING");
    if (!task) {
      return { ok: false, reason: "No pending tasks" };
    }

    this._state = AL_STATE.WORKING;
    this._currentTask = task;
    task.status = "RUNNING";
    task.startedAt = this._clock?.now() || Date.now();

    try {
      const result = await this._executeTask(task);
      
      task.status = result.ok ? "COMPLETED" : "FAILED";
      task.finishedAt = this._clock?.now() || Date.now();
      task.result = result;

      if (result.ok) {
        this._stats.tasksCompleted++;
      } else {
        this._stats.tasksFailed++;
      }

      this._stats.totalWorkTimeMs += task.finishedAt - task.startedAt;

      this._addMemory("TASK_COMPLETED", {
        taskId: task.id,
        success: result.ok,
        durationMs: task.finishedAt - task.startedAt
      });

      this._state = AL_STATE.ACTIVE;
      this._currentTask = null;

      return result;

    } catch (err) {
      task.status = "FAILED";
      task.error = err.message;
      this._stats.tasksFailed++;
      this._state = AL_STATE.ERROR;
      this._currentTask = null;

      return { ok: false, error: err.message };
    }
  }

  async _executeTask(task) {
    const skillName = task.skill || task.type;
    const handler = this._skills.get(skillName);

    if (!handler) {
      return { ok: false, error: `Unknown skill: ${skillName}` };
    }

    return await handler(task, this);
  }

  getStats() {
    return {
      id:           this._id,
      name:         this._name,
      role:         this._role,
      state:        this._state,
      createdAt:    this._createdAt,
      activatedAt:  this._activatedAt,
      terminatedAt: this._terminatedAt,
      spawnedBy:    this._spawnedBy,
      terminatedBy: this._terminatedBy,
      uptimeMs:     this._activatedAt ? (this._clock?.now() || Date.now()) - this._activatedAt : 0,
      pendingTasks: this._tasks.filter(t => t.status === "PENDING").length,
      skills:       this.getSkills(),
      ...this._stats
    };
  }

  getLifecycleLog(limit) {
    return this._lifecycleLog.slice(-(limit || 20));
  }

  isTerminated() {
    return this._state === AL_STATE.TERMINATED;
  }

  isAvailable() {
    return this._state === AL_STATE.IDLE || this._state === AL_STATE.ACTIVE;
  }

  _addMemory(type, data) {
    this._memory.push({
      type,
      data,
      timestamp: this._clock?.now() || Date.now()
    });

    if (this._memory.length > this._maxMemory) {
      this._memory.shift();
    }
  }

  getMemory(count = 20) {
    return this._memory.slice(-count);
  }
}

export function createBaseAL(options) {
  return new BaseAL(options);
}

export default BaseAL;