// t3/Factory/memory/factory-audit-ring.js
// Factory Audit Ring - Tamper-evident audit log

import { fnv1a32 } from "../core/factory-utils.js";

export class FactoryAuditRing {
  constructor(options = {}) {
    this._clock = options.clock;
    this._maxEntries = options.maxEntries || 5000;
    this._entries = [];
    this._lastHash = "0000000000000000";
  }

  record(entry) {
    const timestamp = this._clock ? this._clock.now() : Date.now();
    
    const content = JSON.stringify({
      action: entry.action,
      data: entry.data,
      owner: entry.owner,
      timestamp,
      prevHash: this._lastHash
    });

    const hash = fnv1a32(content).toString(16).padStart(8, "0");

    const auditEntry = {
      id: `aud_${timestamp}`,
      action: entry.action,
      data: entry.data,
      owner: entry.owner,
      timestamp,
      prevHash: this._lastHash,
      hash
    };

    this._lastHash = hash;
    this._entries.push(auditEntry);

    if (this._entries.length > this._maxEntries) {
      this._entries.shift();
    }

    return auditEntry.id;
  }

  append(type, meta) {
    return this.record({
      action: type,
      data: meta,
      owner: meta.owner || "system"
    });
  }

  getAll() {
    return [...this._entries];
  }

  getRecent(count) {
    return this._entries.slice(-count);
  }

  verify() {
    let prevHash = "0000000000000000";
    
    for (const entry of this._entries) {
      if (entry.prevHash !== prevHash) {
        return { valid: false, brokenAt: entry.id };
      }
      
      const content = JSON.stringify({
        action: entry.action,
        data: entry.data,
        owner: entry.owner,
        timestamp: entry.timestamp,
        prevHash: entry.prevHash
      });
      
      const expectedHash = fnv1a32(content).toString(16).padStart(8, "0");
      
      if (entry.hash !== expectedHash) {
        return { valid: false, brokenAt: entry.id };
      }
      
      prevHash = entry.hash;
    }
    
    return { valid: true };
  }

  export() {
    return {
      entries: [...this._entries],
      hash: this._lastHash,
      exportedAt: this._clock ? this._clock.now() : Date.now()
    };
  }

  getStats() {
    return {
      count: this._entries.length,
      maxEntries: this._maxEntries,
      lastHash: this._lastHash
    };
  }
}

export function createFactoryAuditRing(options) {
  return new FactoryAuditRing(options);
}

export default FactoryAuditRing;