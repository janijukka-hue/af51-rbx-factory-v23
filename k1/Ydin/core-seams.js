// k1/Ydin/core-seams.js
// Core Seams - Injektoitavat abstraktiot
// - Clock (aika)
// - Storage (persistenssi)
// - Crypto (hash)
// Nämä mahdollistavat deterministisen testauksen

/* =============================================================================
   CLOCK SEAM
============================================================================= */

/**
 * SystemClock - käyttää oikeaa wall-clock aikaa
 * Käytä tuotannossa
 */
export class SystemClock {
  now() {
    return Date.now();
  }

  nowISO() {
    return new Date().toISOString();
  }
}

/**
 * FixedClock - palauttaa aina saman ajan
 * Käytä testeissä kun tarvitset täysin deterministisen ajan
 */
export class FixedClock {
  constructor(fixedTime = 0) {
    this.fixed = fixedTime;
  }

  now() {
    return this.fixed;
  }

  nowISO() {
    return new Date(this.fixed).toISOString();
  }

  set(time) {
    this.fixed = time;
  }

  advance(ms) {
    this.fixed += ms;
    return this.fixed;
  }
}

/**
 * MonotonicClock - kasvava counter
 * Käytä testeissä kun tarvitset monotonisesti kasvavan ajan
 */
export class MonotonicClock {
  constructor(start = 0, step = 1) {
    this.counter = start;
    this.step = step;
  }

  now() {
    this.counter += this.step;
    return this.counter;
  }

  nowISO() {
    return String(this.counter).padStart(20, "0");
  }

  reset(start = 0) {
    this.counter = start;
  }

  getCounter() {
    return this.counter;
  }
}

/* =============================================================================
   STORAGE SEAM
============================================================================= */

/**
 * MemoryStorage - in-memory Map-pohjainen storage
 * Käytä kehityksessä ja testeissä
 */
export class MemoryStorage {
  constructor() {
    this._map = new Map();
  }

  get(key) {
    return this._map.get(key);
  }

  set(key, value) {
    this._map.set(key, value);
  }

  remove(key) {
    this._map.delete(key);
  }

  has(key) {
    return this._map.has(key);
  }

  keys() {
    return Array.from(this._map.keys());
  }

  clear() {
    this._map.clear();
  }

  size() {
    return this._map.size;
  }

  // Async variants (for compatibility)
  async getAsync(key) {
    return this.get(key);
  }

  async setAsync(key, value) {
    this.set(key, value);
  }

  async removeAsync(key) {
    this.remove(key);
  }

  async setManyAsync(obj) {
    for (const key of Object.keys(obj)) {
      this.set(key, obj[key]);
    }
  }
}

/**
 * PrefixedStorage - wrappaa toisen storagen prefixillä
 */
export class PrefixedStorage {
  constructor(baseStorage, prefix) {
    this._base = baseStorage;
    this._prefix = prefix + ":";
  }

  _key(key) {
    return this._prefix + key;
  }

  get(key) {
    return this._base.get(this._key(key));
  }

  set(key, value) {
    this._base.set(this._key(key), value);
  }

  remove(key) {
    this._base.remove(this._key(key));
  }

  has(key) {
    return this._base.has(this._key(key));
  }
}

/* =============================================================================
   CRYPTO / HASH SEAM
============================================================================= */

/**
 * Stable JSON stringify - sorted keys, deterministic output
 */
export function stableStringify(x) {
  const seen = new WeakSet();

  const normalize = (v) => {
    if (v === null) return null;
    if (v === undefined) return null;

    const t = typeof v;

    if (t === "number" || t === "string" || t === "boolean") return v;

    if (Array.isArray(v)) return v.map(normalize);

    if (t === "object") {
      if (seen.has(v)) return "[CYCLE]";
      seen.add(v);

      const keys = Object.keys(v).sort();
      const out = {};

      for (const k of keys) {
        out[k] = normalize(v[k]);
      }

      return out;
    }

    return null;
  };

  return JSON.stringify(normalize(x));
}

/**
 * FNV-1a 32-bit hash (hex string)
 * Deterministic, ei kryptografinen
 */
export function fnv1a32Hex(input) {
  let h = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }

  return ("00000000" + h.toString(16)).slice(-8);
}

/**
 * Sync hash wrapper
 */
export function hashSync(tag, obj) {
  return `${tag}_fnv_${fnv1a32Hex(stableStringify(obj))}`;
}

/**
 * Bytes to hex string
 */
export function bytesToHex(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  }
  return s;
}

/**
 * Async SHA-256 (WebCrypto jos saatavilla)
 */
export async function sha256HexAsync(input) {
  const hasWebCrypto =
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    globalThis.crypto.subtle;

  if (!hasWebCrypto) {
    // Fallback: FNV-based hash
    return "sha256_UNAVAILABLE_" + fnv1a32Hex(input);
  }

  try {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input)
    );
    return "sha256_" + bytesToHex(new Uint8Array(digest));
  } catch (err) {
    return "sha256_ERROR_" + fnv1a32Hex(input);
  }
}

/* =============================================================================
   UTILITY
============================================================================= */

/**
 * Clamp number between min and max
 */
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Safe number conversion
 */
export function asNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Check if value is promise-like
 */
export function isPromise(x) {
  return !!x && typeof x.then === "function";
}

/* =============================================================================
   EXPORTS
============================================================================= */

export default {
  // Clocks
  SystemClock,
  FixedClock,
  MonotonicClock,

  // Storage
  MemoryStorage,
  PrefixedStorage,

  // Hash
  stableStringify,
  fnv1a32Hex,
  hashSync,
  bytesToHex,
  sha256HexAsync,

  // Utility
  clamp,
  asNumber,
  isPromise
};