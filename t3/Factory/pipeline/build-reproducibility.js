// t3/Factory/pipeline/build-reproducibility.js
// KERROS: T3 – Factory/Tuotanto
// Version: 1.0.0
//
// Build Reproducibility — deterministinen buildien toistettavuus.
//
// Tallentaa per-build snapshotin:
//   - dependency snapshot (package.json + lockfile hash)
//   - environment snapshot (node version, platform, template version)
//   - template version
//   - käytetty config + features
//   - packageHash + distHash
//
// Verify: vertaa uuden buildin snapshotin vanhan kanssa.
// Jos kaikki kentät täsmäävät → sama hash odotetaan.
//
// Käyttö:
//   BuildPipeline kutsuu captureSnapshot() PackagePhase:n jälkeen.
//   FactoryBridge kutsuu verify() kun halutaan toistaa build.

// ─── Snapshot schema ─────────────────────────────────────────

var SNAPSHOT_VERSION = "1.0";

// ─── BuildReproducibility ────────────────────────────────────

function BuildReproducibility(options) {
  var opts = options || {};
  this._debug    = opts.debug    || false;
  this._snapshots = new Map();   // traceId → BuildSnapshot
  this._maxSnapshots = opts.maxSnapshots || 200;
}

// ── captureSnapshot(traceId, data) ───────────────────────────
// Tallennetaan PackagePhase:n jälkeen.
//
// data: {
//   command      — alkuperäinen build-komento
//   artifact     — PackagePhase:n tuottama artifakti
//   workspace    — WorkspaceAdapter (lukee tiedostolistan)
//   templateMeta — template.meta objekti
//   features     — valitut featuret
// }

BuildReproducibility.prototype.captureSnapshot = function(traceId, data) {
  if (!traceId || !data) return { ok: false, error: "traceId ja data vaaditaan" };

  var cmd      = data.command   || {};
  var artifact = data.artifact  || {};
  var tmeta    = data.templateMeta || {};

  // ── Dependency snapshot ─────────────────────────────────
  var depSnapshot = this._captureDependencies(data.workspace);

  // ── Environment snapshot ────────────────────────────────
  var envSnapshot = {
    platform:        (typeof process !== "undefined" && process.platform) || "browser",
    nodeVersion:     (typeof process !== "undefined" && process.version)  || "n/a",
    snackEnv:        typeof __DEV__ !== "undefined" ? "expo" : "node",
    timestamp:       Date.now()   // EI käytetä hash-vertailuun — vain metadataa
  };

  // ── Template snapshot ───────────────────────────────────
  var templateSnapshot = {
    id:          tmeta.id          || cmd.target || "unknown",
    version:     tmeta.version     || "1.0.0",
    stack:       tmeta.stack       || null,
    sdkVersion:  tmeta.sdkVersion  || null
  };

  // ── Config snapshot ─────────────────────────────────────
  var configSnapshot = {
    target:      cmd.target      || null,
    projectName: cmd.projectName || null,
    version:     cmd.version     || "1.0.0",
    features:    Array.isArray(cmd.features) ? cmd.features.slice().sort() : [],
    constraints: cmd.constraints || {}
  };

  // ── Hash snapshot ───────────────────────────────────────
  var hashSnapshot = {
    packageHash: artifact.package  ? artifact.package.zipHash  : (artifact.checksum || null),
    distHash:    artifact.build    ? artifact.build.distHash   : null,
    fileCount:   artifact.build    ? artifact.build.fileCount  : 0,
    fileHashes:  artifact.files
      ? artifact.files.map(function(f) { return f.path + ":" + f.hash; }).sort()
      : []
  };

  // ── Reproducibility key ─────────────────────────────────
  // Tämä on se merkkijono joka pitää olla identtinen toistetussa buildissa
  var reproducibilityKey = JSON.stringify({
    template:    templateSnapshot,
    config:      configSnapshot,
    deps:        depSnapshot.lockfileHash || "no-lockfile"
  });

  var snapshot = {
    snapshotVersion:    SNAPSHOT_VERSION,
    traceId:            traceId,
    capturedAt:         Date.now(),
    reproducibilityKey: reproducibilityKey,
    dependencies:       depSnapshot,
    environment:        envSnapshot,
    template:           templateSnapshot,
    config:             configSnapshot,
    hashes:             hashSnapshot
  };

  this._snapshots.set(traceId, snapshot);
  if (this._snapshots.size > this._maxSnapshots) {
    var oldest = this._snapshots.keys().next().value;
    this._snapshots.delete(oldest);
  }

  if (this._debug) {
    console.log("[BuildReproducibility] snapshot captured:", traceId,
      "packageHash:", hashSnapshot.packageHash ? hashSnapshot.packageHash.slice(0, 12) : "n/a");
  }

  return { ok: true, snapshot: snapshot };
};

// ── verify(traceId1, traceId2) ───────────────────────────────
// Vertaa kahden buildin snapshotit.
// Palauttaa: { ok, identical, differences: [] }

