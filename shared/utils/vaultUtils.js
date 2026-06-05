// shared/utils/vaultUtils.js — ESM (v13)
import crypto from "crypto";

export function nowIso()        { return new Date().toISOString(); }
export function nowMs()         { return Date.now(); }
export function randomBytes(n)  { return crypto.randomBytes(n); }
export function uuid()          { return crypto.randomUUID(); }

export function short(prefix) {
  const h = crypto.createHash("sha256").update(uuid()).digest("hex").slice(0, 12);
  return `${String(prefix || "id")}_${h}`;
}

export function newTraceId(prefix) {
  const ts  = Date.now().toString(36);
  const rnd = crypto.randomBytes(4).toString("hex");
  return `${String(prefix || "tr")}_${ts}_${rnd}`;
}