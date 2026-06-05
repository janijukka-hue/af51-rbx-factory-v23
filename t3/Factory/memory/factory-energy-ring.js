// t3/Factory/memory/factory-energy-ring.js
// Factory Energy Ring - Execution time tracking

export class FactoryEnergyRing {
  constructor(options = {}) {
    this._clock = options.clock;
    this._maxEntries = options.maxEntries || 1000;
    this._entries = [];
    this._totals = {};
    this._activeTimers = new Map();
  }

  record(phase, durationMs, bytes = 0) {
    const entry = {
      phase,
      durationMs,
      bytes,
      timestamp: this._clock?.now() || Date.now()
    };

    this._entries.push(entry);

    if (!this._totals[phase]) {
      this._totals[phase] = { count: 0, totalMs: 0, totalBytes: 0 };
    }
    this._totals[phase].count++;
    this._totals[phase].totalMs += durationMs;
    this._totals[phase].totalBytes += bytes;

    if (this._entries.length > this._maxEntries) {
      this._entries.shift();
    }

    return entry;
  }

  startTimer(id) {
    this._activeTimers.set(id, this._clock?.now() || Date.now());
  }

  stopTimer(id, phase) {
    const startTime = this._activeTimers.get(id);
    if (!startTime) return null;

    const endTime = this._clock?.now() || Date.now();
    const durationMs = endTime - startTime;
    this._activeTimers.delete(id);

    return this.record(phase, durationMs);
  }

  getByPhase(phase, count = 50) {
    return this._entries
      .filter(e => e.phase === phase)
      .slice(-count);
  }

  getAverages() {
    const averages = {};
    for (const [phase, data] of Object.entries(this._totals)) {
      averages[phase] = {
        avgMs: data.count > 0 ? Math.round(data.totalMs / data.count) : 0,
        avgBytes: data.count > 0 ? Math.round(data.totalBytes / data.count) : 0,
        count: data.count
      };
    }
    return averages;
  }

  getTotals() {
    return { ...this._totals };
  }

  getRecent(count = 50) {
    return this._entries.slice(-count);
  }

  getStats() {
    const totalMs = this._entries.reduce((sum, e) => sum + e.durationMs, 0);
    const totalBytes = this._entries.reduce((sum, e) => sum + e.bytes, 0);

    return {
      entryCount: this._entries.length,
      maxEntries: this._maxEntries,
      totalMs,
      totalBytes,
      activeTimers: this._activeTimers.size
    };
  }
}

export function createFactoryEnergyRing(options) {
  return new FactoryEnergyRing(options);
}

export default FactoryEnergyRing;