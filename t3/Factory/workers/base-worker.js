// t3/Factory/workers/base-worker.js
// Base Worker - Perusluokka kaikille workereille

export const WORKER_STATE = {
  IDLE: "IDLE",
  BUSY: "BUSY",
  ERROR: "ERROR"
};

export class BaseWorker {
  constructor(options = {}) {
    this._clock = options.clock;
    this._eventBus = options.eventBus || null;
    this._name = options.name || "BaseWorker";
    this._state = WORKER_STATE.IDLE;
    this._taskCount = 0;
    this._errorCount = 0;
  }

  getName() {
    return this._name;
  }

  getState() {
    return this._state;
  }

  getStats() {
    return {
      name: this._name,
      state: this._state,
      taskCount: this._taskCount,
      errorCount: this._errorCount
    };
  }

  _emit(eventType, payload) {
    if (this._eventBus) {
      this._eventBus.emit(eventType, {
        worker: this._name,
        ...payload
      });
    }
  }

  async _runTask(taskName, executor) {
    if (this._state === WORKER_STATE.BUSY) {
      return { ok: false, error: "Worker busy" };
    }

    this._state = WORKER_STATE.BUSY;
    const startedAt = this._clock.now();

    this._emit("FACTORY:WORKER_STARTED", { task: taskName, startedAt });

    try {
      const result = await executor();
      
      const finishedAt = this._clock.now();
      this._taskCount++;
      this._state = WORKER_STATE.IDLE;

      this._emit("FACTORY:WORKER_COMPLETED", {
        task: taskName,
        durationMs: finishedAt - startedAt,
        success: true
      });

      return {
        ok: true,
        ...result,
        durationMs: finishedAt - startedAt
      };

    } catch (err) {
      const finishedAt = this._clock.now();
      this._errorCount++;
      this._state = WORKER_STATE.ERROR;

      this._emit("FACTORY:WORKER_FAILED", {
        task: taskName,
        error: err.message,
        durationMs: finishedAt - startedAt
      });

      this._state = WORKER_STATE.IDLE;

      return {
        ok: false,
        error: err.message,
        durationMs: finishedAt - startedAt
      };
    }
  }
}

export function createBaseWorker(options) {
  return new BaseWorker(options);
}

export default BaseWorker;