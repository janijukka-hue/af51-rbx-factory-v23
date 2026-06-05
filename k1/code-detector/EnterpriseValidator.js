// k1/code-detector/EnterpriseValidator.js
// Validation gate for classification. It validates the detected route, not arbitrary internet code execution.

const BLOCKING_TYPES = new Set(["unknown"]);

export function validateDetection(result) {
  const errors = [];
  const failures = [];

  if (!result || !result.projectType) {
    errors.push({ code: "NO_DETECTION_RESULT", message: "No detection result produced." });
  }

  if (result && BLOCKING_TYPES.has(result.projectType)) {
    errors.push({ code: "UNKNOWN_PROJECT_TYPE", message: "Project type could not be routed deterministically." });
  }

  if (result && result.confidence < 0.5) {
    errors.push({ code: "LOW_CONFIDENCE", message: "Detection confidence is below enterprise routing threshold." });
  } else if (result && result.confidence < 0.8) {
    failures.push({ code: "MEDIUM_CONFIDENCE", message: "Project is routable, but manual review is recommended." });
  }

  if (result && !result.pipeline) {
    errors.push({ code: "NO_PIPELINE", message: "No pipeline selected for detected project type." });
  }

  return {
    ok: errors.length === 0,
    policy: errors.length === 0 ? "ALLOW_PIPELINE_ROUTE" : "FAIL_CLOSED",
    errors,
    failures,
  };
}

export default { validateDetection };