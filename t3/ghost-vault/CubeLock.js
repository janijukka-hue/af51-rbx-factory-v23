// t3/ghost-vault/CubeLock.js — ESM (v13)
// Gate 1 — CipherCube
// I3: noFeedback — finalize-only verify
// I8: Olioon pääsee vasta kuution jälkeen
// Spec §5

import crypto from "crypto";
import { short } from "../../shared/utils/vaultUtils.js";

const FACES        = ["F","B","L","R","T","D"];
const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 3_600_000;  // 1h
const PROOF_TTL_MS = 300_000;    // 5min

// Lausekirjasto — tuotannossa: per-user CipherBook base vaultissa (spec §5.3)
const SENTENCES = [
  { id:"s0", words:["valo","yön","hiljaa"] },
  { id:"s1", words:["uni","auringon","aamua"] },
  { id:"s2", words:["tuuli","tarinan","pilvi"] },
  { id:"s3", words:["aika","tässä","virtaa"] },
  { id:"s4", words:["jokainen","oma","polku"] },
  { id:"s5", words:["joki","kivien","hiljaa"] },
];

export class CubeLock {
  constructor(opts = {}) {
    this.cubeId      = String(opts.cubeId || short("cube"));
    this._base       = opts.base || null;  // GuardianVaultTree audit
    this._attempts   = new Map();           // rate limiting
    this._sessions   = new Map();
    this._usedProofs = new Set();           // replay guard (in-memory)
  }

  // ── Aloita sessio ──────────────────────────────────────────────────────────
  startSession(ctx) {
    const userId    = ctx.observerId;
    const sessionId = short("cs");
    const nonce     = crypto.randomBytes(16).toString("base64");

    // Rate limiting
    const rl = this._attempts.get(userId) || { count: 0, windowStart: Date.now() };
    if (Date.now() - rl.windowStart > WINDOW_MS) { rl.count = 0; rl.windowStart = Date.now(); }
    if (rl.count >= MAX_ATTEMPTS) {
      this._audit("CUBE:RATE_LIMIT", { userId });
      throw new Error("CUBE_RATE_LIMIT");
    }
    rl.count++;
    this._attempts.set(userId, rl);

    const faces = {};
    FACES.forEach((face, i) => {
      const s = SENTENCES[i % SENTENCES.length];
      faces[face] = { sentenceId: s.id, blankCount: s.words.length };
    });

    const session = { sessionId, userId, cubeId: this.cubeId, nonce, faces, createdAt: Date.now() };
    this._sessions.set(sessionId, session);
    this._audit("CUBE:SESSION_START", { sessionId, userId });
    return { sessionId, cubeId: this.cubeId, faces };
  }

  // ── Finalize — I3: kaikki tai ei mitään ───────────────────────────────────
  async finalizeAttempt(sessionId, answers, ctx) {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error("CUBE_SESSION_NOT_FOUND");
    if (session.userId !== ctx.observerId) {
      this._audit("CUBE:SESSION_HIJACK", { sessionId });
      throw new Error("CUBE_SESSION_MISMATCH");
    }

    // I3: tarkistaa KAIKKI kerralla, ei osittaista palautetta
    let allCorrect = true;
    for (let i = 0; i < FACES.length; i++) {
      const correct = SENTENCES[i % SENTENCES.length].words;
      const given   = answers[FACES[i]] || [];
      if (given.length !== correct.length || given.some((w, j) => w !== correct[j])) {
        allCorrect = false;
        break;
      }
    }

    if (!allCorrect) {
      this._audit("CUBE:ATTEMPT_FAIL", { sessionId, userId: session.userId });
      this._sessions.delete(sessionId);
      throw new Error("CUBE_INCORRECT");  // I3: ei kerro mikä väärin
    }

    // HMAC proof — sitoo cubeId + userId + sessionId (spec §5.5)
    const secret = process.env.GUARDIAN_HMAC_SECRET;
    if (!secret) throw new Error("GUARDIAN_HMAC_SECRET_MISSING");

    const solutionDigest = crypto.createHash("sha256")
      .update(JSON.stringify(answers)).digest("base64");
    const sessionCreatedAt = String(session.createdAt);
    const proofInput = [
      this.cubeId, session.userId, sessionId,
      sessionCreatedAt, session.nonce, solutionDigest
    ].join("|");
    const proofHash = crypto.createHmac("sha256", Buffer.from(secret))
      .update(proofInput).digest("base64");

    const issuedAt = Date.now();
    const proof = {
      cubeId:           this.cubeId,
      userId:           session.userId,
      sessionId,
      issuedAt,
      expiresAt:        issuedAt + PROOF_TTL_MS,
      attemptNumber:    1,
      nonce:            session.nonce,
      solutionDigest,
      sessionCreatedAt, // verifyProof tarvitsee tämän hash-rekonstruktioon
      proofHash,
    };

    this._sessions.delete(sessionId);
    this._audit("CUBE:UNLOCK_SUCCESS", { sessionId, userId: session.userId });
    return proof;
  }

  // ── Verifioi proof ─────────────────────────────────────────────────────────
  verifyProof(proof, ctx) {
    if (!proof?.proofHash)              return { valid: false, reason: "MISSING_PROOF" };
    if (this._usedProofs.has(proof.proofHash)) {
      this._audit("CUBE:REPLAY_DETECTED", { proofHash: proof.proofHash });
      return { valid: false, reason: "REPLAY" };
    }
    if (Date.now() > proof.expiresAt)   return { valid: false, reason: "PROOF_EXPIRED" };
    if (proof.userId !== ctx.observerId) return { valid: false, reason: "USER_MISMATCH" };
    if (ctx.sessionId && proof.sessionId !== ctx.sessionId) {
      this._audit("CUBE:SESSION_MISMATCH", { proofSess: proof.sessionId, ctxSess: ctx.sessionId });
      return { valid: false, reason: "SESSION_MISMATCH" };
    }

    // FAIL CLOSED: GUARDIAN_HMAC_SECRET pakollinen
    const secret = process.env.GUARDIAN_HMAC_SECRET;
    if (!secret) return { valid: false, reason: "GUARDIAN_HMAC_SECRET_MISSING" };

    const expectedInput = [
      proof.cubeId, proof.userId, proof.sessionId,
      String(proof.sessionCreatedAt || proof.issuedAt), proof.nonce, proof.solutionDigest
    ].join("|");
    const expectedHash = crypto.createHmac("sha256", Buffer.from(secret))
      .update(expectedInput).digest("base64");

    if (expectedHash !== proof.proofHash) {
      this._audit("CUBE:PROOF_TAMPERED", { userId: proof.userId });
      return { valid: false, reason: "PROOF_HASH_MISMATCH" };
    }

    this._usedProofs.add(proof.proofHash);
    return { valid: true };
  }

  _audit(type, data) {
    if (this._base?.appendAudit) this._base.appendAudit(type, data);
  }
}