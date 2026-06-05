// m2/Ohjaus/index.js
// Olemassa olevat
export { Orchestrator, createOrchestrator, ORCHESTRATOR_STATE, ORCHESTRATOR_VERSION } from "./orchestrator.js";
export { LearningEngine, createLearningEngine, LEARNING_STATE }                       from "./learning-engine.js";
export { FactoryBridge, createFactoryBridge }                                         from "./factory-bridge.js";
export { ALFactoryConnector, createALFactoryConnector }                               from "./al-factory-connector.js";
export { MasterRoom, createMasterRoom, MASTERROOM_STATE }                             from "./masterroom.js";
// Uusi
export { buildProjectSpec, validateProjectSpec, specToT3Command,
         specExpoApp, specNodeService, specWebReact,
         TARGET, STACK, FEATURE, CONSTRAINT, PROJECT_SPEC_VERSION }                   from "./project-spec.js";