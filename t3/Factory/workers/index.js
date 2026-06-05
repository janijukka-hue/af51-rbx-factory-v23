// t3/Factory/workers/index.js
// Factory Workers Entry Point — only workers that exist are exported.

export { BaseWorker, createBaseWorker, WORKER_STATE as BASE_WORKER_STATE } from "./base-worker.js";
export { AL2BuilderWorker, createAL2BuilderWorker } from "./al2-builder-worker.js";
export { PackagerWorker, createPackagerWorker } from "./packager-worker.js";
export { PredictionWorker, createPredictionWorker, WORKER_STATE, WORKER_TYPE } from "./prediction-worker.js";
export { PublisherWorker, createPublisherWorker } from "./publisher-worker.js";
export { SecurityScannerWorker, createSecurityScannerWorker } from "./security-scanner-worker.js";

var WORKER_REGISTRY = {
  AL2_BUILDER: "AL2BuilderWorker",
  PACKAGER: "PackagerWorker",
  PREDICTION: "PredictionWorker",
  PUBLISHER: "PublisherWorker",
  SECURITY_SCANNER: "SecurityScannerWorker"
};

export { WORKER_REGISTRY };
