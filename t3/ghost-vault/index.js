// t3/ghost-vault/index.js — ESM (v13)
// Quantum Ghost Vault v3.0.0 — koko ketju
// CUBE → GUARDIAN OLIO → ARKKU
// Spec: QUANTUM GHOST VAULT v3.0.0 — Jani Segerman

export { GuardianVaultTree, MemoryStorage, AuditRing }  from "./GuardianVaultTree.js";
export { QuantumGhostVault }                             from "./QuantumGhostVault.js";
export { CubeLock }                                      from "./CubeLock.js";
export { GuardianOlio, signObservationContext }          from "./GuardianOlio.js";

/**
 * Luo valmis vault-kokonaisuus yhdellä kutsulla.
 * HUOM: Käytä suoria ESM-importteja — ks. createGhostVaultSync kommentit.
 */
export function createGhostVault(opts = {}) {
  throw new Error("Käytä suoria ESM-importteja — ks. kommentit alla");
}

/**
 * Sync factory — luo kaikki komponentit.
 * ENV: GUARDIAN_HMAC_SECRET pakollinen
 */
export function createGhostVaultSync(opts = {}) {
  const { GuardianVaultTree: GVT, MemoryStorage: MS } = require ? {} : {};
  // ESM: komponennit tuodaan erikseen importtaamalla
  // Esimerkki käytöstä:
  //
  //   import { GuardianVaultTree, QuantumGhostVault, CubeLock, GuardianOlio, signObservationContext } from "./t3/ghost-vault/index.js";
  //
  //   const base    = new GuardianVaultTree({ vaultId: "my-vault", ownerId: "user-1" });
  //   const cube    = new CubeLock({ base });
  //   const olio    = new GuardianOlio({ base });
  //   const quantum = new QuantumGhostVault({ base, cube, olio });
  //
  //   // Gate 1: CubeLock
  //   const session = cube.startSession(ctx);
  //   const proof   = await cube.finalizeAttempt(session.sessionId, answers, ctx);
  //
  //   // Gate 2-4: accessArkku
  //   const result  = await quantum.accessArkku(path, signedCtx, proof, passphrase);
  throw new Error("Käytä suoraan ESM-importteja — ks. kommentit yllä");
}