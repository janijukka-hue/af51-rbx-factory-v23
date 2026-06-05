// services/vaultService.js — AF51 ONE Vault Service
// Vault = TALLENNETTU ARTIFACT (valmis tai keskeneräinen build)
//
// Vault-rakenne: vault/
//   builds/<buildId>/
//     meta.json       — perustiedot
//     source.jsx      — lähdekoodi
//     preview.html    — esikatselu (jos on)
//     checksum.sha256 — tarkistussumma
//   index.json        — nopea hakemisto

import {
  saveBuild,
  listBuilds,
  loadBuildMeta,
  loadBuildFull,
  getVaultRoot,
  generateBuildId,
} from "../t3/vault/vaultHelper.js";

import fs   from "fs";
import path from "path";
import { createHash } from "crypto";

function sha256(str) {
  return createHash("sha256").update(str || "", "utf8").digest("hex");
}

// ── Save artifact ────────────────────────────────────────────

export async function save(body) {
  try {
    var data = Object.assign({}, body);
    if (!data.buildId) data.buildId = generateBuildId();

    // Lisätään checksum jos source on mukana
    if (data.source) {
      data.sha256 = sha256(data.source);
    }

    // Lisätään manifest-tiedot
    data.manifest = Object.assign({
      buildId:    data.buildId,
      intent:     data.intent    || "GENERATE_JSX",
      status:     "stored",
      storedAt:   Date.now(),
      sha256:     data.sha256    || null,
      standalone: true,
      af51_version: "1.0.0",
    }, data.manifest || {});

    var result = await saveBuild(data);
    return Object.assign({}, result, { status: 200 });
  } catch (err) {
    return { ok: false, error: err.message, code: "VAULT_SAVE_ERROR", status: 500 };
  }
}

// ── List builds ──────────────────────────────────────────────

export async function list() {
  try {
    var builds = await listBuilds();
    return { ok: true, count: builds.length, builds, status: 200 };
  } catch (err) {
    return { ok: false, error: err.message, code: "VAULT_LIST_ERROR", status: 500 };
  }
}

// ── Load metadata ────────────────────────────────────────────

export async function get(buildId) {
  if (!buildId) return { ok: false, error: "buildId puuttuu", code: "MISSING_FIELD", status: 400 };
  try {
    var meta = await loadBuildMeta(buildId);
    if (!meta) return { ok: false, error: "Buildia ei löydy: " + buildId, code: "NOT_FOUND", status: 404 };
    return { ok: true, meta, status: 200 };
  } catch (err) {
    return { ok: false, error: err.message, code: "VAULT_GET_ERROR", status: 500 };
  }
}

// ── Load full (metadata + source) ───────────────────────────

export async function getFull(buildId) {
  if (!buildId) return { ok: false, error: "buildId puuttuu", code: "MISSING_FIELD", status: 400 };
  try {
    var full = await loadBuildFull(buildId);
    if (!full) return { ok: false, error: "Buildia ei löydy: " + buildId, code: "NOT_FOUND", status: 404 };
    return Object.assign({ ok: true, status: 200 }, full);
  } catch (err) {
    return { ok: false, error: err.message, code: "VAULT_FULL_ERROR", status: 500 };
  }
}

// ── Checksum verify ──────────────────────────────────────────

export async function verifyChecksum(buildId) {
  var full = await getFull(buildId);
  if (!full.ok) return full;
  var expected = full.meta && full.meta.sha256;
  var actual   = full.source ? sha256(full.source) : null;
  return {
    ok:       true,
    buildId:  buildId,
    valid:    expected && actual ? expected === actual : null,
    expected: expected,
    actual:   actual,
    status:   200,
  };
}

// ── Info ─────────────────────────────────────────────────────

export function info() {
  return { ok: true, vaultRoot: getVaultRoot(), status: 200 };
}