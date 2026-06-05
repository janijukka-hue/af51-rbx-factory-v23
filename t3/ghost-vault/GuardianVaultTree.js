// t3/ghost-vault/GuardianVaultTree.js — ESM (v13)
// BASE — ainoa storage/crypto -kerros
// I1: Ainoa joka saa koskea crypto + storage
// I4: Auditoi KAIKKI operaatiot
// Spec §8

import crypto from "crypto";
import { nowIso, newTraceId } from "../../shared/utils/vaultUtils.js";
import { VaultCrypto } from "../../k1/vault/VaultCrypto.js";

// ── I7: suodattaa __Q__ ja __C__ pois base.list():sta ──────────────────────
function isInternalPath(path) {
  const segs = path.split("/").filter(Boolean);
  if (segs.some(s => s === "__Q__" || s === "__C__")) return true;
  for (const seg of segs) {
    const parts = seg.split(".");
    if (parts.some(p => p === "__Q__" || p === "__C__")) return true;
  }
  return false;
}

// ── In-memory storage ────────────────────────────────────────────────────────
class MemoryStorage {
  constructor() { this._store = new Map(); }

  async put(path, node) {
    this._store.set(path, { ...node, _savedAt: Date.now() });
  }

  // HIGH-3: CAS — atominen kirjoitus törmäyssuojalla
  async putCAS(path, node, expectedCounter) {
    const existing = this._store.get(path);
    const current  = existing ? (existing.counter ?? -1) : -1;
    if (current !== expectedCounter) {
      throw new Error(`CAS_FAIL: path=${path} expected=${expectedCounter} got=${current}`);
    }
    this._store.set(path, { ...node, counter: expectedCounter + 1, _savedAt: Date.now() });
  }

  async get(path) { return this._store.get(path) || null; }

  // I7: lista ei koskaan palauta __Q__ tai __C__ patheja
  async list(prefix) {
    const results = [];
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix) && !isInternalPath(key)) results.push(key);
    }
    return results;
  }

  // Sisäinen lista (vain vault itse)
  async _listInternal(prefix) {
    const results = [];
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) results.push(key);
    }
    return results;
  }
}

// ── Audit ring — tamper-evident HMAC-SHA256 hash chain ──────────────────────
class AuditRing {
  constructor() {
    this._events   = [];
    this._prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
    // FAIL CLOSED: GUARDIAN_HMAC_SECRET pakollinen
    const secret = process.env.GUARDIAN_HMAC_SECRET;
    if (!secret) throw new Error("GUARDIAN_HMAC_SECRET_MISSING — AuditRing ei voi käynnistyä");
    this._secret = secret;
  }

  append(type, data, meta) {
    const event = {
      ts:       Date.now(),
      traceId:  newTraceId("aud"),
      type,
      data:     data || {},
      meta:     meta || {},
      prevHash: this._prevHash,
    };
    const raw    = JSON.stringify({ ts: event.ts, type, data, prevHash: event.prevHash });
    event.hash   = crypto.createHmac("sha256", this._secret).update(raw).digest("hex");
    this._prevHash = event.hash;
    this._events.push(event);
    return event;
  }

  query(filter) { return this._events.filter(filter); }
  all()         { return this._events.slice(); }

  verify() {
    let prev = "0000000000000000000000000000000000000000000000000000000000000000";
    for (let i = 0; i < this._events.length; i++) {
      const e = this._events[i];
      if (e.prevHash !== prev) {
        return { ok: false, badIndex: i, reason: "prevHash mismatch" };
      }
      // Re-hash — varmistaa ettei tallennettu hash ole manipuloitu
      const raw      = JSON.stringify({ ts: e.ts, type: e.type, data: e.data, prevHash: e.prevHash });
      const expected = crypto.createHmac("sha256", this._secret).update(raw).digest("hex");
      if (e.hash !== expected) {
        return { ok: false, badIndex: i, reason: "hash mismatch" };
      }
      prev = e.hash;
    }
    return { ok: true };
  }
}

// ── GuardianVaultTree ────────────────────────────────────────────────────────
export class GuardianVaultTree {
  constructor(opts = {}) {
    this.vaultId        = opts.vaultId || "vault-1";
    this.ownerId        = opts.ownerId || "owner";
    this._storage       = opts.storage || new MemoryStorage();
    this._policy        = opts.policy  || null;
    this._audit         = new AuditRing();
    this._unlocked      = false;
    this._guardianState = "OK";
    this._counter       = 0;
    this._crypto        = new VaultCrypto();
    this._derivedKey    = null;
  }

