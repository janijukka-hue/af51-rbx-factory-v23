// t3/Factory/memory/work-memory-ring.js
// Work Memory Ring - Circular buffer for work items

import { fnv1a32 } from "../core/factory-utils.js";

export class WorkMemoryRing {
  constructor(options = {}) {
    this._clock = options.clock;
    this._capacity = options.capacity || 500;
    this._buffer = [];
    this._head = 0;
  }

  push(item) {
    const entry = {
      id: `work_${this._clock?.now() || Date.now()}`,
      ...item,
      timestamp: this._clock?.now() || Date.now()
    };

    if (this._buffer.length < this._capacity) {
      this._buffer.push(entry);
    } else {
      this._buffer[this._head] = entry;
      this._head = (this._head + 1) % this._capacity;
    }

    return entry.id;
  }

  getRecent(count = 20) {
    const sorted = [...this._buffer].sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, count);
  }

  getByTraceId(traceId) {
    return this._buffer.filter(e => e.traceId === traceId);
  }

  search(query) {
    const lower = query.toLowerCase();
    return this._buffer.filter(e => {
      const summary = (e.summary || "").toLowerCase();
      const phase = (e.phase || "").toLowerCase();
      return summary.includes(lower) || phase.includes(lower);
    });
  }

  clear() {
    this._buffer = [];
    this._head = 0;
  }

  getStats() {
    return {
      count: this._buffer.length,
      capacity: this._capacity,
      utilization: this._buffer.length / this._capacity
    };
  }
}

export function createWorkMemoryRing(options) {
  return new WorkMemoryRing(options);
}

export default WorkMemoryRing;