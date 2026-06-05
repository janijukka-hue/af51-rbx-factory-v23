// k1/code-detector/RuntimeClassifier.js

export function buildRuntimeProfile(scan, detection, selected) {
  const deps = scan.signatures.dependencies || [];
  return {
    projectType: detection.projectType,
    target: selected.target,
    pipeline: selected.pipeline,
    validationProfile: selected.validationProfile,
    packageManager: scan.packageJson?.packageManager || (scan.packageJson ? "npm" : null),
    scripts: scan.packageJson?.scripts || {},
    dependencies: deps.slice(0, 40),
    previewSupported: ["web_runtime", "expo_runtime", "static_runtime", "factory_runtime"].includes(selected.target),
    packageSupported: detection.projectType !== "unknown",
    auditRequired: true,
  };
}

export default { buildRuntimeProfile };