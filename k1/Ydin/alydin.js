/**
 * k1/Ydin/alydin.js
 *
 * Core primitives for K1 kernel.
 * - Hash functions (fnv1a32)
 * - Deterministic utilities
 * - Deterministic runtime
 * - Shared constants
 */

// ============================================================================
// HASH FUNCTIONS
// ============================================================================

/**
 * FNV-1a 32-bit (hex). Tamper-evident chain (not cryptographic).
 * In native runtime, crypto can be added later via a seam.
 *
 * @param {string} input - String to hash
 * @returns {string} 8-character hex hash
 */
export function fnv1a32(input) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619 with overflow using shift-add
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

// ============================================================================
// DETERMINISTIC UTILITIES
// ============================================================================

/**
 * Stable JSON stringify for deterministic hashing.
 * Sorts object keys recursively.
 *
 * @param {any} obj - Object to stringify
 * @returns {string} Deterministic JSON string
 */
export function stableStringify(obj) {
  if (obj === null) return "null";
  if (obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";

  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]));
  return "{" + pairs.join(",") + "}";
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

// (REMOVED FROM K1 KERNEL) nowISO / nowUnix must live behind host time seam.

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Clamp value between min and max.
 *
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Deep clone object (simple version, no circular refs).
 *
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function clone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(clone);

  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = clone(obj[key]);
    }
  }
  return cloned;
}

// ============================================================================
// DETERMINISTIC RUNTIME
// ============================================================================

/**
 * Deterministic runtime for testing and reproducibility.
 *
 * Features:
 * - Monotonic counter-based IDs
 * - Deterministic timestamps
 * - Resettable for tests
 *
 * Note: For production, use wall-clock time via host adapter.
 */
export class DeterministicRuntime {
  constructor(startCounter = 0) {
    this.counter = startCounter;
  }

  /**
   * Generate unique ID.
   *
   * @param {string} prefix - ID prefix (default: "k1")
   * @returns {string} Unique ID
   */
  uid(prefix = "k1") {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }

  /**
   * Get deterministic timestamp (monotonic counter).
   *
   * @returns {number} Monotonic timestamp
   */
  now() {
    this.counter += 1;
    return this.counter;
  }

  /**
   * Get deterministic ISO timestamp.
   *
   * @returns {string} ISO timestamp (based on counter)
   */
  nowISO() {
    // Convert counter to date (starting from epoch)
    const date = new Date(this.counter);
    return date.toISOString();
  }

  /**
   * Clamp value between min and max.
   *
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  clamp(value, min, max) {
    return clamp(value, min, max);
  }

  /**
   * Reset counter (for tests).
   */
  reset() {
    this.counter = 0;
  }

  /**
   * Get current counter value.
   *
   * @returns {number} Current counter
   */
  getCounter() {
    return this.counter;
  }

  /**
   * Set counter value.
   *
   * @param {number} value - New counter value
   */
  setCounter(value) {
    this.counter = value;
  }
}

// ============================================================================
// ENERGY CONSTANTS
// ============================================================================

/**
 * Energy costs for ring operations.
 */
export const ENERGY_COSTS = {
  // Ring tier costs (write operations)
  RING_R0: 10, // Kernel tier - expensive
  RING_R1: 5, // Hot tier - normal
  RING_R2: 3, // Warm tier - cheap
  RING_R3: 1, // Cold tier - very cheap

  // Operation costs
  LOG: 1, // Simple log
  READ: 2, // Read from ring
  ANALYZE: 10, // Entity analysis
  PROPOSE: 20, // Entity proposal
  SNAPSHOT: 50, // System snapshot
  ARCHIVE: 15, // Archive to massamuisti
};

/**
 * Cooling states for rings.
 */
export const COOLING = {
  NORMAL: 0, // < 50% pressure
  MEDIUM: 1, // 50-70% pressure
  HIGH: 2, // 70-90% pressure
  CRITICAL: 3, // > 90% pressure → SAFE MODE
};

/**
 * Entity priority levels.
 */
export const PRIORITY = {
  CRITICAL: 10, // RiskGuardian - always runs
  HIGH: 8, // BuildOptimizer - high priority
  MEDIUM: 5, // VideoEntity - normal priority
  LOW: 3, // Analytics - low priority
  BACKGROUND: 1, // Cleanup - background only
};

// ============================================================================
// GLOBAL RUNTIME INSTANCE (OPTIONAL)
// ============================================================================

/**
 * Global deterministic runtime instance.
 * Use this for testing/development, or create your own instance.
 */
export const globalRuntime = new DeterministicRuntime();