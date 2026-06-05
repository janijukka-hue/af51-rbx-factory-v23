// routes/ghostVault.js — ESM (v13)
// Quantum Ghost Vault HTTP API
// Spec §9: Full access flow

import { GuardianVaultTree }              from "../t3/ghost-vault/GuardianVaultTree.js";
import { QuantumGhostVault }              from "../t3/ghost-vault/QuantumGhostVault.js";
import { CubeLock }                       from "../t3/ghost-vault/CubeLock.js";
import { GuardianOlio, signObservationContext } from "../t3/ghost-vault/GuardianOlio.js";

// Singleton vault instanssit (in-memory, boot-time)
let _base    = null;
let _quantum = null;
let _cube    = null;
let _olio    = null;

var _vaultInitError = null;

export function getGhostVaultInstances() {
  if (_vaultInitError) throw _vaultInitError;
  if (!_base) {
    try {
      // Ghost Vault on fail-closed — GUARDIAN_HMAC_SECRET PAKOLLINEN tuotannossa
      // Dev-ympäristössä: lisää GUARDIAN_HMAC_SECRET .env:ään
      var hmacSecret = process.env.GUARDIAN_HMAC_SECRET;
      if (!hmacSecret) {
        throw new Error("GUARDIAN_HMAC_SECRET_MISSING — lisää .env:ään: GUARDIAN_HMAC_SECRET=<strong-random-secret>");
      }
      _base    = new GuardianVaultTree({
        vaultId:    "super-tehdas-vault",
        ownerId:    "segerman",
        hmacSecret: hmacSecret,
      });
      _cube    = new CubeLock({ base: _base });
      _olio    = new GuardianOlio({ base: _base });
      _quantum = new QuantumGhostVault({ base: _base, cube: _cube, olio: _olio });
    } catch (initErr) {
      _vaultInitError = initErr;
      throw initErr;
    }
  }
  return { base: _base, quantum: _quantum, cube: _cube, olio: _olio };
}

// ── GATE 1: Aloita cube-sessio ─────────────────────────────────────────────
export function handleCubeStart(req, res, send, ctx) {
  const { cube } = getGhostVaultInstances();
  try {
    const session = cube.startSession({ observerId: ctx.userId || "anon", ...ctx });
    return send(res, 200, { ok: true, ...session });
  } catch (e) {
    return send(res, 429, { ok: false, error: e.message, code: "CUBE_RATE_LIMIT" });
  }
}

// ── GATE 1: Finalize cube-sessio ───────────────────────────────────────────
export async function handleCubeFinalize(req, res, send, readBody, ctx) {
  const body = await readBody(req);
  if (!body.sessionId || !body.answers) {
    return send(res, 400, { ok: false, error: "sessionId ja answers vaaditaan", code: "MISSING_FIELD" });
  }
  const { cube } = getGhostVaultInstances();
  try {
    const observerCtx = { observerId: body.userId || "anon", sessionId: body.sessionId };
    const proof = await cube.finalizeAttempt(body.sessionId, body.answers, observerCtx);
    return send(res, 200, { ok: true, proof });
  } catch (e) {
    const code = e.message.includes("INCORRECT") ? "CUBE_INCORRECT"
               : e.message.includes("NOT_FOUND")  ? "CUBE_SESSION_NOT_FOUND"
               : "CUBE_ERROR";
    return send(res, 403, { ok: false, error: e.message, code });
  }
}

// ── GATE 2-4: Hae arkku ───────────────────────────────────────────────────
export async function handleArkku(req, res, send, readBody) {
  const body = await readBody(req);
  if (!body.path || !body.userId || !body.sessionId || !body.cubeProof || !body.passphrase) {
    return send(res, 400, { ok: false, error: "path, userId, sessionId, cubeProof, passphrase vaaditaan", code: "MISSING_FIELD" });
  }

  const { quantum } = getGhostVaultInstances();

  // Allekirjoita context serverillä (HIGH-1)
  let signedCtx;
  try {
    signedCtx = signObservationContext({
      observerId: body.userId,
      sessionId:  body.sessionId,
      trustLevel: body.trustLevel || 0.5,
      riskSignals: body.riskSignals || { torExit: false, suspiciousIp: false, bruteForcePattern: false },
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message, code: "CONTEXT_SIGN_FAILED" });
  }

  try {
    const result = await quantum.accessArkku(body.path, signedCtx, body.cubeProof, body.passphrase);
    return send(res, 200, { ok: true, type: result.type, data: result.type === "REAL" ? result.data : "[redacted]" });
  } catch (e) {
    const code = e.message.includes("DENIED")  ? "ACCESS_DENIED"
               : e.message.includes("LOCKED")  ? "VAULT_LOCKED"
               : "VAULT_ERROR";
    return send(res, 403, { ok: false, error: e.message, code });
  }
}

// ── Vault audit log ────────────────────────────────────────────────────────
export function handleVaultAudit(req, res, send) {
  var base;
  try { base = getGhostVaultInstances().base; }
  catch (e) { return send(res, 200, { ok: false, status: "VAULT_UNAVAILABLE", reason: e.message }); }
  const audit    = base.getAudit();
  const verify   = base.verifyIntegrity();
  return send(res, 200, { ok: true, count: audit.length, integrity: verify, events: audit.slice(-20) });
}

// ── Vault health ───────────────────────────────────────────────────────────
export function handleVaultHealth(req, res, send) {
  var base;
  try { base = getGhostVaultInstances().base; }
  catch (e) {
    return send(res, 200, {
      ok: false, status: "VAULT_UNAVAILABLE",
      reason: e.message.includes("HMAC") ? "GUARDIAN_HMAC_SECRET puuttuu .env:stä" : e.message,
      hint: "Aseta GUARDIAN_HMAC_SECRET .env:ään Ghost Vaultin aktivoimiseksi"
    });
  }
  return send(res, 200, {
    ok:             true,
    vaultId:        base.vaultId,
    unlocked:       base.isUnlocked(),
    guardianState:  base.getGuardianState(),
    auditCount:     base.getAudit().length,
    integrity:      base.verifyIntegrity(),
  });
}