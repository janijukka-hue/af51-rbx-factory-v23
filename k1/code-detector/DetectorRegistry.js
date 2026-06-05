// k1/code-detector/DetectorRegistry.js
// Deterministic rule registry for AF51 code/project type separation.

export const DETECTOR_VERSION = "AF51_CODE_TYPE_DETECTOR_V1.0.0";

export const AF51_DOCTRINE = [
  "Detect first",
  "Separate type from intent",
  "Route by deterministic signatures",
  "Validate before execution",
  "Audit every classification",
];

export const PROJECT_TYPES = {
  AF51_FACTORY_RUNTIME: "af51_factory_runtime",
  EXPO_REACT_NATIVE_APP: "expo_react_native_app",
  VITE_REACT_APP: "vite_react_app",
  REACT_SINGLE_COMPONENT: "react_single_component",
  NEXT_APP: "next_app",
  HTML_CSS_JS_PROJECT: "html_css_js_project",
  NODE_EXPRESS_RUNTIME: "node_express_runtime",
  NODE_RUNTIME: "node_runtime",
  PACKAGE_JSON_PROJECT: "package_json_project",
  UNKNOWN: "unknown",
};

export const PIPELINES = {
  AF51_FACTORY_PIPELINE: "AF51_FACTORY_PIPELINE_V1",
  EXPO_PIPELINE: "EXPO_REACT_NATIVE_PIPELINE_V1",
  WEB_PIPELINE: "WEB_REACT_PIPELINE_V1",
  SNACK_PIPELINE: "SNACK_SINGLE_FILE_PIPELINE_V1",
  NEXT_PIPELINE: "NEXT_PIPELINE_V1",
  STATIC_PIPELINE: "STATIC_WEB_PIPELINE_V1",
  NODE_PIPELINE: "NODE_RUNTIME_PIPELINE_V1",
  PACKAGE_SCAN_PIPELINE: "PACKAGE_SCAN_PIPELINE_V1",
  REVIEW_PIPELINE: "MANUAL_REVIEW_PIPELINE",
};

export const TARGETS = {
  FACTORY_RUNTIME: "factory_runtime",
  EXPO_RUNTIME: "expo_runtime",
  WEB_RUNTIME: "web_runtime",
  SNACK_RUNTIME: "snack_runtime",
  NEXT_RUNTIME: "next_runtime",
  STATIC_RUNTIME: "static_runtime",
  NODE_RUNTIME: "node_runtime",
  REVIEW: "manual_review",
};