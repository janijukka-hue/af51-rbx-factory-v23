// t3/Factory/core/factory-utils.js
// Factory Utilities - Deterministic helpers

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function fnv1a64(str) {
  var hashLow = 2166136261;
  var hashHigh = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    hashLow ^= c;
    hashHigh ^= c;
    hashLow = (hashLow * 16777619) >>> 0;
    hashHigh = (hashHigh * 16777619) >>> 0;
  }
  return hashHigh.toString(16).padStart(8, "0") + hashLow.toString(16).padStart(8, "0");
}

function simpleHash256(str) {
  var h1 = fnv1a32(str);
  var h2 = fnv1a32(str + "_salt1");
  var h3 = fnv1a32(str + "_salt2");
  var h4 = fnv1a32(str + "_salt3");
  return (
    h1.toString(16).padStart(8, "0") +
    h2.toString(16).padStart(8, "0") +
    h3.toString(16).padStart(8, "0") +
    h4.toString(16).padStart(8, "0")
  );
}

// Deterministic ID generator (no Math.random)
function generateId(prefix, clock, counter) {
  if (counter === undefined) {
    counter = 0;
  }
  var ts = clock ? clock.now() : Date.now();
  var seed = prefix + "_" + ts + "_" + counter;
  var hash = fnv1a32(seed);
  return prefix + "_" + hash.toString(16).padStart(8, "0");
}

function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  Object.freeze(obj);
  
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var value = obj[keys[i]];
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  
  return obj;
}

function deepClone(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    var arrCopy = [];
    for (var i = 0; i < obj.length; i++) {
      arrCopy[i] = deepClone(obj[i]);
    }
    return arrCopy;
  }
  
  var copy = {};
  var keys = Object.keys(obj);
  for (var j = 0; j < keys.length; j++) {
    copy[keys[j]] = deepClone(obj[keys[j]]);
  }
  return copy;
}

function sanitizePath(path) {
  if (!path || typeof path !== "string") {
    return "";
  }
  
  return path
    .replace(/\.\./g, "")
    .replace(/\/\//g, "/")
    .replace(/[<>:"|?*]/g, "_");
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  
  var units = ["B", "KB", "MB", "GB", "TB"];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  var value = bytes / Math.pow(1024, i);
  
  return value.toFixed(2) + " " + units[i];
}

function formatDuration(ms) {
  if (ms < 1000) {
    return ms + "ms";
  }
  if (ms < 60000) {
    return (ms / 1000).toFixed(2) + "s";
  }
  var mins = Math.floor(ms / 60000);
  var secs = ((ms % 60000) / 1000).toFixed(0);
  return mins + "m " + secs + "s";
}

function stableStringify(obj) {
  if (obj === null || obj === undefined) {
    return String(obj);
  }
  
  if (typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  
  if (Array.isArray(obj)) {
    var items = [];
    for (var i = 0; i < obj.length; i++) {
      items.push(stableStringify(obj[i]));
    }
    return "[" + items.join(",") + "]";
  }
  
  var keys = Object.keys(obj).sort();
  var pairs = [];
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    pairs.push(JSON.stringify(key) + ":" + stableStringify(obj[key]));
  }
  return "{" + pairs.join(",") + "}";
}

function debounce(fn, delay) {
  var timer = null;
  return function() {
    var args = arguments;
    var context = this;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(function() {
      fn.apply(context, args);
    }, delay);
  };
}

function throttle(fn, limit) {
  var lastRun = 0;
  return function() {
    var now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      fn.apply(this, arguments);
    }
  };
}

function sortFilesByPath(files) {
  if (!Array.isArray(files)) {
    return [];
  }
  return files.slice().sort(function(a, b) {
    var pa = a && a.path ? a.path : "";
    var pb = b && b.path ? b.path : "";
    return pa.localeCompare(pb);
  });
}

export {
  fnv1a32,
  fnv1a64,
  simpleHash256,
  generateId,
  deepFreeze,
  deepClone,
  sanitizePath,
  formatBytes,
  formatDuration,
  stableStringify,
  debounce,
  throttle,
  sortFilesByPath
};