// t3/ghost-vault/GuardianOlio.js — ESM (v13)
// Gate 2 — vartija "kuka & miksi"
// HIGH-1: ObservationContext HMAC-verifikaatio (timingSafeEqual)
// HIGH-2: CubeProof sessionId + observerId binding
// FAIL CLOSED: virhe = DENY
// Spec §6

import crypto from "crypto";

function _getTrustedHmac() {
  return process.env.GUARDIAN_HMAC_SECRET || null;
}

function _computeContextHmac(ctx, secret) {
  const payload = JSON.stringify({
    observerId: ctx.observerId || "",
    sessionId:  ctx.sessionId  || "",
    trustLevel: ctx.trustLevel ?? 0,
    issuedAt:   ctx.issuedAt   || 0,
  });
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export class GuardianOlio {
  constructor(opts = {}) {
    this._base = opts.base;
    if (!process.env.GUARDIAN_HMAC_SECRET) {
      console.warn("[GuardianOlio] VAROITUS: GUARDIAN_HMAC_SECRET puuttuu — DENY-moodi");
    }
  }

  evaluate(ctx, cubeProof) {
    // HIGH-1: Context integrity — unsigned = DENY (FAIL CLOSED)
    if (!this._verifyContext(ctx)) {
      this._audit("OLIO:UNSIGNED_CONTEXT", { observerId: ctx?.observerId });
      return { decision: "DENY", reasonCodes: ["UNSIGNED_CONTEXT"], confidence: 1.0 };
    }

    // I8: CubeProof pakollinen ennen oliota
    if (!cubeProof?.proofHash) {
      this._audit("OLIO:MISSING_PROOF", {});
      return { decision: "DENY", reasonCodes: ["MISSING_CUBE_PROOF"], confidence: 1.0 };
    }

    // HIGH-2: Proof vanhentunut
    if (Date.now() > cubeProof.expiresAt) {
      this._audit("OLIO:PROOF_EXPIRED", { sessionId: cubeProof.sessionId });
      return { decision: "DENY", reasonCodes: ["PROOF_EXPIRED"], confidence: 1.0 };
    }

    // HIGH-2: Cross-session estäminen
    if (cubeProof.sessionId !== ctx.sessionId) {
      this._audit("OLIO:SESSION_MISMATCH", { ctxSession: ctx.sessionId, proofSession: cubeProof.sessionId });
      return { decision: "DENY", reasonCodes: ["SESSION_MISMATCH"], confidence: 1.0 };
    }

    // HIGH-2: Identity binding
    if (cubeProof.observerId && cubeProof.observerId !== ctx.observerId) {
      this._audit("OLIO:IDENTITY_MISMATCH", {});
      return { decision: "DENY", reasonCodes: ["IDENTITY_MISMATCH"], confidence: 1.0 };
    }

    // Riskisignaalit — FAIL CLOSED: puuttuva telemetria = honeypot
    const rs = ctx.riskSignals;
    if (!rs) {
      this._audit("OLIO:MISSING_RISK_SIGNALS", { observerId: ctx.observerId });
      return { decision: "RETURN_HONEYPOT", reasonCodes: ["UNKNOWN_RISK"], confidence: 0.9 };
    }
    if (rs.torExit || rs.bruteForcePattern || rs.suspiciousIp) {
      this._audit("OLIO:HIGH_RISK", { signals: Object.keys(rs).filter(k => rs[k]) });
      return { decision: "RETURN_HONEYPOT", reasonCodes: ["HIGH_RISK"], confidence: 0.95 };
    }

    // Trust-pohjainen päätös
    const trust = Number(ctx.trustLevel || 0);
    if (trust >= 0.8) {
      this._audit("OLIO:ALLOW_REAL", { observerId: ctx.observerId });
      return { decision: "ALLOW_REAL", reasonCodes: ["VERIFIED_TRUST"], confidence: trust };
    }
    if (trust >= 0.5) {
      return { decision: "ALLOW_PARTIAL", reasonCodes: ["MEDIUM_TRUST"], confidence: 0.7 };
    }
    return { decision: "RETURN_DECOY", reasonCodes: ["LOW_TRUST"], confidence: 0.9 };
  }

  // HIGH-1: recompute + timingSafeEqual
  _verifyContext(ctx) {
    if (!ctx || !ctx._hmac) return false;
    const secret = _getTrustedHmac();
    if (!secret) return false;
    try {
      const expected = _computeContextHmac(ctx, secret);
      const a = Buffer.from(ctx._hmac, "hex");
      const b = Buffer.from(expected, "hex");
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  _audit(type, data) {
    if (this._base?.appendAudit) this._base.appendAudit(type, data);
  }
}

// Helper: allekirjoita ObservationContext serverillä (ei clientiltä!)
export function signObservationContext(fields) {
  const secret = _getTrustedHmac();
  if (!secret) throw new Error("GUARDIAN_HMAC_SECRET puuttuu");
  const ctx    = { ...fields, issuedAt: fields.issuedAt || Date.now() };
  ctx._hmac    = _computeContextHmac(ctx, secret);
  return ctx;
}