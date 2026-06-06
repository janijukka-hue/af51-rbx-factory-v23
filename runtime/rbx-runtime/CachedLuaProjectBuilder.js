// runtime/rbx-runtime/CachedLuaProjectBuilder.js
// Optimized LuaProjectBuilder with pre-loaded modules and build cache

import { LuaProjectBuilder } from './LuaProjectBuilder.js';
import crypto from 'crypto';

/**
 * Singleton builder with pre-loaded modules and optional build caching.
 * 
 * Performance improvements:
 * - Modules loaded once at initialization
 * - Optional source hash-based build cache
 * - Reuses builder instance across multiple builds
 * 
 * Usage:
 *   const builder = CachedLuaProjectBuilder.getInstance();
 *   const result = await builder.build(source);
 */
class CachedLuaProjectBuilder {
  constructor() {
    this.builder = new LuaProjectBuilder();
    this.buildCache = new Map();
    this.cacheEnabled = false;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!CachedLuaProjectBuilder.instance) {
      CachedLuaProjectBuilder.instance = new CachedLuaProjectBuilder();
    }
    return CachedLuaProjectBuilder.instance;
  }

  /**
   * Enable build caching (disabled by default)
   * 
   * When enabled, identical source code will return cached results
   * without rebuilding. Use with caution in production.
   */
  enableCache(maxSize = 100) {
    this.cacheEnabled = true;
    this.cacheMaxSize = maxSize;
    console.log('[CachedLuaProjectBuilder] Cache enabled (max ' + maxSize + ' entries)');
  }

  /**
   * Disable build caching
   */
  disableCache() {
    this.cacheEnabled = false;
    this.buildCache.clear();
    console.log('[CachedLuaProjectBuilder] Cache disabled');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      enabled: this.cacheEnabled,
      size: this.buildCache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits + this.cacheMisses > 0
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * Clear build cache
   */
  clearCache() {
    const size = this.buildCache.size;
    this.buildCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    return size;
  }

  /**
   * Build with optional caching
   */
  async build(source, opts = {}) {
    // Check cache if enabled
    if (this.cacheEnabled && !opts.skipCache) {
      const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
      
      if (this.buildCache.has(hash)) {
        this.cacheHits++;
        const cached = this.buildCache.get(hash);
        return {
          ...cached,
          fromCache: true,
          cacheHit: true
        };
      }
      
      this.cacheMisses++;
      
      // Build normally
      const result = await this.builder.build(source, opts);
      
      // Cache result if successful
      if (result.ok) {
        // Evict oldest if cache full
        if (this.buildCache.size >= this.cacheMaxSize) {
          const firstKey = this.buildCache.keys().next().value;
          this.buildCache.delete(firstKey);
        }
        
        // Don't cache the full ZIP path/data, just metadata + preview
        const cacheEntry = {
          ok: result.ok,
          buildId: result.buildId,
          instanceCount: result.instanceCount,
          fileCount: result.fileCount,
          routing: result.routing,
          preview: result.preview,
          diagnostics: result.diagnostics,
          signature: result.signature
        };
        
        this.buildCache.set(hash, cacheEntry);
      }
      
      return result;
    }
    
    // No cache - build normally
    return this.builder.build(source, opts);
  }

  /**
   * Build multiple sources in parallel (uses same builder instance)
   */
  async buildBatch(sources) {
    const promises = sources.map(source => this.build(source));
    return Promise.all(promises);
  }
}

// Singleton instance
CachedLuaProjectBuilder.instance = null;

export { CachedLuaProjectBuilder };
export default CachedLuaProjectBuilder;