BuildReproducibility.prototype.verify = function(traceId1, traceId2) {
  var s1 = this._snapshots.get(traceId1);
  var s2 = this._snapshots.get(traceId2);

  if (!s1) return { ok: false, error: "Snapshot ei löydy: " + traceId1 };
  if (!s2) return { ok: false, error: "Snapshot ei löydy: " + traceId2 };

  var differences = [];

  // 1. Reproducibility key — tärkein tarkistus
  if (s1.reproducibilityKey !== s2.reproducibilityKey) {
    differences.push({
      field:    "reproducibilityKey",
      severity: "blocking",
      reason:   "Eri template/config/deps — sama hash ei ole odotettavissa"
    });
  }

  // 2. Package hash — pitäisi täsmätä jos key täsmää
  if (s1.hashes.packageHash && s2.hashes.packageHash) {
    if (s1.hashes.packageHash !== s2.hashes.packageHash) {
      differences.push({
        field:    "packageHash",
        severity: "critical",
        v1:       s1.hashes.packageHash.slice(0, 16),
        v2:       s2.hashes.packageHash.slice(0, 16),
        reason:   "Package hash eroaa — build ei ole deterministinen"
      });
    }
  }

  // 3. File count
  if (s1.hashes.fileCount !== s2.hashes.fileCount) {
    differences.push({
      field:    "fileCount",
      severity: "warn",
      v1:       s1.hashes.fileCount,
      v2:       s2.hashes.fileCount,
      reason:   "Tiedostojen määrä eroaa"
    });
  }

  // 4. Template versio
  if (s1.template.version !== s2.template.version) {
    differences.push({
      field:    "templateVersion",
      severity: "warn",
      v1:       s1.template.version,
      v2:       s2.template.version,
      reason:   "Template-versio muuttunut"
    });
  }

  // 5. Features
  var f1 = JSON.stringify(s1.config.features);
  var f2 = JSON.stringify(s2.config.features);
  if (f1 !== f2) {
    differences.push({
      field:    "features",
      severity: "blocking",
      v1:       s1.config.features,
      v2:       s2.config.features,
      reason:   "Features eroavat"
    });
  }

  var identical = differences.length === 0;
  var hasCritical = differences.some(function(d) { return d.severity === "critical"; });

  if (this._debug) {
    console.log("[BuildReproducibility] verify:", traceId1, "vs", traceId2,
      identical ? "✓ identtiset" : "✗ " + differences.length + " eroa");
  }

  return {
    ok:          true,
    identical:   identical,
    hasCritical: hasCritical,
    differences: differences,
    traceId1:    traceId1,
    traceId2:    traceId2
  };
};

// ── verifyAgainstKey(traceId, reproducibilityKey) ────────────
// Vertaa yksittäistä buildia tallennettuun avaimeen (ilman toista buildia).

BuildReproducibility.prototype.verifyAgainstKey = function(traceId, reproducibilityKey) {
  var snapshot = this._snapshots.get(traceId);
  if (!snapshot) return { ok: false, error: "Snapshot ei löydy: " + traceId };

  var matches = snapshot.reproducibilityKey === reproducibilityKey;
  return {
    ok:      true,
    matches: matches,
    reason:  matches ? null : "Reproducibility key eroaa — eri config/template/deps"
  };
};

// ── getSnapshot(traceId) ─────────────────────────────────────

BuildReproducibility.prototype.getSnapshot = function(traceId) {
  return this._snapshots.get(traceId) || null;
};

BuildReproducibility.prototype.getSnapshotCount = function() {
  return this._snapshots.size;
};

BuildReproducibility.prototype.getRecentSnapshots = function(limit) {
  var n      = limit || 10;
  var result = [];
  var keys   = Array.from(this._snapshots.keys()).slice(-n);
  for (var i = 0; i < keys.length; i++) {
    var s = this._snapshots.get(keys[i]);
    result.push({
      traceId:            s.traceId,
      capturedAt:         s.capturedAt,
      packageHash:        s.hashes.packageHash ? s.hashes.packageHash.slice(0, 16) : null,
      fileCount:          s.hashes.fileCount,
      templateId:         s.template.id,
      templateVersion:    s.template.version,
      target:             s.config.target,
      features:           s.config.features
    });
  }
  return result;
};

// ── Sisäinen: dependency capture ─────────────────────────────

BuildReproducibility.prototype._captureDependencies = function(workspace) {
  var pkgJson      = null;
  var lockfileHash = null;

  if (workspace && typeof workspace.read === "function") {
    try {
      var pkg = workspace.read("package.json");
      if (pkg && pkg.content) {
        var parsed    = JSON.parse(pkg.content);
        pkgJson = {
          dependencies:    parsed.dependencies    || {},
          devDependencies: parsed.devDependencies || {}
        };
      }
    } catch (e) { /* ei pakollinen */ }

    try {
      var lock = workspace.read("package-lock.json");
      if (lock && lock.content) {
        // Hash lockfilesta — ei koko sisältöä
        var h = 0x811c9dc5;
        var s = lock.content;
        for (var i = 0; i < Math.min(s.length, 10000); i++) {
          h ^= s.charCodeAt(i);
          h  = (h * 0x01000193) >>> 0;
        }
        lockfileHash = h.toString(16).padStart(8, "0") + "_" + s.length;
      }
    } catch (e) { /* ei pakollinen */ }
  }

  return {
    hasPackageJson:  !!pkgJson,
    hasLockfile:     !!lockfileHash,
    lockfileHash:    lockfileHash,
    depCount:        pkgJson ? Object.keys(pkgJson.dependencies || {}).length : 0,
    devDepCount:     pkgJson ? Object.keys(pkgJson.devDependencies || {}).length : 0
  };
};

// ─── Factory ─────────────────────────────────────────────────

export function createBuildReproducibility(options) {
  return new BuildReproducibility(options);
}

export { BuildReproducibility };
export default BuildReproducibility;