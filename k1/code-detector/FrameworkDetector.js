// k1/code-detector/FrameworkDetector.js
// Rule-based classification. No generation, no guessing.

import { PROJECT_TYPES } from "./DetectorRegistry.js";

function candidate(projectType, confidence, reasons) {
  return { projectType, confidence, reasons };
}

export function detectFramework(scan) {
  const s = scan.signatures;
  const candidates = [];

  if (s.hasAF51Factory) {
    candidates.push(candidate(PROJECT_TYPES.AF51_FACTORY_RUNTIME, 0.99, ["server.js found", "k1/index.js found", "t3/Factory found"]));
  }

  if ((s.hasExpoConfig || s.hasExpoDep) && (s.hasReactNativeDep || s.hasReactNative || s.hasRootAppJs)) {
    candidates.push(candidate(PROJECT_TYPES.EXPO_REACT_NATIVE_APP, 0.96, ["Expo config/dependency found", "React Native root App detected"]));
  }

  if (s.isSingleFile && s.hasReactNative && s.hasReactComponent) {
    candidates.push(candidate(PROJECT_TYPES.EXPO_REACT_NATIVE_APP, 0.88, ["Single-file React Native component signature found", "Expo/RN preview adapter required"]));
  }

  if ((s.hasViteConfig || s.hasViteDep) && s.hasReactDep && (s.hasSrcMain || s.hasReactDom || s.hasSrcApp)) {
    candidates.push(candidate(PROJECT_TYPES.VITE_REACT_APP, 0.96, ["Vite signature found", "React dependency found", "src entry/component found"]));
  }

  if ((s.hasNextConfig || s.hasNextDep) && s.hasReactDep) {
    candidates.push(candidate(PROJECT_TYPES.NEXT_APP, 0.94, ["Next.js signature found", "React dependency found"]));
  }

  if (s.hasReactComponent && !s.hasPackageJson && !s.hasViteConfig && !s.hasExpoConfig) {
    candidates.push(candidate(PROJECT_TYPES.REACT_SINGLE_COMPONENT, 0.82, ["Standalone App component signature found", "No package/runtime config found"]));
  }

  if (s.hasExpressDep || s.hasExpressImport) {
    candidates.push(candidate(PROJECT_TYPES.NODE_EXPRESS_RUNTIME, 0.9, ["Express signature found"]));
  }

  if (s.hasServerJs && s.hasPackageJson) {
    candidates.push(candidate(PROJECT_TYPES.NODE_RUNTIME, 0.78, ["server.js found", "package.json found"]));
  }

  if (s.hasHtmlCssJs) {
    candidates.push(candidate(PROJECT_TYPES.HTML_CSS_JS_PROJECT, 0.74, ["index.html found", "static web files found"]));
  }

  if (s.hasPackageJson) {
    candidates.push(candidate(PROJECT_TYPES.PACKAGE_JSON_PROJECT, 0.55, ["package.json found"]));
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0] || candidate(PROJECT_TYPES.UNKNOWN, 0.2, ["No strong deterministic signature found"]);
}

export default { detectFramework };