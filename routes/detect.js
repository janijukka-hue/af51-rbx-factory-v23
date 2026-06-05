// routes/detect.js
// AF51 Code Type Detection API endpoints.

import { detectCodeType, validateDetection } from "../k1/code-detector/index.js";

export function handleDetectStatus(req, res, send) {
  const detection = detectCodeType(process.cwd());
  const validation = validateDetection(detection);
  return send(res, validation.ok ? 200 : 422, {
    ok: validation.ok,
    detection,
    validation,
  });
}

export async function handleDetectProject(req, res, send, readBody) {
  const body = await readBody(req).catch(() => ({}));
  const root = body.root || process.cwd();
  const detection = detectCodeType(root);
  const validation = validateDetection(detection);
  return send(res, validation.ok ? 200 : 422, {
    ok: validation.ok,
    detection,
    validation,
  });
}