// k1/Ydin/pipeline-audit.js
// AF51 Next-Gen — Pipeline Audit
// Immutable per-pipeline audit trail; feeds into AuditLedger.

export class PipelineAudit {
  constructor(opts = {}) {
    this._records  = [];
    this._clock    = opts.clock || null;
    this._traceId  = opts.traceId || null;
    this._maxRecords = opts.maxRecords || 1000;
  }

  record(phase, event, payload) {
    if (this._records.length >= this._maxRecords) {
      this._records.shift();   // drop oldest
    }
    const entry = {
      seq:     this._records.length,
      traceId: this._traceId,
      phase,
      event,
      payload: payload || {},
      at:      this._clock ? this._clock.now() : Date.now(),
    };
    this._records.push(entry);
    return entry;
  }

  getRecords(phase) {
    if (phase) return this._records.filter(r => r.phase === phase);
    return this._records.slice();
  }

  getSummary() {
    const phases = {};
    for (const r of this._records) {
      if (!phases[r.phase]) phases[r.phase] = { count: 0, events: [] };
      phases[r.phase].count++;
      phases[r.phase].events.push(r.event);
    }
    return { traceId: this._traceId, totalEntries: this._records.length, phases };
  }

  export() {
    return { traceId: this._traceId, records: this._records.slice() };
  }
}

export function createPipelineAudit(opts) {
  return new PipelineAudit(opts);
}

export default PipelineAudit;
