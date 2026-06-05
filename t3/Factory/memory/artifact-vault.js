// t3/Factory/memory/artifact-vault.js
// Artifact Vault - Build artifact storage

import { fnv1a32 } from "../core/factory-utils.js";

export class ArtifactVault {
  constructor(options = {}) {
    this._clock = options.clock;
    this._maxArtifacts = options.maxArtifacts || 10000;
    this._artifacts = new Map();
    this._checksumIndex = new Map();
    this._protected = new Set();
  }

  store(artifact) {
    if (this._artifacts.size >= this._maxArtifacts && !this._artifacts.has(artifact.id)) {
      this._pruneOldest(1);
    }

    const entry = {
      ...artifact,
      storedAt: this._clock?.now() || Date.now()
    };

    this._artifacts.set(artifact.id, entry);

    if (artifact.checksum) {
      this._checksumIndex.set(artifact.checksum, artifact.id);
    }

    return { ok: true, artifactId: artifact.id };
  }

  get(id) {
    return this._artifacts.get(id) || null;
  }

  getByChecksum(checksum) {
    const id = this._checksumIndex.get(checksum);
    return id ? this._artifacts.get(id) : null;
  }

  getLatest() {
    let latest = null;
    let latestTime = 0;

    for (const artifact of this._artifacts.values()) {
      if (artifact.storedAt > latestTime) {
        latestTime = artifact.storedAt;
        latest = artifact;
      }
    }

    return latest;
  }

  getAll() {
    return Array.from(this._artifacts.values());
  }

  getRecent(count = 20) {
    return Array.from(this._artifacts.values())
      .sort((a, b) => b.storedAt - a.storedAt)
      .slice(0, count);
  }

  protect(id) {
    this._protected.add(id);
  }

  unprotect(id) {
    this._protected.delete(id);
  }

  delete(id) {
    if (this._protected.has(id)) {
      return { ok: false, error: "Artifact is protected" };
    }

    const artifact = this._artifacts.get(id);
    if (artifact?.checksum) {
      this._checksumIndex.delete(artifact.checksum);
    }
    this._artifacts.delete(id);
    return { ok: true };
  }

  prune(cutoffTimestamp) {
    let pruned = 0;

    for (const [id, artifact] of this._artifacts) {
      if (this._protected.has(id)) continue;
      if (artifact.storedAt < cutoffTimestamp) {
        if (artifact.checksum) {
          this._checksumIndex.delete(artifact.checksum);
        }
        this._artifacts.delete(id);
        pruned++;
      }
    }

    return pruned;
  }

  _pruneOldest(count) {
    const sorted = Array.from(this._artifacts.entries())
      .filter(([id]) => !this._protected.has(id))
      .sort((a, b) => a[1].storedAt - b[1].storedAt);

    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      const [id, artifact] = sorted[i];
      if (artifact.checksum) {
        this._checksumIndex.delete(artifact.checksum);
      }
      this._artifacts.delete(id);
    }
  }

  getStats() {
    return {
      count: this._artifacts.size,
      maxArtifacts: this._maxArtifacts,
      protectedCount: this._protected.size,
      checksumIndexSize: this._checksumIndex.size
    };
  }
}

export function createArtifactVault(options) {
  return new ArtifactVault(options);
}

export default ArtifactVault;