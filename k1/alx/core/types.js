// k1/alx/core/types.js
// ALX Core Types - Deterministic Factory Intelligence
// Owner: Jani Segerman

export const SKILL_CATEGORY = {
  CORE: "CORE",
  LANGUAGE: "LANGUAGE",
  CODE: "CODE",
  FACTORY: "FACTORY",
  SECURITY: "SECURITY",
  MEMORY: "MEMORY",
  ADAPTIVE: "ADAPTIVE"
};

export const INTENT_CONFIDENCE = {
  HIGH: 0.9,
  MEDIUM: 0.7,
  LOW: 0.5,
  NONE: 0
};

export const ALX_STATE = {
  OFFLINE: "OFFLINE",
  BOOTING: "BOOTING",
  READY: "READY",
  EXECUTING: "EXECUTING",
  LOCKED: "LOCKED",
  ERROR: "ERROR"
};

export const EXECUTION_RESULT = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  DENIED: "DENIED",
  UNKNOWN: "UNKNOWN"
};

export function createSkillContext(options = {}) {
  return {
    userId: options.userId || "system",
    sessionId: options.sessionId || "default",
    timestamp: options.clock?.now() || Date.now(),
    input: options.input || "",
    tokens: options.tokens || [],
    intent: options.intent || null,
    metadata: options.metadata || {}
  };
}

export function createSkillResult(ok, data = {}) {
  return {
    ok,
    output: data.output || null,
    error: data.error || null,
    metadata: data.metadata || {}
  };
}

export function createIntent(name, confidence = 0, params = {}) {
  return {
    name,
    confidence,
    params
  };
}

export default {
  SKILL_CATEGORY,
  INTENT_CONFIDENCE,
  ALX_STATE,
  EXECUTION_RESULT,
  createSkillContext,
  createSkillResult,
  createIntent
};