// t3/Factory/pipeline/base-phase.js
// Base Phase - Perusluokka kaikille vaiheille

export class BasePhase {
  constructor(name, options = {}) {
    this._name = name;
    this._clock = options.clock;
    this._eventBus = options.eventBus || null;
    this._config = options.config || {};
  }

  getName() {
    return this._name;
  }

  canSkip(context) {
    return false;
  }

  async run(context) {
    const startedAt = this._clock?.now() || Date.now();

    this._emit("FACTORY:PHASE_STARTED", {
      traceId: context.traceId,
      phase: this._name
    });

    if (this.canSkip(context)) {
      this._emit("FACTORY:PHASE_SKIPPED", {
        traceId: context.traceId,
        phase: this._name,
        reason: "Skipped by canSkip()"
      });

      return {
        ok: true,
        phase: this._name,
        skipped: true,
        durationMs: 0
      };
    }

    try {
      const result = await this.execute(context);
      const finishedAt = this._clock?.now() || Date.now();
      const durationMs = finishedAt - startedAt;

      context.setPhaseResult(this._name, result);
      context.recordPhaseMetrics(this._name, durationMs, { success: true });

      this._emit("FACTORY:PHASE_COMPLETED", {
        traceId: context.traceId,
        phase: this._name,
        durationMs
      });

      return {
        ok: true,
        phase: this._name,
        result,
        durationMs
      };

    } catch (err) {
      const finishedAt = this._clock?.now() || Date.now();
      const durationMs = finishedAt - startedAt;

      context.addError(this._name, err.message);
      context.recordPhaseMetrics(this._name, durationMs, { success: false, error: err.message });

      this._emit("FACTORY:PHASE_FAILED", {
        traceId: context.traceId,
        phase: this._name,
        error: err.message,
        durationMs
      });

      return {
        ok: false,
        phase: this._name,
        error: { code: err.code || "PHASE_ERROR", message: err.message },
        durationMs
      };
    }
  }

  async execute(context) {
    throw new Error("execute() must be implemented by subclass");
  }

  _emit(eventType, payload) {
    if (this._eventBus) {
      this._eventBus.emit(eventType, payload);
    }
  }
}

export function createBasePhase(name, options) {
  return new BasePhase(name, options);
}

export default BasePhase;