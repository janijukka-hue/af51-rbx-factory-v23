// t3/Factory/pipeline/phases/index.js
// Olemassa olevat
export { IntakePhase,           createIntakePhase           } from "./intake-phase.js";
export { NormalizePhase,        createNormalizePhase        } from "./normalize-phase.js";
export { IncrementalCheckPhase, createIncrementalCheckPhase } from "./incremental-check-phase.js";
export { PlanPhase,             createPlanPhase             } from "./plan-phase.js";
export { BuildPhase,            createBuildPhase            } from "./build-phase.js";
export { ValidatePhase,         createValidatePhase         } from "./validate-phase.js";
export { PackagePhase,          createPackagePhase          } from "./package-phase.js";
export { PreviewPhase,          createPreviewPhase          } from "./preview-phase.js";
export { PublishPhase,          createPublishPhase          } from "./publish-phase.js";
// Uudet
export { TemplatePhase,         createTemplatePhase         } from "./template-phase.js";
export { SynthesizePhase,       createSynthesizePhase       } from "./synthesize-phase.js";
export { DepsPhase,             createDepsPhase             } from "./deps-phase.js";
export { SecurityPhase,         createSecurityPhase         } from "./security-phase.js";