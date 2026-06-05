// k1/alx/config/security.config.js
// Security Configuration

export const RATE_LIMITS = {
  default: {
    maxRequests: 100,
    windowMs: 60000
  },
  build: {
    maxRequests: 10,
    windowMs: 60000
  },
  analyze: {
    maxRequests: 30,
    windowMs: 60000
  }
};

export const INPUT_LIMITS = {
  maxInputLength: 50000,
  maxTokens: 1000,
  maxCodeSize: 100000,
  maxFileCount: 100
};

export const BLOCKED_PATTERNS = [
  /eval\s*\(/gi,
  /new\s+Function\s*\(/gi,
  /require\s*\(\s*['"]child_process['"]\s*\)/gi,
  /process\.env/gi,
  /__proto__/gi,
  /constructor\s*\[/gi
];

export const LOCKDOWN_CONFIG = {
  autoLockThreshold: 50,
  autoLockDuration: 300000,
  manualLockDuration: 3600000
};

export const AUDIT_CONFIG = {
  logLevel: "INFO",
  retentionDays: 30,
  maxEntries: 100000
};

export function validateInput(input, limits = INPUT_LIMITS) {
  const issues = [];
  
  // BUG FIX: null / non-string input palautetaan valid:false heti
  // eikä kaaduta .length tai .test() kutsuihin
  if (input === null || input === undefined) {
    return { valid: false, issues: [{ code: "NULL_INPUT" }] };
  }

  if (typeof input !== "string") {
    return { valid: false, issues: [{ code: "NON_STRING_INPUT", type: typeof input }] };
  }

  if (!input) {
    return { valid: true, issues };
  }
  
  if (input.length > limits.maxInputLength) {
    issues.push({ code: "INPUT_TOO_LONG", limit: limits.maxInputLength });
  }
  
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(input)) {
      issues.push({ code: "BLOCKED_PATTERN", pattern: pattern.source });
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export default {
  RATE_LIMITS,
  INPUT_LIMITS,
  BLOCKED_PATTERNS,
  LOCKDOWN_CONFIG,
  AUDIT_CONFIG,
  validateInput
};