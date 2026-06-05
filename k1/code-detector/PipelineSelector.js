// k1/code-detector/PipelineSelector.js

import { PIPELINES, PROJECT_TYPES, TARGETS } from "./DetectorRegistry.js";

const MAP = {
  [PROJECT_TYPES.AF51_FACTORY_RUNTIME]: { target: TARGETS.FACTORY_RUNTIME, pipeline: PIPELINES.AF51_FACTORY_PIPELINE, validationProfile: "af51_factory" },
  [PROJECT_TYPES.EXPO_REACT_NATIVE_APP]: { target: TARGETS.EXPO_RUNTIME, pipeline: PIPELINES.EXPO_PIPELINE, validationProfile: "expo_react_native" },
  [PROJECT_TYPES.VITE_REACT_APP]: { target: TARGETS.WEB_RUNTIME, pipeline: PIPELINES.WEB_PIPELINE, validationProfile: "vite_react" },
  [PROJECT_TYPES.REACT_SINGLE_COMPONENT]: { target: TARGETS.SNACK_RUNTIME, pipeline: PIPELINES.SNACK_PIPELINE, validationProfile: "single_component" },
  [PROJECT_TYPES.NEXT_APP]: { target: TARGETS.NEXT_RUNTIME, pipeline: PIPELINES.NEXT_PIPELINE, validationProfile: "next" },
  [PROJECT_TYPES.HTML_CSS_JS_PROJECT]: { target: TARGETS.STATIC_RUNTIME, pipeline: PIPELINES.STATIC_PIPELINE, validationProfile: "static_web" },
  [PROJECT_TYPES.NODE_EXPRESS_RUNTIME]: { target: TARGETS.NODE_RUNTIME, pipeline: PIPELINES.NODE_PIPELINE, validationProfile: "node_express" },
  [PROJECT_TYPES.NODE_RUNTIME]: { target: TARGETS.NODE_RUNTIME, pipeline: PIPELINES.NODE_PIPELINE, validationProfile: "node" },
  [PROJECT_TYPES.PACKAGE_JSON_PROJECT]: { target: TARGETS.REVIEW, pipeline: PIPELINES.PACKAGE_SCAN_PIPELINE, validationProfile: "package_json" },
  [PROJECT_TYPES.UNKNOWN]: { target: TARGETS.REVIEW, pipeline: PIPELINES.REVIEW_PIPELINE, validationProfile: "manual_review" },
};

export function selectPipeline(projectType) {
  return MAP[projectType] || MAP[PROJECT_TYPES.UNKNOWN];
}

export default { selectPipeline };