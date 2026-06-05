// t3/Factory/core/factory-types.js
// Factory Type Definitions

export const FACTORY_STATE = {
  OFFLINE:    "OFFLINE",
  IDLE:       "IDLE",
  BUILDING:   "BUILDING",
  PUBLISHING: "PUBLISHING",
  ERROR:      "ERROR"
};

export const COMMAND_INTENT = {
  BUILD:             "BUILD",
  BUILD_PROJECT:     "BUILD_PROJECT",   // ProjectSpec-pohjainen build
  BUILD_AND_PUBLISH: "BUILD_AND_PUBLISH",
  VALIDATE:          "VALIDATE",
  INSPECT:           "INSPECT",
  PACKAGE:           "PACKAGE",
  PUBLISH:           "PUBLISH",
  PREVIEW:           "PREVIEW",
  QUERY_STATUS:      "QUERY_STATUS",
  PRUNE_ARTIFACTS:   "PRUNE_ARTIFACTS"
};

export const PIPELINE_PHASE = {
  // Alkuperäiset
  INTAKE:            "INTAKE",
  NORMALIZE:         "NORMALIZE",
  INCREMENTAL_CHECK: "INCREMENTAL_CHECK",
  PLAN:              "PLAN",
  BUILD:             "BUILD",
  VALIDATE:          "VALIDATE",
  PACKAGE:           "PACKAGE",
  PREVIEW:           "PREVIEW",
  PUBLISH:           "PUBLISH",
  // Uudet enterprise-stagit
  TEMPLATE:          "TEMPLATE",    // Kopioi template workspaceen
  SYNTHESIZE:        "SYNTHESIZE",  // Soveltaa patch-setin
  DEPS:              "DEPS",        // npm ci
  SECURITY:          "SECURITY"     // npm audit + secret scan + blacklist
};

export const BUILD_STATUS = {
  PENDING:   "PENDING",
  RUNNING:   "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED:    "FAILED",
  CANCELLED: "CANCELLED"
};

export const ARTIFACT_TYPE = {
  SOURCE:  "SOURCE",
  BUILD:   "BUILD",
  PACKAGE: "PACKAGE",
  PREVIEW: "PREVIEW",
  RELEASE: "RELEASE"
};

export const PUBLISH_CHANNEL = {
  LOCAL:              "LOCAL",
  INTERNAL_REGISTRY:  "INTERNAL_REGISTRY",
  PRIVATE_ENTERPRISE: "PRIVATE_ENTERPRISE",
  GOOGLE_PLAY:        "GOOGLE_PLAY",
  APPLE_APP_STORE:    "APPLE_APP_STORE",
  TESTFLIGHT:         "TESTFLIGHT",
  WEB_HOSTING:        "WEB_HOSTING",
  EXPORT_ZIP:         "EXPORT_ZIP"
};

export const PUBLISH_STATUS = {
  PENDING:    "PENDING",
  UPLOADING:  "UPLOADING",
  PROCESSING: "PROCESSING",
  REVIEW:     "REVIEW",
  PUBLISHED:  "PUBLISHED",
  FAILED:     "FAILED",
  REJECTED:   "REJECTED"
};

export const PROJECT_KIND = {
  APP:     "APP",
  GAME:    "GAME",
  LIB:     "LIB",
  UNKNOWN: "UNKNOWN"
};

export const QUALITY_READINESS = {
  NOT_READY:      "NOT_READY",
  ALPHA:          "ALPHA",
  BETA:           "BETA",
  RC:             "RC",
  PROD_CANDIDATE: "PROD_CANDIDATE"
};

export const RISK_LEVEL = {
  LOW:     "LOW",
  MEDIUM:  "MEDIUM",
  HIGH:    "HIGH",
  BLOCKED: "BLOCKED"
};

export default {
  FACTORY_STATE,
  COMMAND_INTENT,
  PIPELINE_PHASE,
  BUILD_STATUS,
  ARTIFACT_TYPE,
  PUBLISH_CHANNEL,
  PUBLISH_STATUS,
  PROJECT_KIND,
  QUALITY_READINESS,
  RISK_LEVEL
};