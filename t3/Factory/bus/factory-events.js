// t3/Factory/bus/factory-events.js
// T3 Factory - Event definitions
// All factory events with payload schemas

/* =============================================================================
   FACTORY EVENT TYPES
============================================================================= */

export const FACTORY_EVENT = {
  // Factory lifecycle
  FACTORY_BOOT: "factory:boot",
  FACTORY_ONLINE: "factory:online",
  FACTORY_SHUTDOWN: "factory:shutdown",
  FACTORY_ERROR: "factory:error",
  
  // Command events
  COMMAND_RECEIVED: "factory:command:received",
  COMMAND_QUEUED: "factory:command:queued",
  COMMAND_STARTED: "factory:command:started",
  COMMAND_COMPLETED: "factory:command:completed",
  COMMAND_FAILED: "factory:command:failed",
  
  // Pipeline events
  PIPELINE_STARTED: "factory:pipeline:started",
  PIPELINE_COMPLETED: "factory:pipeline:completed",
  PIPELINE_FAILED: "factory:pipeline:failed",
  
  // Phase events
  PHASE_STARTED: "factory:phase:started",
  PHASE_COMPLETED: "factory:phase:completed",
  PHASE_FAILED: "factory:phase:failed",
  PHASE_SKIPPED: "factory:phase:skipped",
  
  // Incremental
  INCREMENTAL_HIT: "factory:incremental:hit",
  INCREMENTAL_MISS: "factory:incremental:miss",
  
  // Artifact events
  ARTIFACT_CREATED: "factory:artifact:created",
  ARTIFACT_RETRIEVED: "factory:artifact:retrieved",
  ARTIFACT_PRUNED: "factory:artifact:pruned",
  
  // Worker events
  WORKER_STARTED: "factory:worker:started",
  WORKER_COMPLETED: "factory:worker:completed",
  WORKER_FAILED: "factory:worker:failed",
  
  // Validation events
  VALIDATION_STARTED: "factory:validation:started",
  VALIDATION_PASSED: "factory:validation:passed",
  VALIDATION_FAILED: "factory:validation:failed",
  
  // Preview events
  PREVIEW_STARTED: "factory:preview:started",
  PREVIEW_READY: "factory:preview:ready",
  PREVIEW_FAILED: "factory:preview:failed",
  
  // Publish events
  PUBLISH_STARTED: "factory:publish:started",
  PUBLISH_COMPLETED: "factory:publish:completed",
  PUBLISH_FAILED: "factory:publish:failed",
  
  // Release events
  RELEASE_REGISTERED: "factory:release:registered",
  
  // Queue events
  QUEUE_JOB_ADDED: "factory:queue:job:added",
  QUEUE_JOB_STARTED: "factory:queue:job:started",
  QUEUE_JOB_COMPLETED: "factory:queue:job:completed",
  QUEUE_JOB_FAILED: "factory:queue:job:failed",
  
  // Energy events
  ENERGY_RECORDED: "factory:energy:recorded",
  ENERGY_WARNING: "factory:energy:warning",
  ENERGY_LIMIT: "factory:energy:limit",
  
  // Policy events
  POLICY_ALLOW: "factory:policy:allow",
  POLICY_DENY: "factory:policy:deny",
  
  // Warehouse events
  WAREHOUSE_COMPONENT_ADDED: "factory:warehouse:component:added",
  WAREHOUSE_COMPONENT_RETRIEVED: "factory:warehouse:component:retrieved"
};

/* =============================================================================
   EVENT PAYLOAD BUILDERS
============================================================================= */

export function buildCommandReceivedPayload(command) {
  return {
    commandId: command.id,
    intent: command.intent,
    priority: command.priority,
    idempotencyKey: command.idempotencyKey,
    projectName: command.payload?.projectName
  };
}

export function buildCommandCompletedPayload(command, result) {
  return {
    commandId: command.id,
    intent: command.intent,
    traceId: result.traceId,
    success: result.ok,
    artifactCount: result.artifacts?.length || 0,
    durationMs: result.durationMs
  };
}

