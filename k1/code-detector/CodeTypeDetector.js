// k1/code-detector/CodeTypeDetector.js
// AF51 public code type separation entry point.

import { scanProject } from "./SignatureScanner.js";
import { detectFramework } from "./FrameworkDetector.js";
import { selectPipeline } from "./PipelineSelector.js";
import { buildRuntimeProfile } from "./RuntimeClassifier.js";
import { AF51_DOCTRINE, DETECTOR_VERSION } from "./DetectorRegistry.js";

export function detectCodeType(rootDir, options = {}) {
  const scan = scanProject(rootDir, options);
  const detection = detectFramework(scan);
  const selected = selectPipeline(detection.projectType);
  const runtime = buildRuntimeProfile(scan, detection, selected);

  return {
    ok: detection.projectType !== "unknown",
    detectorVersion: DETECTOR_VERSION,
    doctrine: AF51_DOCTRINE,
    detectedAt: new Date().toISOString(),
    projectRoot: scan.projectRoot,
    projectType: detection.projectType,
    confidence: detection.confidence,
    target: runtime.target,
    pipeline: runtime.pipeline,
    validationProfile: runtime.validationProfile,
    runtime,
    reasons: detection.reasons,
    stats: scan.stats,
  };
}

export default { detectCodeType };