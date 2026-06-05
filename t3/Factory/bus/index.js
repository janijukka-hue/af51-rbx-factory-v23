// t3/Factory/bus/index.js
// T3 Factory - Event Bus Index

export {
  buildCommandReceivedPayload,
  buildPipelineStartedPayload,
  buildPipelineCompletedPayload,
  buildPipelineFailedPayload,
  buildPhaseStartedPayload,
  buildPhaseCompletedPayload,
  buildPhaseFailedPayload,
  buildIncrementalHitPayload,
  buildIncrementalMissPayload,
  buildArtifactCreatedPayload,
  buildWorkerStartedPayload,
  buildWorkerCompletedPayload,
  buildValidationPassedPayload,
  buildValidationFailedPayload,
  buildPublishStartedPayload,
  buildPublishCompletedPayload,
  buildReleaseRegisteredPayload
} from "./factory-events.js";

// ⚠️  DEPRECATED: FactoryEventBus ei ole käytössä. Factory.js käyttää K1 EventBus:ia.
// export { FactoryEventBus, createFactoryEventBus } from "./factory-eventbus.js";