// runtime/rbx-runtime/PickingMath.js
// AF51-RBX v59 — Pure, testable picking math (same projection as the viewport).
// No DOM. Lets us unit-test hit-testing without a browser.

export function makeProjector(cam, bounds, viewW, viewH) {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const midZ = (bounds.minZ + bounds.maxZ) / 2;
  function baseScale() {
    const wW = Math.max(1, bounds.maxX - bounds.minX);
    const wD = Math.max(1, bounds.maxZ - bounds.minZ);
    const wH = Math.max(1, bounds.maxY - bounds.minY);
    const span = Math.max(wW, wD, wH * 1.4);
    return Math.min(viewW, viewH) / (span * 1.7);
  }
  function project(px, py, pz) {
    const dx = px - midX, dy = py - midY, dz = pz - midZ;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const x1 = dx * cy - dz * sy, z1 = dx * sy + dz * cy;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const y1 = dy * cp - z1 * sp, z2 = dy * sp + z1 * cp;
    const s = baseScale() * (cam.zoom || 1);
    const persp = 1 / (1 + (z2 * s) / 2600);
    return { sx: viewW / 2 + x1 * s * persp, sy: viewH / 2 - y1 * s * persp, depth: z2 };
  }
  project.baseScale = baseScale;
  return project;
}

export function hitRadius(b, project, cam) {
  const sh = b.shape || "Block";
  const s = project.baseScale() * (cam.zoom || 1);
  if (sh === "Ball" || sh === "Sphere") return ((+b.w || 4) / 2) * s;
  if (sh === "Cylinder") return ((+b.d || 4) / 2) * s * 1.1;
  return Math.max(+b.w || 4, +b.d || 4) * s * 0.6;
}

// Return the front-most block under (mx,my), or null.
export function pick(blocks, mx, my, cam, bounds, viewW, viewH) {
  const project = makeProjector(cam, bounds, viewW, viewH);
  let best = null, bestDepth = -Infinity;
  for (const b of blocks) {
    const c = project((+b.x || 0), (+b.y || 0) + (+b.h || 1) / 2, (+b.z || 0));
    const dx = mx - c.sx, dy = my - c.sy;
    const r = hitRadius(b, project, cam);
    if (dx * dx + dy * dy <= r * r) {
      const d = project((+b.x || 0), (+b.y || 0), (+b.z || 0)).depth;
      if (d > bestDepth) { bestDepth = d; best = b; }
    }
  }
  return best;
}

export default { makeProjector, hitRadius, pick };
