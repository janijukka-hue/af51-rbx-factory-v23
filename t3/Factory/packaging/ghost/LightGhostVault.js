// t3/Factory/packaging/ghost/LightGhostVault.js
// AF51 Packaging System — Light Ghost Vault
// KERROS: T3 — Factory
//
// Kevyt Ghost Vault tuotantolinjaa varten.
// EI raskasta runtime-mutanttilogiikkaa.
// Antaa artifactille:
//   - secure metadata wrapping
//   - deploy lineage
//   - hidden recovery channel
//   - rollback continuity
//
// ghost/
//   lineage.json      — artifact alkuperä ja historia
//   recovery.map      — rollback-ankkurit
//   deploy.signature  — deployment tunniste
//   runtime.hash      — runtime-tilan hash
//   policy.snapshot   — packspec-snapshot

import { createHash, createHmac } from "crypto";
import fs   from "fs";
import path from "path";

export var LIGHT_GHOST_VERSION = "1.0.0";

function sha256(str) {
  return createHash("sha256").update(str || "", "utf8").digest("hex");
}

function hmac(data, secret) {
  return createHmac("sha256", secret || "af51-ghost-default")
    .update(typeof data === "string" ? data : JSON.stringify(data))
    .digest("hex");
}

function makeGhostId() {
  var ts   = Date.now().toString(36);
  var rand = Math.random().toString(36).slice(2, 8);
  return "ghost_" + ts + "_" + rand;
}

// 1980-01-01 00:00:00 UTC — the same epoch ZipHardener uses for entry
// timestamps. Deterministic mode pins every sealedAt/createdAt/snappedAt to
// this so ghost/* files are byte-identical across runs of the same input.
var DETERMINISTIC_EPOCH_MS = 315532800000;

export class LightGhostVault {
  constructor(opts) {
    var options     = opts || {};
    // Deterministic seed (typically the artifactHash) — when supplied, both
    // ghostId and all internal "now" timestamps are derived from it instead
    // of the wall clock. Lets two builds of the same input produce identical
    // ghost/* receipts so the ZIP gate can assert byte-equality.
    this._detSeed   = options.deterministicSeed || null;
    this._now       = this._detSeed ? function() { return DETERMINISTIC_EPOCH_MS; } : Date.now;
    this._ghostId   = this._detSeed
      ? "ghost_" + sha256(String(this._detSeed)).slice(0, 16)
      : makeGhostId();
    this._secret    = options.secret    || "af51-ghost-default";
    this._project   = options.project   || "unknown";
    this._version   = options.version   || "0.0.0";
    this._createdAt = this._now();

    this._lineage   = null;
    this._recovery  = null;
    this._signature = null;
    this._runtimeHash = null;
    this._policySnapshot = null;
  }

  // ── Seal — main operation ─────────────────────────────────
  // Wraps an artifact with ghost metadata.
  // Returns ghost/ directory contents to be embedded in .afx.

  seal(params) {
    var artifactId  = params.artifactId  || ("art_" + this._now().toString(36));
    var layerHashes = params.layerHashes || {};
    var specSnapshot = params.specSnapshot || {};
    var auditHash   = params.auditHash   || null;
    // In deterministic mode build duration is wall-clock and breaks
    // byte-equality across runs — pin to 0 so lineage.json stays stable.
    var buildDuration = this._detSeed ? 0 : (params.buildDuration || 0);

    // lineage.json — where this artifact came from
    this._lineage = {
      ghostId:         this._ghostId,
      artifactId:      artifactId,
      project:         this._project,
      version:         this._version,
      createdAt:       this._createdAt,
      sealedAt:        this._now(),
      buildDuration:   buildDuration,
      layers:          layerHashes,
      auditHash:       auditHash,
      af51_ghost:      LIGHT_GHOST_VERSION,
      // Lineage — sukupuu capsule-historiaa varten
      parentCapsuleId: params.parentCapsuleId || null,
      buildGeneration: params.buildGeneration || 1,
      mutationSource:  params.mutationSource  || "manual",
      repairHistory:   params.repairHistory   || [],
    };

    // recovery.map — rollback anchors
    this._recovery = {
      ghostId:    this._ghostId,
      artifactId: artifactId,
      anchors: Object.entries(layerHashes).map(function(pair) {
        return { layer: pair[0], fingerprint: pair[1], recoverable: true };
      }),
      strategy:   "snapshot-rollback",
      createdAt:  this._now(),
    };

    // runtime.hash — combined hash of all layers
    var combinedContent = Object.entries(layerHashes)
      .sort(function(a, b) { return a[0].localeCompare(b[0]); })
      .map(function(pair) { return pair[0] + ":" + pair[1]; })
      .join("|");
    this._runtimeHash = sha256(combinedContent);

    // policy.snapshot — copy of packspec at time of build
    this._policySnapshot = Object.assign({}, specSnapshot, {
      snappedAt: this._now(),
      ghostId:   this._ghostId,
    });

    // deploy.signature — HMAC over key fields
    var signaturePayload = JSON.stringify({
      ghostId:     this._ghostId,
      artifactId:  artifactId,
      runtimeHash: this._runtimeHash,
      auditHash:   auditHash,
      sealedAt:    this._lineage.sealedAt,
    });
    this._signature = {
      ghostId:   this._ghostId,
      algorithm: "hmac-sha256",
      signature: hmac(signaturePayload, this._secret),
      sealedAt:  this._lineage.sealedAt,
    };

    return this;
  }

  // ── Write ghost/ to directory ─────────────────────────────

  writeTo(ghostDir) {
    if (!fs.existsSync(ghostDir)) {
      fs.mkdirSync(ghostDir, { recursive: true });
    }

    var write = function(filename, data) {
      fs.writeFileSync(
        path.join(ghostDir, filename),
        JSON.stringify(data, null, 2),
        "utf8"
      );
    };

    write("lineage.json",      this._lineage);
    write("recovery.map",      this._recovery);
    write("deploy.signature",  this._signature);
    write("runtime.hash",      { hash: this._runtimeHash, ghostId: this._ghostId });
    write("policy.snapshot",   this._policySnapshot);

    return {
      ok:      true,
      ghostId: this._ghostId,
      files:   ["lineage.json", "recovery.map", "deploy.signature", "runtime.hash", "policy.snapshot"],
      dir:     ghostDir,
    };
  }

  // ── Verify ────────────────────────────────────────────────

  verify(artifactId, layerHashes) {
    if (!this._signature || !this._runtimeHash) {
      return { ok: false, error: "Ghost not sealed" };
    }
    var combinedContent = Object.entries(layerHashes)
      .sort(function(a, b) { return a[0].localeCompare(b[0]); })
      .map(function(pair) { return pair[0] + ":" + pair[1]; })
      .join("|");
    var expectedHash = sha256(combinedContent);
    var hashMatch = expectedHash === this._runtimeHash;

    return {
      ok:        hashMatch,
      ghostId:   this._ghostId,
      hashMatch: hashMatch,
      expected:  expectedHash,
      actual:    this._runtimeHash,
    };
  }

  // ── Getters ───────────────────────────────────────────────

  getGhostId()   { return this._ghostId; }
  getLineage()   { return this._lineage; }
  getRecovery()  { return this._recovery; }
  getSignature() { return this._signature; }
  getRuntimeHash() { return this._runtimeHash; }
}
