// t3/Factory/pipeline/phases/normalize-phase.js
// T3 Factory - Normalize Phase
// Normalizes file paths, content encoding, line endings

import { BasePhase } from "../base-phase.js";
import { PIPELINE_PHASE } from "../../core/factory-types.js";
import { sortFilesByPath } from "../../core/factory-utils.js";

/* =============================================================================
   NORMALIZE PHASE
============================================================================= */

export class NormalizePhase extends BasePhase {

  constructor(opts = {}) {
    super({
      ...opts,
      name: "NormalizePhase",
      phase: PIPELINE_PHASE.NORMALIZE
    });

    this.normalizeLineEndings = opts.normalizeLineEndings !== false;
    this.trimTrailingWhitespace = opts.trimTrailingWhitespace || false;
  }

  async execute(context) {
    const files = context.files || [];
    const normalizedFiles = [];

    for (const file of files) {
      const normalized = this._normalizeFile(file);
      normalizedFiles.push(normalized);
    }

    // Sort for deterministic ordering
    const sortedFiles = sortFilesByPath(normalizedFiles);

    // Update context files
    context.files = sortedFiles;

    const result = {
      fileCount: sortedFiles.length,
      files: sortedFiles.map((f) => ({
        path: f.path,
        originalPath: f.originalPath,
        bytes: f.content.length,
        normalized: f.normalized
      }))
    };

    context.setPhaseResult(this.phase, result);

    return result;
  }

  _normalizeFile(file) {
    const originalPath = file.path || "unknown";
    let content = file.content || "";
    let normalized = false;

    // Normalize path
    let path = this._normalizePath(originalPath);
    if (path !== originalPath) {
      normalized = true;
    }

    // Normalize line endings (CRLF → LF)
    if (this.normalizeLineEndings && content.includes("\r\n")) {
      content = content.replace(/\r\n/g, "\n");
      normalized = true;
    }

    // Trim trailing whitespace
    if (this.trimTrailingWhitespace) {
      const trimmed = content
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n");

      if (trimmed !== content) {
        content = trimmed;
        normalized = true;
      }
    }

    return {
      path,
      originalPath,
      content,
      normalized
    };
  }

  _normalizePath(path) {
    // Remove leading/trailing slashes
    let normalized = path.trim();

    // Normalize separators
    normalized = normalized.replace(/\\/g, "/");

    // Remove double slashes
    normalized = normalized.replace(/\/+/g, "/");

    // Remove leading ./
    if (normalized.startsWith("./")) {
      normalized = normalized.slice(2);
    }

    // Remove leading /
    if (normalized.startsWith("/")) {
      normalized = normalized.slice(1);
    }

    return normalized;
  }
}

/* =============================================================================
   FACTORY
============================================================================= */

export function createNormalizePhase(opts = {}) {
  return new NormalizePhase(opts);
}

export default NormalizePhase;