export function buildCommandFailedPayload(command, error) {
  return {
    commandId: command.id,
    intent: command.intent,
    errorCode: error.code || "UNKNOWN",
    errorMessage: error.message
  };
}

export function buildPipelineStartedPayload(traceId, command) {
  return {
    traceId,
    commandId: command.id,
    intent: command.intent,
    projectName: command.payload?.projectName
  };
}

export function buildPipelineCompletedPayload(traceId, result) {
  return {
    traceId,
    success: result.ok,
    phases: result.phases?.length || 0,
    artifactCount: result.artifacts?.length || 0,
    durationMs: result.durationMs
  };
}

export function buildPipelineFailedPayload(traceId, error, phase) {
  return {
    traceId,
    phase,
    errorCode: error.code || "UNKNOWN",
    errorMessage: error.message
  };
}

export function buildPhaseStartedPayload(traceId, phase) {
  return {
    traceId,
    phase
  };
}

export function buildPhaseCompletedPayload(traceId, phase, result) {
  return {
    traceId,
    phase,
    durationMs: result.durationMs,
    artifactId: result.artifactId
  };
}

export function buildPhaseFailedPayload(traceId, phase, error) {
  return {
    traceId,
    phase,
    errorCode: error.code || "UNKNOWN",
    errorMessage: error.message
  };
}

export function buildPhaseSkippedPayload(traceId, phase, reason) {
  return {
    traceId,
    phase,
    reason
  };
}

export function buildIncrementalHitPayload(traceId, checksum, prevBuildId) {
  return {
    traceId,
    checksum,
    prevBuildId,
    reused: true
  };
}

export function buildIncrementalMissPayload(traceId, checksum) {
  return {
    traceId,
    checksum,
    reused: false
  };
}

export function buildArtifactCreatedPayload(traceId, artifact) {
  return {
    traceId,
    artifactId: artifact.id,
    artifactType: artifact.type,
    bytes: artifact.bytes,
    checksum: artifact.checksum
  };
}

export function buildArtifactPrunedPayload(artifactIds, reason) {
  return {
    count: artifactIds.length,
    artifactIds: artifactIds.slice(0, 20),
    reason
  };
}

export function buildWorkerStartedPayload(traceId, workerType, taskId) {
  return {
    traceId,
    workerType,
    taskId
  };
}

export function buildWorkerCompletedPayload(traceId, workerType, taskId, result) {
  return {
    traceId,
    workerType,
    taskId,
    success: result.ok,
    durationMs: result.durationMs
  };
}

export function buildWorkerFailedPayload(traceId, workerType, taskId, error) {
  return {
    traceId,
    workerType,
    taskId,
    errorCode: error.code || "UNKNOWN",
    errorMessage: error.message
  };
}

export function buildValidationPassedPayload(traceId, reports) {
  return {
    traceId,
    reports: Object.keys(reports),
    failures: reports.totalWarnings || 0,
    passed: true
  };
}

export function buildValidationFailedPayload(traceId, reports, errors) {
  return {
    traceId,
    reports: Object.keys(reports),
    errorCount: errors.length,
    errors: errors.slice(0, 10)
  };
}

export function buildPreviewReadyPayload(traceId, previewArtifact) {
  return {
    traceId,
    artifactId: previewArtifact.id,
    entryPath: previewArtifact.entryPath,
    bytes: previewArtifact.bytes
  };
}

export function buildPublishStartedPayload(traceId, channel) {
  return {
    traceId,
    channel
  };
}

export function buildPublishCompletedPayload(traceId, release) {
  return {
    traceId,
    releaseId: release.id,
    channel: release.channel,
    version: release.version
  };
}

export function buildReleaseRegisteredPayload(release) {
  return {
    releaseId: release.id,
    projectName: release.projectName,
    version: release.version,
    channel: release.channel,
    checksum: release.checksum
  };
}

export function buildPolicyDenyPayload(traceId, policy, reason) {
  return {
    traceId,
    policy,
    reason,
    allowed: false
  };
}

export function buildEnergyRecordedPayload(phase, costMs, costBytes) {
  return {
    phase,
    costMs,
    costBytes
  };
}

export default FACTORY_EVENT;