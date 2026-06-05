// middleware/requestId.js — v12
import { randomBytes } from "crypto";

export function generateRequestId() {
  return "req_" + Date.now() + "_" + randomBytes(2).toString("hex");
}

export function injectRequestId(res) {
  var id = generateRequestId();
  res.setHeader("X-Request-Id", id);
  return id;
}