// k1/alx/core/Memory.js
// ALX Local Memory - Ring Buffer with TTL
// NOTE: This is L1 session memory, NOT the persistent CoreMemory (k1/Ydin)
// Hash-chain is valid only within current buffer window.

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

var MEMORY_TYPE = {
  SESSION: "SESSION",
  CONTEXT: "CONTEXT",
  RESULT: "RESULT",
  ERROR: "ERROR"
};

function Memory(options) {
  if (!options) {
    options = {};
  }
  
  this._clock = options.clock || null;
  this._limit = options.limit || 500;
  this._ttlMs = options.ttlMs || 300000;
  this._debug = options.debug || false;
  
  this._buffer = [];
  this._hashChain = null;
  this._sequence = 0;
  this._writeCount = 0;
  this._readCount = 0;
}

Memory.prototype._now = function() {
  // TTL uses real time, not tick clock
  return Date.now();
};

Memory.prototype._tickNow = function() {
  return this._clock ? this._clock.now() : Date.now();
};

Memory.prototype._generateId = function() {
  var ts = this._tickNow();
  this._sequence++;
  var seed = "mem:" + ts + ":" + this._sequence + ":" + this._buffer.length;
  return "mem_" + ts + "_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

Memory.prototype._computeHash = function(entry) {
  var content = JSON.stringify({
    type: entry.type,
    data: entry.data,
    metadata: entry.metadata,
    timestamp: entry.timestamp,
    prevHash: entry.prevHash
  });
  return fnv1a32(content).toString(16).padStart(8, "0");
};

Memory.prototype.write = function(type, data, metadata) {
  var entry = {
    id: this._generateId(),
    type: type || MEMORY_TYPE.CONTEXT,
    data: data,
    metadata: metadata || {},
    timestamp: this._now(),
    tickTime: this._tickNow(),
    prevHash: this._hashChain
  };
  
  entry.hash = this._computeHash(entry);
  this._hashChain = entry.hash;
  
  this._buffer.push(entry);
  this._writeCount++;
  
  if (this._buffer.length > this._limit) {
    this._compact();
  }
  
  return { ok: true, id: entry.id, hash: entry.hash };
};

Memory.prototype.read = function(id) {
  for (var i = 0; i < this._buffer.length; i++) {
    if (this._buffer[i].id === id) {
      this._readCount++;
      return this._buffer[i];
    }
  }
  return null;
};

Memory.prototype.query = function(options) {
  if (!options) {
    options = {};
  }
  
  var type = options.type;
  var text = options.text;
  var limit = options.limit || 10;
  var since = options.since;
  
  var results = this._buffer.slice();
  
  // Filter expired entries
  var now = this._now();
  var ttl = this._ttlMs;
  results = results.filter(function(e) {
    return now - e.timestamp <= ttl;
  });
  
  if (type) {
    results = results.filter(function(e) {
      return e.type === type;
    });
  }
  
  if (text) {
    var textLower = text.toLowerCase();
    results = results.filter(function(e) {
      var dataStr = JSON.stringify(e.data).toLowerCase();
      return dataStr.indexOf(textLower) !== -1;
    });
  }
  
  if (since) {
    results = results.filter(function(e) {
      return e.timestamp >= since;
    });
  }
  
  this._readCount++;
  
  return results.slice(-limit);
};

Memory.prototype.getRecent = function(count) {
  if (!count) count = 10;
  
  var now = this._now();
  var ttl = this._ttlMs;
  var valid = this._buffer.filter(function(e) {
    return now - e.timestamp <= ttl;
  });
  
  return valid.slice(-count);
};

Memory.prototype.verify = function() {
  if (this._buffer.length === 0) {
    return { valid: true, errors: [] };
  }
  
  var errors = [];
  var prevHash = null;
  
  for (var i = 0; i < this._buffer.length; i++) {
    var entry = this._buffer[i];
    
    if (i > 0 && entry.prevHash !== prevHash) {
      errors.push({ index: i, error: "Hash chain broken" });
    }
    
    var computed = this._computeHash(entry);
    if (computed !== entry.hash) {
      errors.push({ index: i, error: "Hash mismatch" });
    }
    
    prevHash = entry.hash;
  }
  
  return { valid: errors.length === 0, errors: errors };
};

Memory.prototype.getStats = function() {
  var now = this._now();
  var ttl = this._ttlMs;
  var validCount = 0;
  
  for (var i = 0; i < this._buffer.length; i++) {
    if (now - this._buffer[i].timestamp <= ttl) {
      validCount++;
    }
  }
  
  return {
    bufferSize: this._buffer.length,
    validEntries: validCount,
    expiredEntries: this._buffer.length - validCount,
    limit: this._limit,
    ttlMs: this._ttlMs,
    writeCount: this._writeCount,
    readCount: this._readCount,
    hashChain: this._hashChain ? this._hashChain.slice(0, 8) + "..." : null
  };
};

Memory.prototype.clear = function() {
  this._buffer = [];
  this._hashChain = null;
  this._sequence = 0;
};

Memory.prototype._compact = function() {
  var now = this._now();
  var ttl = this._ttlMs;
  
  // First remove expired
  this._buffer = this._buffer.filter(function(e) {
    return now - e.timestamp <= ttl;
  });
  
  // Then remove oldest if still over limit
  if (this._buffer.length > this._limit) {
    var toRemove = Math.floor(this._limit * 0.2);
    this._buffer = this._buffer.slice(toRemove);
  }
  
  // Note: Hash chain is now broken for compacted entries
  // This is acceptable for L1 ring buffer
};

function createMemory(options) {
  return new Memory(options);
}

export { Memory, createMemory, MEMORY_TYPE };
export default Memory;