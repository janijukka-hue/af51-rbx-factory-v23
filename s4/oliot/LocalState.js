// s4/oliot/LocalState.js
// S4 Local State - Session state management

function LocalState(options) {
  if (!options) {
    options = {};
  }
  
  this._state = new Map();
  this._subscribers = new Map();
  this._debug = options.debug || false;
}

LocalState.prototype.get = function(key) {
  return this._state.get(key);
};

LocalState.prototype.set = function(key, value) {
  this._state.set(key, value);
  this._notify(key, value);
};

LocalState.prototype.delete = function(key) {
  this._state.delete(key);
  this._notify(key, undefined);
};

LocalState.prototype.has = function(key) {
  return this._state.has(key);
};

LocalState.prototype.clear = function() {
  this._state.clear();
};

LocalState.prototype.subscribe = function(key, handler) {
  if (!this._subscribers.has(key)) {
    this._subscribers.set(key, []);
  }
  this._subscribers.get(key).push(handler);
  
  var self = this;
  return function unsubscribe() {
    var handlers = self._subscribers.get(key);
    if (handlers) {
      var index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  };
};

LocalState.prototype._notify = function(key, value) {
  var handlers = this._subscribers.get(key);
  if (handlers) {
    for (var i = 0; i < handlers.length; i++) {
      try {
        handlers[i](value, key);
      } catch (err) {
        if (this._debug) {
          console.error("[LocalState] Handler error:", err);
        }
      }
    }
  }
};

LocalState.prototype.getAll = function() {
  var result = {};
  this._state.forEach(function(value, key) {
    result[key] = value;
  });
  return result;
};

function createLocalState(options) {
  return new LocalState(options);
}

export { LocalState, createLocalState };