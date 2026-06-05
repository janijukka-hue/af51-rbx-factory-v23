// t3/roblox-rbx/package-signing.js
// AF51-RBX | PHASE 5.3 — Package Signer
//
// Produces:
//   - package fingerprint (deterministic FNV1a-32 chain over all source files)
//   - export signature block (written to manifest.json + signature.json)
//   - tamper detection: re-verify stored signature against current content
//
// Zero-LLM. Fully deterministic. Same source → same fingerprint.

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// ── FNV1a-32 (fast non-crypto, deterministic) ─────────────────────────────

function _af51DeterministicNow() {
  const o = (typeof process !== "undefined" && process.env && process.env.AF51_BUILD_EPOCH) || "";
  const ms = o ? Number(o) : 315532800000;
  return new Date(ms).toISOString();
}

function _fnv1a32(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── SHA-256 (tamper detection quality) ────────────────────────────────────

function _sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// ── File collector ────────────────────────────────────────────────────────

import { readdirSync } from 'node:fs';

function _collectFiles(dir, root, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir).sort()) {
    const full = path.join(dir, entry);
    const rel  = path.relative(root, full);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      _collectFiles(full, root, acc);
    } else if (!entry.startsWith('.') && entry !== '.gitkeep') {
      acc.push({ rel, full, sizeBytes: stat.size });
    }
  }
  return acc;
}

// ── PackageSigner ─────────────────────────────────────────────────────────

export class PackageSigner {

  /**
   * Sign a build — compute fingerprint over all source files and write
   * signature block to buildRoot/signature.json and patch manifest.json.
   *
   * @param {object} opts
   * @param {string} opts.buildRoot
   * @param {string} opts.buildId
   * @param {string} opts.targetId
   * @param {string} opts.version
   * @param {object} [opts.auditLedger]
   * @returns {{ ok: boolean, signature: object|null, errors: string[] }}
   */
  static sign({ buildRoot, buildId, targetId, version, auditLedger }) {
    const errors = [];

    if (!existsSync(buildRoot)) {
      errors.push(`buildRoot not found: ${buildRoot}`);
      return { ok: false, signature: null, errors };
    }

    // ── Collect all files under src/ ─────────────────────────────────────
    const srcDir   = path.join(buildRoot, 'src');
    const srcFiles = _collectFiles(srcDir, buildRoot);

    if (srcFiles.length === 0) {
      errors.push('No source files found under src/');
      return { ok: false, signature: null, errors };
    }

    // ── Compute per-file SHA-256 → chain hash ────────────────────────────
    const fileHashes = [];
    let chainInput   = '';

    for (const { rel, full } of srcFiles) {
      let content;
      try { content = readFileSync(full); }
      catch (e) { errors.push(`Read error ${rel}: ${e.message}`); continue; }

      const fileHash = _sha256(content);
      fileHashes.push({ path: rel, hash: fileHash, sizeBytes: content.length });
      chainInput += `${rel}:${fileHash};`;
    }

    if (errors.length > 0) return { ok: false, signature: null, errors };

    // ── Master fingerprint: FNV1a-32 over sorted hash chain ─────────────
    const sortedChain      = fileHashes
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(f => `${f.path}:${f.hash}`)
      .join('|');

    const fingerprint      = _fnv1a32(sortedChain);
    const masterSHA        = _sha256(Buffer.from(sortedChain, 'utf8'));

    // ── Signature block ──────────────────────────────────────────────────
    const signature = {
      schemaVersion:  '1.0.0',
      // Deterministic per production/zip-determinism-policy.json.
      signedAt:       _af51DeterministicNow(),
      buildId,
      targetId,
      version,
      fileCount:      fileHashes.length,
      factory:        'AF51-RBX',
      fingerprint,          // FNV1a-32 fast check
      masterHash:     masterSHA, // SHA-256 tamper-detection quality
      chainHash:      _fnv1a32(`${buildId}:${targetId}:${version}:${fingerprint}`),
      fileHashes,
    };

    // ── Write signature.json ─────────────────────────────────────────────
    const sigPath = path.join(buildRoot, 'signature.json');
    try {
      writeFileSync(sigPath, JSON.stringify(signature, null, 2), 'utf8');
    } catch (e) {
      errors.push(`Failed to write signature.json: ${e.message}`);
      return { ok: false, signature: null, errors };
    }

    // ── Patch manifest.json with fingerprint ─────────────────────────────
    const manifestPath = path.join(buildRoot, 'manifest.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest       = JSON.parse(readFileSync(manifestPath, 'utf8'));
        manifest.fingerprint = fingerprint;
        manifest.masterHash  = masterSHA;
        manifest.signedAt    = signature.signedAt;
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      } catch (e) {
        // Non-fatal — signature.json is the authoritative source
        auditLedger?.warn?.(`[PackageSigner] manifest.json patch failed: ${e.message}`);
      }
    }

    if (auditLedger) {
      auditLedger.info?.(`[PackageSigner] Signed: fingerprint=${fingerprint} files=${fileHashes.length}`, {
        buildId, targetId, fingerprint, masterHash: masterSHA,
      });
    }

    return { ok: true, signature, errors: [] };
  }

  /**
   * Verify a signed build — re-compute fingerprint and compare to stored.
   * Tamper detection.
   *
   * @param {string} buildRoot
   * @param {object} [auditLedger]
   * @returns {{ ok: boolean, tampered: boolean, details: object, errors: string[] }}
   */
  static verify(buildRoot, auditLedger) {
    const errors = [];

    // Load stored signature
    const sigPath = path.join(buildRoot, 'signature.json');
    if (!existsSync(sigPath)) {
      return { ok: false, tampered: null, details: { reason: 'signature.json missing' }, errors: ['No signature found'] };
    }

    let stored;
    try { stored = JSON.parse(readFileSync(sigPath, 'utf8')); }
    catch (e) { return { ok: false, tampered: true, details: { reason: 'signature.json corrupt' }, errors: [e.message] }; }

    // Re-compute
    const srcDir   = path.join(buildRoot, 'src');
    const srcFiles = _collectFiles(srcDir, buildRoot);

    const currentHashes = srcFiles
      .map(({ rel, full }) => {
        try {
          const content = readFileSync(full);
          return { path: rel, hash: _sha256(content) };
        } catch (_) { return null; }
      })
      .filter(Boolean);

    const sortedChain = currentHashes
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .map(f => `${f.path}:${f.hash}`)
      .join('|');

    const currentFingerprint = _fnv1a32(sortedChain);
    const currentMasterHash  = _sha256(Buffer.from(sortedChain, 'utf8'));

    const fingerprintMatch = currentFingerprint === stored.fingerprint;
    const masterHashMatch  = currentMasterHash  === stored.masterHash;
    const tampered         = !fingerprintMatch || !masterHashMatch;

    if (auditLedger) {
      auditLedger[tampered ? 'critical' : 'info']?.(
        `[PackageSigner] Verify: ${tampered ? '⚠ TAMPERED' : '✓ INTACT'}`,
        { fingerprintMatch, masterHashMatch, buildId: stored.buildId }
      );
    }

    return {
      ok:      !tampered,
      tampered,
      details: {
        storedFingerprint:  stored.fingerprint,
        currentFingerprint,
        fingerprintMatch,
        storedMasterHash:   stored.masterHash,
        currentMasterHash,
        masterHashMatch,
        fileCount:          srcFiles.length,
        storedFileCount:    stored.fileCount,
        signedAt:           stored.signedAt,
      },
      errors,
    };
  }
}