  // ── Unlock / Lock ──────────────────────────────────────────────────────────
  async unlockWithPassphrase(passphrase, ctx) {
    if (!passphrase) {
      this._auditDeny("VAULT:UNLOCK", "no passphrase");
      throw new Error("NO_PASSPHRASE");
    }
    const salt = Buffer.from(this.vaultId, "utf8");
    this._derivedKey = await this._crypto.deriveKeyFromPassphrase(passphrase, salt);
    this._unlocked   = true;
    this.appendAudit("VAULT:UNLOCK", { vaultId: this.vaultId });
  }

  lock() {
    this._unlocked   = false;
    this._derivedKey = null;
    this.appendAudit("VAULT:LOCK", { vaultId: this.vaultId });
  }

  isUnlocked() { return this._unlocked; }

  // ── PUT — CAS atominen kirjoitus ───────────────────────────────────────────
  async put(path, data, ctx) {
    this._requireUnlocked("VAULT:PUT");
    if (!this._checkPolicy("VAULT_PUT", ctx)) {
      this._auditDeny("VAULT:PUT", path);
      throw new Error("POLICY_DENY");
    }
    const existing        = await this._storage.get(path);
    const expectedCounter = existing ? (existing.counter ?? -1) : -1;
    const node = { path, data, counter: expectedCounter + 1, ts: Date.now(), vaultId: this.vaultId };
    try {
      await this._storage.putCAS(path, node, expectedCounter);
    } catch (e) {
      this.appendAudit("VAULT:WRITE_CONFLICT", { path, error: e.message });
      throw new Error("VAULT_WRITE_CONFLICT");
    }
    this.appendAudit("VAULT:PUT", { path, counter: node.counter });
    return node;
  }

  // ── GET ────────────────────────────────────────────────────────────────────
  async get(path, ctx) {
    this._requireUnlocked("VAULT:GET");
    const node = await this._storage.get(path);
    this.appendAudit("VAULT:GET", { path, found: !!node });
    return node ? node.data : null;
  }

  // ── LIST — I7: __Q__ ja __C__ EIVÄT näy ────────────────────────────────────
  async list(prefix, ctx) {
    const raw      = await this._storage.list(prefix);
    const filtered = raw.filter(k => !isInternalPath(k));
    this.appendAudit("VAULT:LIST", { prefix, count: filtered.length });
    return filtered;
  }

  // ── Snapshot / Restore ─────────────────────────────────────────────────────
  async createSnapshot() {
    this._requireUnlocked("VAULT:SNAPSHOT");
    const all   = await this._storage._listInternal("/");
    const nodes = {};
    for (const path of all) nodes[path] = await this._storage.get(path);
    const snap = { vaultId: this.vaultId, createdAt: nowIso(), nodes };
    this.appendAudit("VAULT:SNAPSHOT", { nodeCount: all.length });
    return snap;
  }

  async restoreFromSnapshot(snap) {
    if (snap.vaultId !== this.vaultId) throw new Error("SNAPSHOT_VAULT_MISMATCH");
    for (const [path, node] of Object.entries(snap.nodes)) {
      await this._storage.put(path, node);
    }
    this.appendAudit("VAULT:RESTORE", { nodeCount: Object.keys(snap.nodes).length });
  }

  // ── Audit ──────────────────────────────────────────────────────────────────
  appendAudit(type, data, meta) { return this._audit.append(type, data, meta); }
  getAudit()                    { return this._audit.all(); }
  verifyIntegrity()             { return this._audit.verify(); }

  // ── Guardian state ─────────────────────────────────────────────────────────
  setGuardianState(state) {
    this._guardianState = state;
    this.appendAudit("VAULT:STATE_CHANGE", { state });
    if (state === "CRITICAL") this.lock();
  }
  getGuardianState() { return this._guardianState; }

  // ── Internals ──────────────────────────────────────────────────────────────
  _requireUnlocked(op) {
    if (!this._unlocked) {
      this.appendAudit("VAULT:LOCKED_ACCESS", { op });
      throw new Error("VAULT_LOCKED");
    }
  }

  _checkPolicy(intent, ctx) {
    if (!this._policy) return true;
    const dec = this._policy.evaluate({ intent, vaultId: this.vaultId, ctx });
    return dec.allowed;
  }

  _auditDeny(op, detail) {
    this.appendAudit("VAULT:DENY", { op, detail });
  }
}

export { MemoryStorage, AuditRing, isInternalPath };