// s4/oliot/OfflineCache.js
// KERROS: S4 – Studio/UI
// Version: 1.0.0
//
// OfflineCache — S4-kerroksen välimuisti.
// Cachettaa: traces, seeds (lista + details), system status.
// In-memory — ei AsyncStorage-riippuvuutta.
// TTL per avain — vanhentunut data käytetään fallbackina allowStale:lla.

var CACHE_TTL = {
  STATUS:       10 * 1000,
  SEEDS:        60 * 1000,
  SEED_DETAILS: 5  * 60 * 1000,
  TRACES:       2  * 60 * 1000,
  GOVERNANCE:   30 * 1000
};

function OfflineCache(options) {
  var opts      = options || {};
  this._debug   = opts.debug   || false;
  this._store   = new Map();
  this._maxSize = opts.maxSize || 500;
}

OfflineCache.prototype._set = function(key, value, ttl) {
  if (this._store.size >= this._maxSize) { this._evictOldest(); }
  this._store.set(key, { value: value, cachedAt: Date.now(), ttl: ttl });
};

OfflineCache.prototype._get = function(key, opts) {
  var entry = this._store.get(key);
  if (!entry) return null;
  var stale = Date.now() - entry.cachedAt > entry.ttl;
  if (stale && !(opts && opts.allowStale)) return null;
  return { value: entry.value, stale: stale, cachedAt: entry.cachedAt };
};

OfflineCache.prototype.setStatus           = function(v)    { this._set("status", v, CACHE_TTL.STATUS); };
OfflineCache.prototype.getStatus           = function(o)    { return this._get("status", o); };
OfflineCache.prototype.setSeeds            = function(v)    { this._set("seeds", v, CACHE_TTL.SEEDS); };
OfflineCache.prototype.getSeeds            = function(o)    { return this._get("seeds", o); };
OfflineCache.prototype.setSeedDetails      = function(id,v) { this._set("seed:" + id, v, CACHE_TTL.SEED_DETAILS); };
OfflineCache.prototype.getSeedDetails      = function(id,o) { return this._get("seed:" + id, o); };
OfflineCache.prototype.setTraces           = function(v)    { this._set("traces", v, CACHE_TTL.TRACES); };
OfflineCache.prototype.getTraces           = function(o)    { return this._get("traces", o); };
OfflineCache.prototype.setGovernanceStatus = function(v)    { this._set("governance", v, CACHE_TTL.GOVERNANCE); };
OfflineCache.prototype.getGovernanceStatus = function(o)    { return this._get("governance", o); };

OfflineCache.prototype.set = function(key, value, ttlMs) {
  this._set(key, value, ttlMs || CACHE_TTL.SEEDS);
};
OfflineCache.prototype.get = function(key, opts) { return this._get(key, opts); };
OfflineCache.prototype.invalidate    = function(key) { this._store.delete(key); };
OfflineCache.prototype.invalidateAll = function()    { this._store.clear(); };

OfflineCache.prototype.getStats = function() {
  var now = Date.now(); var fresh = 0; var stale = 0;
  this._store.forEach(function(e) { if (now - e.cachedAt <= e.ttl) fresh++; else stale++; });
  return { size: this._store.size, fresh: fresh, stale: stale, maxSize: this._maxSize };
};

OfflineCache.prototype._evictOldest = function() {
  var oldest = null; var oldestTime = Infinity;
  this._store.forEach(function(e, k) { if (e.cachedAt < oldestTime) { oldestTime = e.cachedAt; oldest = k; } });
  if (oldest) this._store.delete(oldest);
};

export function createOfflineCache(options) { return new OfflineCache(options); }
export { OfflineCache, CACHE_TTL };
export default OfflineCache;