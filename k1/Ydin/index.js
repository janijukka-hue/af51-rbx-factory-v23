// k1/Ydin/index.js
// K1 Kernel - Main Entry Point
// Exporttaa kaikki k1-primitiivit

// Core
export { default as Kernel } from "./kernel.js";
export { EventBus, createEventBus } from "./eventbus.js";

// Energy & Observability
export {
  EnergyRing,
  DriftController,
  ObservabilityCore,
  createEnergySystem,
  COOLING_LEVEL,
  ENERGY_SIGNAL,
  DRIFT_SEVERITY
} from "./energia.js";

// Memory
export {
  MemoryRing,
  createMemorySystem,
  COOLING_LEVEL as MEMORY_COOLING_LEVEL,
  REDACTION,
  RING_TIER,
  MEMORY_SIGNAL
} from "./muisti.js";

// Decision
export {
  DecisionCourt,
  createDecisionCourt,
  DECISION_STATUS,
  DECISION_PRIORITY,
  DECISION_DOMAIN
} from "./paatos.js";

// Policy
export {
  PolicyEngine,
  ConstraintEvaluator,
  createPolicyEngine,
  createConstraintEvaluator,
  AL_ROLE,
  ACTION_TYPE,
  POLICY_MODE,
  CONSTRAINT_TYPE,
  energyConstraint,
  memoryConstraint,
  timeConstraint,
  roleConstraint,
  modeConstraint
} from "./policy.js";

// Audit
export {
  AuditLedger,
  createAuditLedger,
  NoopSeal,
  SimpleSeal,
  HMACSeal,
  AUDIT_LEVEL,
  AUDIT_AREA
} from "./audit.js";

// Primitives
export {
  fnv1a32,
  stableStringify,
  clone,
  clamp,
  DeterministicRuntime,
  globalRuntime,
  ENERGY_COSTS,
  COOLING,
  PRIORITY
} from "./alydin.js";

// Seams
export {
  SystemClock,
  FixedClock,
  MemoryStorage,
  stableStringify as seamsStableStringify,
  fnv1a32Hex,
  hashSync,
  sha256HexAsync
} from "./core-seams.js";

// Enterprise Facade
export {
  EnterpriseALCore,
  createEnterpriseALCore
} from "./enterprise-al-core.js";

// Default export
export { default } from "./kernel.js";