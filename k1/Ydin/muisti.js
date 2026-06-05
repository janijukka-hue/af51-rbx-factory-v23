// k1/Ydin/muisti.js
// Kernel Core Memory - Persistent Storage
// Deterministic, auditable, hash-chain verified

var MEMORY_STORE = {
  EPISODIC: "episodic",
  SEMANTIC: "semantic",
  PROCEDURAL: "procedural"
};

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function CoreMemory(options) {
  if (!options) {
    options = {};
  }
  
  this._clock = options.clock;
  this._owner = options.owner || "system";
  
  this._stores = {
    episodic: [],
    semantic: [],
    procedural: []
  };
  
  this._indices = {
    episodic: new Map(),
    semantic: new Map(),
    procedural: new Map()
  };
  
  this._limits = {
    episodic: options.episodicLimit || 10000,
    semantic: options.semanticLimit || 5000,
    procedural: options.proceduralLimit || 1000
  };
  
  this._hashChain = null;
  // BUG FIX: per-store hash-chainit - globaali _hashChain rikkoutuu kun
  // eri storet kirjoittavat vuorotellen (episodic entry viittaa semantic prevHashiin)
  this._storeHashChains = {
    episodic:   null,
    semantic:   null,
    procedural: null
  };
  this._writeCount = 0;
  this._readCount = 0;
  this._sequence = 0;
}

CoreMemory.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

CoreMemory.prototype._generateId = function(store) {
  var ts = this._now();
  this._sequence++;
  var seed = store + ":" + ts + ":" + this._sequence;
  var prefix = store.charAt(0);
  return prefix + "_" + ts + "_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

CoreMemory.prototype._computeHash = function(entry) {
  var content = JSON.stringify({
    store: entry.store,
    content: entry.content,
    tags: entry.tags,
    metadata: entry.metadata,
    timestamp: entry.timestamp,
    prevHash: entry.prevHash
  });
  return fnv1a32(content).toString(16).padStart(8, "0");
};

CoreMemory.prototype.write = async function(options) {
  var store = options.store || MEMORY_STORE.EPISODIC;
  var content = options.content;
  var tags = options.tags || [];
  var metadata = options.metadata || {};
  
  if (!this._stores[store]) {
    return { ok: false, error: "Invalid store: " + store };
  }
  
  var entry = {
    id: this._generateId(store),
    store: store,
    content: content,
    tags: tags,
    metadata: metadata,
    timestamp: this._now(),
    prevHash: this._storeHashChains[store] !== undefined ? this._storeHashChains[store] : this._hashChain
  };
  
  entry.hash = this._computeHash(entry);
  this._hashChain = entry.hash;
  // BUG FIX: päivitetään myös per-store chain
  if (this._storeHashChains && store in this._storeHashChains) {
    this._storeHashChains[store] = entry.hash;
  }
  
  this._stores[store].push(entry);
  
  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i];
    if (!this._indices[store].has(tag)) {
      this._indices[store].set(tag, []);
    }
    this._indices[store].get(tag).push(entry.id);
  }
  
  if (this._stores[store].length > this._limits[store]) {
    this._compact(store);
  }
  
  this._writeCount++;
  
  return { ok: true, id: entry.id, hash: entry.hash };
};

CoreMemory.prototype.query = async function(options) {
  var store = options.store || MEMORY_STORE.EPISODIC;
  var tags = options.tags;
  var text = options.text;
  var limit = options.limit || 10;
  var since = options.since;
  var until = options.until;
  
  if (!this._stores[store]) {
    return [];
  }
  
  var results = this._stores[store].slice();
  
  if (tags && tags.length > 0) {
    var taggedIds = new Set();
    for (var i = 0; i < tags.length; i++) {
      var ids = this._indices[store].get(tags[i]) || [];
      for (var j = 0; j < ids.length; j++) {
        taggedIds.add(ids[j]);
      }
    }
    results = results.filter(function(e) {
      return taggedIds.has(e.id);
    });
  }
  
  if (text) {
    var textLower = text.toLowerCase();
    results = results.filter(function(e) {
      var contentStr = JSON.stringify(e.content).toLowerCase();
      return contentStr.indexOf(textLower) !== -1;
    });
  }
  
  if (since) {
    results = results.filter(function(e) {
      return e.timestamp >= since;
    });
  }
  
  if (until) {
    results = results.filter(function(e) {
      return e.timestamp <= until;
    });
  }
  
  this._readCount++;
  
  return results.slice(-limit);
};

