// t3/Factory/pipeline/phases/intake-phase.js
// Intake Phase v5.0.0 — kaikki koodityypit tuettu
// Poistettu: Snack-rajoitukset, expo-app/web-react -whitelist
// Lisätty: html, vanilla-js, typescript, react-native, node-script

import { BasePhase } from "../base-phase.js";
import { PIPELINE_PHASE } from "../../core/factory-types.js";

var NAME_MIN     = 1;
var NAME_MAX     = 200;
var NAME_PATTERN = /^[a-zA-Z0-9 _.\-äöåÄÖÅ]+$/;

// Kaikki tuetut targetit — ei enää Snack-whitelist
var VALID_TARGETS = [
  "web-react",      // React JSX
  "expo-app",       // React Native / Expo
  "html",           // Vanilla HTML+CSS+JS
  "vanilla-js",     // Puhdas JavaScript
  "typescript",     // TypeScript
  "node-script",    // Node.js script
  "auto",           // Autodetect (oletus)
];

export function validateSpecName(rawName) {
  if (typeof rawName !== "string") return { ok: false, reason: "Name must be a string." };
  var name = rawName.trim();
  if (name.length < NAME_MIN) return { ok: false, reason: "Name is empty." };
  if (name.length > NAME_MAX) return { ok: false, reason: "Name too long (" + name.length + "/" + NAME_MAX + ")." };
  return { ok: true, value: name };
}

function detectTargetFromFiles(files) {
  if (!files || files.length === 0) return "web-react";

  var code = files.map(function(f) { return (f.content || ""); }).join("\n");
  var paths = files.map(function(f) { return (f.path || "").toLowerCase(); });

  // HTML
  if (paths.some(function(p) { return p.endsWith(".html"); }) ||
      /<!DOCTYPE\s+html/i.test(code) || /<html[\s>]/i.test(code)) {
    return "html";
  }

  // TypeScript
  if (paths.some(function(p) { return p.endsWith(".ts") || p.endsWith(".tsx"); }) ||
      /:\s*(string|number|boolean|void|any|unknown)\b/.test(code) ||
      /interface\s+\w+/.test(code)) {
    return "typescript";
  }

  // React Native / Expo
  if (/StyleSheet\.create/.test(code) ||
      /from ['"]react-native['"]/.test(code) ||
      /from ['"]expo/.test(code) ||
      paths.some(function(p) { return p.includes("app.json") || p.includes("app.config"); })) {
    return "expo-app";
  }

  // React JSX (web)
  if (/from ['"]react['"]/.test(code) ||
      /import React/.test(code) ||
      /useState|useEffect|useCallback/.test(code) ||
      /<[A-Z][a-zA-Z]*[\s/>]/.test(code) ||
      paths.some(function(p) { return p.endsWith(".jsx"); })) {
    return "web-react";
  }

  // Node.js
  if (/require\(['"]/.test(code) && !/window\.|document\./.test(code) ||
      /module\.exports/.test(code) ||
      /process\.env|__dirname|__filename/.test(code)) {
    return "node-script";
  }

  // Vanilla JS
  if (/document\.|window\.|addEventListener/.test(code)) {
    return "vanilla-js";
  }

  return "web-react"; // oletus
}

export class IntakePhase extends BasePhase {

  constructor(opts) {
    var o = opts || {};
    super({ ...o, name: "IntakePhase", phase: PIPELINE_PHASE ? PIPELINE_PHASE.INTAKE : "INTAKE" });
  }

  async execute(context) {
    var command = context.getCommand ? context.getCommand() : (context.command || {});
    var files   = command.files   || context.files || [];
    var name    = command.name    || command.projectName || "af51-build";
    var target  = command.target  || "auto";

    // Validoi nimi
    var nameResult = validateSpecName(name);
    if (!nameResult.ok) {
      throw new Error("IntakePhase: " + nameResult.reason);
    }
    name = nameResult.value;

    // Autodetect target jos "auto" tai tuntematon
    if (target === "auto" || !VALID_TARGETS.includes(target)) {
      target = detectTargetFromFiles(files);
    }

    // Normalisoi tiedostot
    var normalizedFiles = (files || []).map(function(f) {
      return {
        path:    (f.path || "src/App.jsx").replace(/\\/g, "/").replace(/^\//, ""),
        content: f.content || "",
        size:    (f.content || "").length,
      };
    });

    var buildSpec = {
      name:          name,
      target:        target,
      files:         normalizedFiles,
      fileCount:     normalizedFiles.length,
      totalBytes:    normalizedFiles.reduce(function(s, f) { return s + f.size; }, 0),
      buildPipeline: ["INTAKE", "VALIDATE", "AUTOFIX", "BUILD", "PREVIEW"],
      artifactId:    name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString(36),
      projectType:   target,
    };

    if (context.setBuildSpec) context.setBuildSpec(buildSpec);
    if (context.setPhaseResult) context.setPhaseResult("INTAKE", { ok: true, target, fileCount: normalizedFiles.length });
    if (context.setNormalizedFiles) context.setNormalizedFiles(normalizedFiles);

    return {
      ok:         true,
      name:       name,
      target:     target,
      fileCount:  normalizedFiles.length,
      buildSpec:  buildSpec,
    };
  }
}

export default IntakePhase;