// routes/vault.js — v12

import { save, list, get, getFull } from "../services/vaultService.js";
import { renderVaultBrowser }       from "../t3/vault/vaultBrowser.js";

export async function handleVaultUI(req, res) {
  var result = await list();
  var html   = renderVaultBrowser(result.builds || []);
  res.writeHead(200, {
    "Content-Type":  "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
  });
  return res.end(html);
}

export async function handleVaultSave(req, res, send, readBody) {
  var body   = await readBody(req);
  var result = await save(body);
  return send(res, result.status, result);
}

export async function handleVaultList(req, res, send) {
  var result = await list();
  return send(res, result.status, result);
}

export async function handleVaultGet(req, res, send, buildId) {
  var result = await get(buildId);
  return send(res, result.status, result);
}

export async function handleVaultGetFull(req, res, send, buildId) {
  var result = await getFull(buildId);
  return send(res, result.status, result);
}