CoreMemory.prototype.read = async function(store, id) {
  if (!this._stores[store]) {
    return null;
  }
  
  for (var i = 0; i < this._stores[store].length; i++) {
    if (this._stores[store][i].id === id) {
      this._readCount++;
      return this._stores[store][i];
    }
  }
  
  return null;
};

CoreMemory.prototype.getRecent = function(store, count) {
  if (!count) count = 20;
  if (!this._stores[store]) return [];
  return this._stores[store].slice(-count);
};

CoreMemory.prototype.getByTags = function(store, tags, limit) {
  if (!limit) limit = 20;
  if (!this._stores[store]) return [];
  
  var results = [];
  var tagSet = new Set(tags);
  
  for (var i = this._stores[store].length - 1; i >= 0 && results.length < limit; i--) {
    var entry = this._stores[store][i];
    var hasTag = false;
    for (var j = 0; j < entry.tags.length; j++) {
      if (tagSet.has(entry.tags[j])) {
        hasTag = true;
        break;
      }
    }
    if (hasTag) {
      results.push(entry);
    }
  }
  
  return results;
};

CoreMemory.prototype.verify = function(store) {
  if (!store) {
    var allValid = true;
    var allErrors = [];
    for (var s in this._stores) {
      var result = this._verifyStore(s);
      if (!result.valid) {
        allValid = false;
        allErrors = allErrors.concat(result.errors);
      }
    }
    return { valid: allValid, errors: allErrors };
  }
  return this._verifyStore(store);
};

CoreMemory.prototype._verifyStore = function(store) {
  var entries = this._stores[store];
  if (!entries || entries.length === 0) {
    return { valid: true, errors: [], count: 0 };
  }
  
  var errors = [];
  var prevHash = null;
  
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    
    // BUG FIX: käytetään per-store prevHashia globaalin sijaan
    if (i === 0) {
      // Ensimmäisellä entrylla prevHash on null tai per-store alkuarvo
      if (entry.prevHash !== null && entry.prevHash !== undefined) {
        // Hyväksytään — vanha data voi viitata globaaliin chainiin
      }
    } else if (entry.prevHash !== prevHash) {
      errors.push({ store: store, index: i, error: "Hash chain broken" });
    }
    
    var computed = this._computeHash(entry);
    if (computed !== entry.hash) {
      errors.push({ store: store, index: i, error: "Hash mismatch" });
    }
    
    prevHash = entry.hash;
  }
  
  return { valid: errors.length === 0, errors: errors, count: entries.length };
};

CoreMemory.prototype.getStats = function() {
  var stats = {
    stores: {},
    totalEntries: 0,
    writeCount: this._writeCount,
    readCount: this._readCount,
    hashChain: this._hashChain ? this._hashChain.slice(0, 16) + "..." : null
  };
  
  for (var store in this._stores) {
    var count = this._stores[store].length;
    var limit = this._limits[store];
    stats.stores[store] = {
      count: count,
      limit: limit,
      utilization: Math.round((count / limit) * 100)
    };
    stats.totalEntries += count;
  }
  
  return stats;
};

CoreMemory.prototype.export = function(store) {
  if (store) {
    return {
      store: store,
      entries: this._stores[store].slice(),
      exportedAt: this._now()
    };
  }
  
  return {
    stores: {
      episodic: this._stores.episodic.slice(),
      semantic: this._stores.semantic.slice(),
      procedural: this._stores.procedural.slice()
    },
    exportedAt: this._now()
  };
};

CoreMemory.prototype._compact = function(store) {
  var limit = this._limits[store];
  var toRemove = Math.floor(limit * 0.1);
  this._stores[store] = this._stores[store].slice(toRemove);
  
  this._indices[store].clear();
  for (var i = 0; i < this._stores[store].length; i++) {
    var entry = this._stores[store][i];
    for (var j = 0; j < entry.tags.length; j++) {
      var tag = entry.tags[j];
      if (!this._indices[store].has(tag)) {
        this._indices[store].set(tag, []);
      }
      this._indices[store].get(tag).push(entry.id);
    }
  }
};

function createCoreMemory(options) {
  return new CoreMemory(options);
}

export { CoreMemory, createCoreMemory, MEMORY_STORE };
export default CoreMemory;