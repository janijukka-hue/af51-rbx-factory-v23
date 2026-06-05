// t3/Factory/core/factory-config.js
// Factory Configuration

export const DEFAULT_LIMITS = {
  maxFileCount: 1000,
  maxFileSize: 10 * 1024 * 1024,
  maxTotalSize: 100 * 1024 * 1024,
  maxQueueSize: 100,
  maxConcurrentBuilds: 3,
  buildTimeoutMs: 300000,
  phaseTimeoutMs: 60000
};

export const DEFAULT_MEMORY_CAPS = {
  workRing: 500,
  queue: 200,
  energy: 1000,
  audit: 5000,
  vault: 10000,
  warehouse: 1000,
  registry: 500
};

export const DEFAULT_CONFIG = {
  limits: DEFAULT_LIMITS,
  memoryCaps: DEFAULT_MEMORY_CAPS,
  features: {
    incrementalBuild: true,
    codeInspection: true,
    securityScan: true,
    testExecution: true,
    preview: true
  },
  policies: {
    requireValidation: true,
    requireSecurityPass: true,
    allowEval: false,
    allowExternalUrls: false
  }
};

export function createConfig(userConfig = {}) {
  return {
    limits: {
      ...DEFAULT_LIMITS,
      ...(userConfig.limits || {})
    },
    memoryCaps: {
      ...DEFAULT_MEMORY_CAPS,
      ...(userConfig.memoryCaps || {})
    },
    features: {
      ...DEFAULT_CONFIG.features,
      ...(userConfig.features || {})
    },
    policies: {
      ...DEFAULT_CONFIG.policies,
      ...(userConfig.policies || {})
    }
  };
}

export function getLimit(config, key) {
  return config?.limits?.[key] ?? DEFAULT_LIMITS[key];
}

export function getMemoryCap(config, key) {
  return config?.memoryCaps?.[key] ?? DEFAULT_MEMORY_CAPS[key];
}

export function validateConfig(config) {
  const errors = [];
  
  if (config.limits) {
    if (config.limits.maxFileCount < 1) {
      errors.push("maxFileCount must be >= 1");
    }
    if (config.limits.maxFileSize < 1024) {
      errors.push("maxFileSize must be >= 1024");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  DEFAULT_LIMITS,
  DEFAULT_MEMORY_CAPS,
  DEFAULT_CONFIG,
  createConfig,
  getLimit,
  getMemoryCap,
  validateConfig
};