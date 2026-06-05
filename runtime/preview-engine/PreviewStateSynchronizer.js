// runtime/preview-engine/PreviewStateSynchronizer.js
//
// Diff/sync helper between two scene specs (current vs incoming). Returns a
// patch that the browser layer applies to a live THREE.Scene without rebuilding
// it from scratch — needed for hot-reload during iterative builds.
//
// Patch shape:
//   { added: [nodeId...], removed: [nodeId...], updated: [{ id, fields:[...] }] }

const TRACKED_FIELDS = [
  'position', 'size', 'color', 'material',
  'anchored', 'glow', 'luaClass', 'shape', 'parent', 'label',
];

function _eq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  return false;
}

export class PreviewStateSynchronizer {
  /**
   * @param {object} prevSpec - previous scene spec (or null on first build)
   * @param {object} nextSpec - new scene spec
   * @returns {{ added:string[], removed:string[], updated:Array }}
   */
  diff(prevSpec, nextSpec) {
    const prev = new Map((prevSpec?.nodes || []).map(n => [n.id, n]));
    const next = new Map((nextSpec?.nodes || []).map(n => [n.id, n]));

    const added   = [];
    const removed = [];
    const updated = [];

    for (const id of next.keys()) if (!prev.has(id)) added.push(id);
    for (const id of prev.keys()) if (!next.has(id)) removed.push(id);

    for (const [id, n] of next) {
      const p = prev.get(id);
      if (!p) continue;
      const changed = [];
      for (const f of TRACKED_FIELDS) if (!_eq(p[f], n[f])) changed.push(f);
      if (changed.length) updated.push({ id, fields: changed });
    }

    return { added, removed, updated };
  }

  /**
   * Summarise the diff for the build console (one-line human-readable string).
   */
  summarise(patch) {
    if (!patch) return 'no change';
    const a = patch.added?.length || 0;
    const r = patch.removed?.length || 0;
    const u = patch.updated?.length || 0;
    if (!a && !r && !u) return 'no change';
    return `+${a} −${r} ~${u}`;
  }

  /** Are the two specs structurally identical? Useful for cache short-circuits. */
  equal(prevSpec, nextSpec) {
    const p = this.diff(prevSpec, nextSpec);
    return p.added.length === 0 && p.removed.length === 0 && p.updated.length === 0;
  }
}

export default PreviewStateSynchronizer;
