// t3/Factory/core/factory-errors.js
// Factory Error Definitions

export const ERROR_CODE = {
  UNKNOWN: "UNKNOWN",
  INVALID_CONFIG: "INVALID_CONFIG",
  INVALID_STATE: "INVALID_STATE",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_COMMAND: "INVALID_COMMAND",
  BOOT_FAILED: "BOOT_FAILED",
  SHUTDOWN_FAILED: "SHUTDOWN_FAILED",
  PIPELINE_FAILED: "PIPELINE_FAILED",
  PHASE_FAILED: "PHASE_FAILED",
  WORKER_FAILED: "WORKER_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  BUILD_FAILED: "BUILD_FAILED",
  PACKAGE_FAILED: "PACKAGE_FAILED",
  PUBLISH_FAILED: "PUBLISH_FAILED",
  MEMORY_FULL: "MEMORY_FULL",
  TIMEOUT: "TIMEOUT",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE: "DUPLICATE",
  POLICY_DENIED: "POLICY_DENIED",
  SECURITY_VIOLATION: "SECURITY_VIOLATION"
};

export class FactoryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "FactoryError";
    this.code = code || ERROR_CODE.UNKNOWN;
    this.details = details;
    this.timestamp = Date.now();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

export class PipelineError extends FactoryError {
  constructor(phase, message, details = {}) {
    super(ERROR_CODE.PIPELINE_FAILED, message, { phase, ...details });
    this.name = "PipelineError";
    this.phase = phase;
  }
}

export class ValidationError extends FactoryError {
  constructor(message, violations = []) {
    super(ERROR_CODE.VALIDATION_FAILED, message, { violations });
    this.name = "ValidationError";
    this.violations = violations;
  }
}

export class SecurityError extends FactoryError {
  constructor(message, findings = []) {
    super(ERROR_CODE.SECURITY_VIOLATION, message, { findings });
    this.name = "SecurityError";
    this.findings = findings;
  }
}

export function createError(code, message, details) {
  return new FactoryError(code, message, details);
}

export function isFactoryError(err) {
  return err instanceof FactoryError;
}

export default {
  ERROR_CODE,
  FactoryError,
  PipelineError,
  ValidationError,
  SecurityError,
  createError,
  isFactoryError
};