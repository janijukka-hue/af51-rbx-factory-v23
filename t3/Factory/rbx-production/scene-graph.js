// t3/Factory/rbx-production/scene-graph.js
// AF51-RBX | T3 Layer — Production SceneGraph
// Role  : In-memory deterministic scene graph that VisualDirector passes enrich.
//         Same target spec → byte-identical graph (FNV1a-derived ids, sorted maps).

function fnv1a32(s) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

export class SceneGraph {
  constructor(targetId) {
    this.targetId = String(targetId || "unknown");
    this._counter = 0;
    this.nodes    = [];           // flat list, deterministic order of insertion
    this.byId     = new Map();
    this.services = {};           // service-scoped settings (Lighting, SoundService, ...)
    this.report   = null;         // QualityGate populates
  }

  _nextId(className, name) {
    const seq = String(this._counter++).padStart(4, "0");
    return "n_" + fnv1a32(`${this.targetId}:${className}:${name}:${seq}`);
  }

  /**
   * Append a node. Returns the created node.
   * @param {object} opts
   * @param {string} opts.className - Roblox class (Part, PointLight, SpawnLocation, ...)
   * @param {string} opts.name      - instance Name
   * @param {string} opts.parent    - logical parent path (e.g. "Workspace/AF51Scene")
   * @param {object} [opts.properties] - sorted on emit; CFrame/Vector3 stored as plain literals
   * @param {string[]} [opts.tags]
   * @param {object} [opts.attributes] - Roblox instance attributes (SetAttribute);
   *        scalar values only (boolean | number | string). Emitted by the Lua
   *        SceneBuilder via :SetAttribute() so gameplay kits (ObbyKit, etc.)
   *        can read Stage/Axis/Speed/Distance/Phase/Team/Tier without parsing
   *        StringValue children.
   */
  add({ className, name, parent, properties, tags, attributes }) {
    if (!className || !name || !parent) {
      throw new Error("[SceneGraph] className, name, parent required");
    }
    const node = {
      id:         this._nextId(className, name),
      className:  String(className),
      name:       String(name),
      parent:     String(parent),
      properties: properties ? { ...properties } : {},
      tags:       Array.isArray(tags) ? [...tags] : [],
      attributes: attributes ? { ...attributes } : {},
    };
    this.nodes.push(node);
    this.byId.set(node.id, node);
    return node;
  }

  /** Set/merge service-level settings keyed by service name (e.g. "Lighting"). */
  setService(serviceName, settings) {
    if (!serviceName) throw new Error("[SceneGraph] serviceName required");
    const prev = this.services[serviceName] || {};
    this.services[serviceName] = { ...prev, ...settings };
  }

  /** Find nodes by Roblox className. Returns a shallow copy (order preserved). */
  findByClass(className) {
    return this.nodes.filter((n) => n.className === className);
  }

  /** Find nodes by tag. */
  findByTag(tag) {
    return this.nodes.filter((n) => n.tags.includes(tag));
  }

  /**
   * Deterministic serialization for inspection / artifact emission.
   * Optional `envelope` lets RobloxEmitter stamp the shared
   * production-artifact contract (schemaVersion, kind, buildId, target,
   * producedAt) so the scenegraph and generatedPreview share one header.
   * Envelope fields are emitted first so the contract is visible at the
   * top of the JSON. `targetId` is preserved for backward compatibility
   * with existing consumers (server.js, RbxPreviewCanvas, etc.).
   */
  toJSON(envelope) {
    const env = envelope || {};
    return {
      schemaVersion: env.schemaVersion || "1.1.0",
      kind:          env.kind          || "rbx-scenegraph",
      buildId:       env.buildId       || null,
      target:        env.target        || this.targetId,
      producedAt:    env.producedAt    || null,
      targetId:      this.targetId,
      nodes:    this.nodes.map((n) => ({
        id:         n.id,
        className:  n.className,
        name:       n.name,
        parent:     n.parent,
        properties: _sortKeys(n.properties),
        tags:       [...n.tags].sort(),
        attributes: _sortKeys(n.attributes || {}),
      })),
      services: _sortKeys(this.services),
      report:   this.report,
    };
  }
}

function _sortKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    out[k] = (v && typeof v === "object" && !Array.isArray(v)) ? _sortKeys(v) : v;
  }
  return out;
}

export default SceneGraph;
