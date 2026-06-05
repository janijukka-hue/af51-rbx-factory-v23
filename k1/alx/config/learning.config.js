// k1/alx/config/learning.config.js
// Adaptive Learning Configuration - Heuristic Only

export const LEARNING_CONFIG = {
  frequencyTracking: {
    enabled: true,
    maxItems: 1000,
    pruneThreshold: 0.1
  },
  
  timingTracking: {
    enabled: true,
    maxSamples: 100,
    anomalyThreshold: 2.0
  },
  
  sequenceDetection: {
    enabled: true,
    windowSize: 5,
    minPatternCount: 3
  },
  
  profileBuilding: {
    enabled: true,
    maxProfiles: 100,
    updateInterval: 10
  },
  
  difficultyAdaptation: {
    enabled: true,
    minLevel: 1,
    maxLevel: 5,
    adjustmentRate: 0.1
  }
};

export const PATTERN_WEIGHTS = {
  frequency: 0.4,
  recency: 0.3,
  sequence: 0.2,
  context: 0.1
};

export const PROFILE_METRICS = {
  commandFrequency: true,
  sessionDuration: true,
  errorRate: true,
  preferredLanguage: true,
  skillUsage: true,
  timeOfDay: true
};

export const SHORTCUT_RULES = {
  minFrequency: 5,
  maxShortcuts: 20,
  suggestionThreshold: 0.8
};

export default {
  LEARNING_CONFIG,
  PATTERN_WEIGHTS,
  PROFILE_METRICS,
  SHORTCUT_RULES
};