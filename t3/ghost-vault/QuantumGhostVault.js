// t3/ghost-vault/QuantumGhostVault.js — ESM (v13)
// WRAPPER — EI crypto, EI storage
// I2: Lukee/kirjoittaa VAIN via base.get/put/appendAudit
// Collapse pipeline: (A)meta (B)owner (C)decay (D)ctx-adjust (E)select (F)audit (G)return
// Spec §7

// Ghost pathit — virtuaalisia, ei koskaan base.list:ssa (I7)
const GHOST_PATHS = [
  { ghost: "/secret/.midnight/treasure",  real: null },
  { ghost: "/secret/.enlightened/wisdom", real: null },
  { ghost: "/secret/.cube/entry",         real: null },
];

export class QuantumGhostVault {
  constructor(opts = {}) {
    this._base      = opts.base;   // GuardianVaultTree — ainoa yhteys
    this._olio      = opts.olio;   // GuardianOlio
    this._cube      = opts.cube;   // CubeLock
    this._ghostIdx  = new Map(GHOST_PATHS.map(g => [g.ghost, g]));
    this._usedNonces = new Set();  // threshold replay guard
  }

  // ── Täydellinen arkku-access flow (spec §9) ───────────────────────────────
  // HUOM: GATE 1 (CubeLock) hoidetaan ennen tätä kutsua
  //       cubeProof välitetään tähän Gate 2:lle
  async accessArkku(path, signedCtx, cubeProof, userPassphrase) {
    // GATE 2: Olio evaluoi
    const olioDecision = this._olio.evaluate(signedCtx, cubeProof);
    if (olioDecision.decision === "DENY") {
      throw new Error("ACCESS_DENIED: Guardian Olio denied");
    }

    // GATE 3: User-key unlock (I9 — viimeinen gate)
    if (!this._base.isUnlocked()) {
      await this._base.unlockWithPassphrase(userPassphrase, signedCtx);
    }

    // GATE 4: Quantum collapse
    return this.retrieveQuantum(path, signedCtx, olioDecision);
  }

  // ── Quantum collapse pipeline ─────────────────────────────────────────────
  async retrieveQuantum(path, ctx, olioDecision) {
    // A: Hae meta
    const metaPath = `${path}.__Q__/meta`;
    const meta     = await this._base.get(metaPath, ctx) || this._defaultMeta();

    // B: Owner deterministic check
    if (meta.ownerMode?.deterministicForOwner && ctx.observerId === meta.ownerId) {
      this._base.appendAudit("QUANTUM:COLLAPSE", { selected: "REAL", reason: "owner_deterministic" });
      return { type: "REAL", data: await this._base.get(`${path}.__Q__/real`, ctx) };
    }

    // C: Temporal decay
    const states   = this._applyDecay(meta.states || [], meta.decaySchedule);

    // D: Ctx-pohjainen säätö
    const adjusted = this._adjustByCtx(states, ctx, olioDecision);

    // E: Deterministinen valinta (EI Math.random — reproducible, auditable)
    const seed     = this._ctxSeed(ctx);
    const selected = this._weightedSelect(adjusted, seed);

    // F: Audit collapse-päätös
    this._base.appendAudit("QUANTUM:COLLAPSE", { selected: selected.type, observerId: ctx.observerId, seed });

    // G: Hae data
    return this._fetchState(path, selected.type, ctx);
  }

  // ── listQuantum — base + ghost pathit ─────────────────────────────────────
  async listQuantum(prefix, ctx) {
    const base   = await this._base.list(prefix, ctx);
    const ghosts = [...this._ghostIdx.keys()].filter(g => g.startsWith(prefix));
    return [...base, ...ghosts];
  }

  // ── Threshold secrets M-of-N ──────────────────────────────────────────────
  async revealThreshold(path, shardCtx, attemptId) {
    // Replay guard — käytetään base.get/put, EI _storage suoraan
    const noncePath = `${path}.__Q__/reveal_nonce/${attemptId}`;
    const existing  = await this._base.get(noncePath, shardCtx);
    if (existing) {
      this._base.appendAudit("THRESHOLD:REPLAY", { attemptId });
      throw new Error("THRESHOLD_REPLAY: nonce already used");
    }
    await this._base.put(noncePath, { usedAt: Date.now() }, shardCtx);
    this._base.appendAudit("THRESHOLD:ATTEMPT", { attemptId });
    // Shard-logiikka: lisätään kun M-of-N toteutetaan
    return { ok: true, attemptId };
  }

  // ── Aseta quantum-meta arkulle ─────────────────────────────────────────────
  async initArkku(path, meta, ctx) {
    const metaPath = `${path}.__Q__/meta`;
    await this._base.put(metaPath, meta, ctx);
    this._base.appendAudit("QUANTUM:INIT", { path });
  }

  // ── Tallenna REAL sisältö ─────────────────────────────────────────────────
  async storeReal(path, data, ctx) {
    await this._base.put(`${path}.__Q__/real`, data, ctx);
    this._base.appendAudit("QUANTUM:STORE_REAL", { path });
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  _defaultMeta() {
    return {
      ownerMode: { deterministicForOwner: false },
      states: [
        { type: "REAL",      prob: 0.40 },
        { type: "DECOY",     prob: 0.30 },
        { type: "TRAP",      prob: 0.20 },
        { type: "HONEYPOT",  prob: 0.10 },
      ],
    };
  }

  _applyDecay(states, schedule) {
    if (!schedule) return states;
    const age    = Date.now() - (schedule.createdAt || Date.now());
    const factor = Math.max(0, 1 - age / (schedule.halfLifeMs || 86_400_000));
    return states.map(s => s.type === "REAL" ? { ...s, prob: s.prob * factor } : s);
  }

  _adjustByCtx(states, ctx, olioDecision) {
    const trust = ctx.trustLevel || 0;
    return states.map(s => {
      if (s.type === "REAL") {
        if (olioDecision?.decision === "ALLOW_REAL")    return { ...s, prob: s.prob * (1 + trust * 0.5) };
        if (olioDecision?.decision === "RETURN_DECOY")  return { ...s, prob: 0 };
        if (olioDecision?.decision === "RETURN_HONEYPOT") return { ...s, prob: 0 };
      }
      if (s.type === "HONEYPOT" && ctx.riskSignals?.bruteForcePattern) return { ...s, prob: s.prob * 3 };
      return s;
    });
  }

  // Deterministinen seed ctx:stä — sama input = sama tulos = auditable
  _ctxSeed(ctx) {
    const raw = [
      ctx.observerId ?? "anon",
      ctx.sessionId  ?? "none",
      ctx.timestamp  ? String(Math.floor(ctx.timestamp / 60000)) : "0",
    ].join("|");
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  // Weighted select seedillä — EI Math.random
  _weightedSelect(states, seed) {
    const total = states.reduce((s, st) => s + (st.prob || 0), 0);
    if (total === 0) return states[states.length - 1];
    const r = (seed % 10000) / 10000 * total;
    let cum = 0;
    for (const s of states) { cum += s.prob || 0; if (r < cum) return s; }
    return states[states.length - 1];
  }

  async _fetchState(path, type, ctx) {
    const subpath = `${path}.__Q__/${type.toLowerCase()}`;
    const data    = await this._base.get(subpath, ctx).catch(() => null);
    if (type === "TRAP")     this._base.appendAudit("QUANTUM:TRAP_TRIGGERED",  { observerId: ctx.observerId });
    if (type === "HONEYPOT") this._base.appendAudit("QUANTUM:HONEYPOT_SERVED", { observerId: ctx.observerId });
    return { type, data };
  }
}