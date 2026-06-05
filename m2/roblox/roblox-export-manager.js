// m2/roblox/roblox-export-manager.js — ESM
// AF51 ROBLOX CODE RUNNER — Export Manager
// Spec §5: required m2/roblox system
// Spec §17: Roblox-native ZIP export governance

import { existsSync, statSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ZipHardener }     from '../../t3/roblox-rbx/zip-hardener.js';
import { PackageValidator } from '../../t3/roblox-rbx/package-validator.js';

const SCHEMA = '1.0.0';

export const EXPORT_STATUS = Object.freeze({
  PENDING:    'PENDING',
  VALIDATING: 'VALIDATING',
  HARDENING:  'HARDENING',
  DONE:       'DONE',
  FAILED:     'FAILED',
});

function fnv1a32(s) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function _record({ buildId, targetId, version, profileId, gameName, status, zipPath = null, errors = [], startTs }) {
  return {
    schemaVersion: SCHEMA, buildId, targetId, version, profileId, gameName,
    status, zipPath, errors,
    durationMs:  Date.now() - startTs,
    exportedAt:  new Date().toISOString(),
    recordHash:  fnv1a32(`${buildId}:${targetId}:${status}:${zipPath || 'null'}`),
  };
}

function _writeRegistry(exportsDir, record) {
  const p = path.join(exportsDir, 'export-registry.json');
  let records = [];
  try { if (existsSync(p)) records = JSON.parse(readFileSync(p, 'utf8')); } catch (_) {}
  if (!Array.isArray(records)) records = [];
  const idx = records.findIndex(r => r.buildId === record.buildId);
  idx >= 0 ? (records[idx] = record) : records.push(record);
  writeFileSync(p, JSON.stringify(records, null, 2), 'utf8');
}

export class RobloxExportManager {

  /**
   * Full export pipeline: validate → ZIP harden → register.
   * Spec §16: ZIP export forbidden if validation fails.
   */
  static async export({ buildRoot, exportsDir, gameName, buildId, targetId, version, profileId, auditLedger }) {
    const errors  = [];
    const startTs = Date.now();
    const _a = (l, m) => auditLedger?.[l]?.(`[ExportManager] ${m}`);

    _a('info', `Export start: ${targetId} buildId=${buildId}`);
    mkdirSync(exportsDir, { recursive: true });

    // Phase: VALIDATING
    _a('info', 'Phase: VALIDATING');
    let vResult;
    try { vResult = await PackageValidator.validate({ buildRoot, auditLedger }); }
    catch (e) { errors.push(`Validator threw: ${e.message}`); return { ok: false, zipPath: null, exportRecord: null, errors }; }

    if (!vResult.ok) {
      const errs = (vResult.errors || []);
      _a('error', `Validation failed (${errs.length} errors)`);
      return {
        ok: false, zipPath: null, errors: errs,
        exportRecord: _record({ buildId, targetId, version, profileId, gameName, status: EXPORT_STATUS.FAILED, errors: errs, startTs }),
      };
    }

    // Phase: HARDENING
    _a('info', 'Phase: HARDENING');
    let hResult;
    try { hResult = await ZipHardener.harden({ buildRoot, exportsDir, gameName, buildId, validated: true, auditLedger }); }
    catch (e) { errors.push(`ZipHardener threw: ${e.message}`); return { ok: false, zipPath: null, exportRecord: null, errors }; }

    if (!hResult.ok) {
      const errs = hResult.errors || ['ZIP hardening failed'];
      return {
        ok: false, zipPath: null, errors: errs,
        exportRecord: _record({ buildId, targetId, version, profileId, gameName, status: EXPORT_STATUS.FAILED, errors: errs, startTs }),
      };
    }

    // Done
    const record = _record({ buildId, targetId, version, profileId, gameName, status: EXPORT_STATUS.DONE, zipPath: hResult.zipPath, errors: [], startTs });
    try { _writeRegistry(exportsDir, record); } catch (e) { _a('warn', `Registry write failed: ${e.message}`); }

    _a('info', `Export done: ${hResult.zipPath} (${Date.now() - startTs}ms)`);
    return { ok: true, zipPath: hResult.zipPath, exportRecord: record, errors: [] };
  }

  static readRegistry(exportsDir) {
    const p = path.join(exportsDir, 'export-registry.json');
    if (!existsSync(p)) return { ok: true, records: [], error: null };
    try { return { ok: true, records: JSON.parse(readFileSync(p, 'utf8')), error: null }; }
    catch (e) { return { ok: false, records: [], error: e.message }; }
  }

  static async inspect(zipPath, auditLedger) {
    try { return await ZipHardener.inspectZip(zipPath); }
    catch (e) { return { ok: false, files: [], error: e.message }; }
  }
}