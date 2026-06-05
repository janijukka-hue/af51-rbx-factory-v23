// k1/Ydin/eventbus.js
// Kernel EventBus - Deterministic Event System
// Immutable, auditable, no external dependencies

var EVENT_PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function EventBus(options) {
  if (!options) {
    options = {};
  }
  
  this._clock = options.clock || null;
  this._prefix = options.prefix || "k1";
  this._debug = options.debug || false;
  this._historyLimit = options.historyLimit || 1000;
  
  this._subscribers = new Map();
  this._wildcardSubscribers = [];
  this._history = [];
  this._eventCount = 0;
  this._sequence = 0;
}

EventBus.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

EventBus.prototype._generateEventId = function(type) {
  var ts = this._now();
  this._sequence++;
  var seed = this._prefix + ":" + type + ":" + ts + ":" + this._sequence;
  return "evt_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

EventBus.prototype.emit = function(type, payload, options) {
  if (!type) {
    return null;
  }
  
  if (!options) {
    options = {};
  }
  
  var event = {
    id: this._generateEventId(type),
    type: type,
    payload: payload || {},
    timestamp: this._now(),
    priority: options.priority !== undefined ? options.priority : EVENT_PRIORITY.NORMAL,
    source: options.source || this._prefix,
    correlationId: options.correlationId || null
  };
  
  this._history.push(event);
  if (this._history.length > this._historyLimit) {
    this._history.shift();
  }
  
  this._eventCount++;
  
  if (this._debug) {
    
  }
  
  var handlers = this._subscribers.get(type);
  if (handlers) {
    for (var i = 0; i < handlers.length; i++) {
      try {
        handlers[i](event);
      } catch (err) {
        if (this._debug) {
          console.error("[EventBus] Handler error:", err);
        }
      }
    }
  }
  
  for (var j = 0; j < this._wildcardSubscribers.length; j++) {
    try {
      this._wildcardSubscribers[j](event);
    } catch (err) {
      if (this._debug) {
        console.error("[EventBus] Wildcard handler error:", err);
      }
    }
  }
  
  return event;
};

EventBus.prototype.subscribe = function(type, handler) {
  if (!type || typeof handler !== "function") {
    return function() {};
  }
  
  if (!this._subscribers.has(type)) {
    this._subscribers.set(type, []);
  }
  
  this._subscribers.get(type).push(handler);
  
  var self = this;
  return function unsubscribe() {
    var handlers = self._subscribers.get(type);
    if (handlers) {
      var index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  };
};

EventBus.prototype.subscribeAll = function(handler) {
  if (typeof handler !== "function") {
    return function() {};
  }
  
  this._wildcardSubscribers.push(handler);
  
  var self = this;
  return function unsubscribe() {
    var index = self._wildcardSubscribers.indexOf(handler);
    if (index !== -1) {
      self._wildcardSubscribers.splice(index, 1);
    }
  };
};

EventBus.prototype.once = function(type, handler) {
  var self = this;
  var unsubscribe = this.subscribe(type, function(event) {
    unsubscribe();
    handler(event);
  });
  return unsubscribe;
};

EventBus.prototype.waitFor = function(type, timeoutMs) {
  var self = this;
  var timeout = timeoutMs || 30000;
  
  return new Promise(function(resolve, reject) {
    var timer = null;
    
    var unsubscribe = self.once(type, function(event) {
      if (timer) {
        clearTimeout(timer);
      }
      resolve(event);
    });
    
    timer = setTimeout(function() {
      unsubscribe();
      reject(new Error("EventBus.waitFor timeout: " + type));
    }, timeout);
  });
};

EventBus.prototype.getHistory = function(type, limit) {
  var count = limit || 50;
  
  if (type) {
    var filtered = [];
    for (var i = this._history.length - 1; i >= 0 && filtered.length < count; i--) {
      if (this._history[i].type === type) {
        filtered.push(this._history[i]);
      }
    }
    return filtered.reverse();
  }
  
  return this._history.slice(-count);
};

EventBus.prototype.getStats = function() {
  return {
    eventCount: this._eventCount,
    historySize: this._history.length,
    historyLimit: this._historyLimit,
    subscriberTypes: this._subscribers.size,
    wildcardSubscribers: this._wildcardSubscribers.length
  };
};

EventBus.prototype.clear = function() {
  this._history = [];
  this._eventCount = 0;
};

EventBus.prototype.reset = function() {
  this._subscribers.clear();
  this._wildcardSubscribers = [];
  this._history = [];
  this._eventCount = 0;
  this._sequence = 0;
};

function createEventBus(options) {
  return new EventBus(options);
}

export { EventBus, createEventBus, EVENT_PRIORITY };
export default EventBus;