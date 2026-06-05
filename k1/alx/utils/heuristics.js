// k1/alx/utils/heuristics.js
// Heuristic Analysis - Deterministic Learning

export class FrequencyTracker {
  constructor(maxItems = 1000) {
    this._counts = new Map();
    this._maxItems = maxItems;
  }

  track(key) {
    const count = (this._counts.get(key) || 0) + 1;
    this._counts.set(key, count);
    
    if (this._counts.size > this._maxItems) {
      this._pruneLowest();
    }
    
    return count;
  }

  get(key) {
    return this._counts.get(key) || 0;
  }

  getTop(n = 10) {
    return Array.from(this._counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));
  }

  _pruneLowest() {
    const sorted = Array.from(this._counts.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const toRemove = Math.floor(this._maxItems * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this._counts.delete(sorted[i][0]);
    }
  }

  export() {
    return Array.from(this._counts.entries());
  }

  import(data) {
    this._counts = new Map(data);
  }
}

export class TimingTracker {
  constructor(maxSamples = 100) {
    this._samples = new Map();
    this._maxSamples = maxSamples;
  }

  record(key, durationMs) {
    if (!this._samples.has(key)) {
      this._samples.set(key, []);
    }
    
    const samples = this._samples.get(key);
    samples.push(durationMs);
    
    if (samples.length > this._maxSamples) {
      samples.shift();
    }
  }

  getStats(key) {
    const samples = this._samples.get(key);
    if (!samples || samples.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0 };
    }
    
    const sum = samples.reduce((a, b) => a + b, 0);
    const avg = sum / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    
    return { count: samples.length, avg: Math.round(avg), min, max };
  }

  getAllStats() {
    const result = {};
    for (const key of this._samples.keys()) {
      result[key] = this.getStats(key);
    }
    return result;
  }
}

export class SequenceDetector {
  constructor(windowSize = 5) {
    this._sequences = [];
    this._windowSize = windowSize;
    this._patterns = new Map();
  }

  observe(event) {
    this._sequences.push(event);
    
    if (this._sequences.length > this._windowSize * 10) {
      this._sequences = this._sequences.slice(-this._windowSize * 5);
    }
    
    if (this._sequences.length >= this._windowSize) {
      const window = this._sequences.slice(-this._windowSize);
      const pattern = window.join("→");
      const count = (this._patterns.get(pattern) || 0) + 1;
      this._patterns.set(pattern, count);
    }
  }

  predict() {
    if (this._sequences.length < this._windowSize - 1) return null;
    
    const recent = this._sequences.slice(-(this._windowSize - 1));
    const prefix = recent.join("→");
    
    let bestNext = null;
    let bestCount = 0;
    
    for (const [pattern, count] of this._patterns) {
      if (pattern.startsWith(prefix + "→") && count > bestCount) {
        const parts = pattern.split("→");
        bestNext = parts[parts.length - 1];
        bestCount = count;
      }
    }
    
    return bestNext ? { next: bestNext, confidence: Math.min(bestCount / 10, 1) } : null;
  }

  getPatterns(minCount = 2) {
    return Array.from(this._patterns.entries())
      .filter(([_, count]) => count >= minCount)
      .sort((a, b) => b[1] - a[1])
      .map(([pattern, count]) => ({ pattern, count }));
  }
}

export class AnomalyDetector {
  constructor(windowSize = 50) {
    this._values = [];
    this._windowSize = windowSize;
  }

  observe(value) {
    this._values.push(value);
    
    if (this._values.length > this._windowSize * 2) {
      this._values = this._values.slice(-this._windowSize);
    }
  }

  isAnomaly(value, threshold = 2) {
    if (this._values.length < 10) return false;
    
    const mean = this._values.reduce((a, b) => a + b, 0) / this._values.length;
    const variance = this._values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / this._values.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return value !== mean;
    
    const zScore = Math.abs(value - mean) / stdDev;
    return zScore > threshold;
  }

  getStats() {
    if (this._values.length === 0) {
      return { count: 0, mean: 0, stdDev: 0, min: 0, max: 0 };
    }
    
    const mean = this._values.reduce((a, b) => a + b, 0) / this._values.length;
    const variance = this._values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / this._values.length;
    
    return {
      count: this._values.length,
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
      min: Math.min(...this._values),
      max: Math.max(...this._values)
    };
  }
}

export default {
  FrequencyTracker,
  TimingTracker,
  SequenceDetector,
  AnomalyDetector
};