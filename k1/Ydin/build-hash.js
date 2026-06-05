// k1/Ydin/build-hash.js
// AF51 Next-Gen — Build Hash + Determinism Checksum
// Same input → same artifact hash. Every time.
// Enterprise signal: reproducible builds.

// FNV-1a 32-bit (deterministic, no external deps)
function fnv1a32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// Stable JSON stringify (sorted keys — deterministic)
function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export class BuildHash {
  constructor(opts = {}) {
    this._clock = opts.clock || null;
  }

  // Hash a set of input files (content-addressable)
  hashFiles(files) {
    if (!files || !files.length) return fnv1a32("empty");
    const sorted = [...files].sort((a, b) => (a.path || "").localeCompare(b.path || ""));
    const combined = sorted.map(f => `${f.path}:${f.content || ""}`).join("|");
    return fnv1a32(combined);
  }

  // Hash a BuildSpec (for incremental check)
  hashSpec(buildSpec) {
    const normalized = {
      target:       buildSpec.target,
      projectType:  buildSpec.projectType,
      entry:        buildSpec.entry,
      dependencies: (buildSpec.dependencies || []).slice().sort(),
    };
    return fnv1a32(stableStringify(normalized));
  }

  // Full artifact hash: files + spec + pipeline
  hashArtifact(files, buildSpec, pipelinePhases) {
    const fileHash     = this.hashFiles(files);
    const specHash     = this.hashSpec(buildSpec);
    const pipelineHash = fnv1a32((pipelinePhases || []).join(","));
    return {
      fileHash,
      specHash,
      pipelineHash,
      // Combined deterministic hash
      artifactHash: fnv1a32(`${fileHash}|${specHash}|${pipelineHash}`),
    };
  }

  // Verify two builds are deterministic
  verify(hash1, hash2) {
    return {
      deterministic: hash1.artifactHash === hash2.artifactHash,
      fileMatch:     hash1.fileHash     === hash2.fileHash,
      specMatch:     hash1.specHash     === hash2.specHash,
      pipelineMatch: hash1.pipelineHash === hash2.pipelineHash,
    };
  }

  // Quick hash for any string/object
  hash(input) {
    if (typeof input === "string") return fnv1a32(input);
    return fnv1a32(stableStringify(input));
  }
}

export const buildHashFn  = fnv1a32;
export const stableJSON   = stableStringify;

export function createBuildHash(opts) {
  return new BuildHash(opts);
}

export default BuildHash;
