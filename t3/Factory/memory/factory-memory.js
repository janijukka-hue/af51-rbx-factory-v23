// t3/Factory/memory/factory-memory.js
// T3 Factory - Unified Memory Facade
// v2: lisätty ArtifactVault + .vault / .registry propertygetterit
//     → Factory._initializePipeline() voi injektoida ne BuildPipelinelle

import { createWorkMemoryRing }     from "./work-memory-ring.js";
import { createBuildQueueMemory }   from "./build-queue-memory.js";
import { createFactoryEnergyRing }  from "./factory-energy-ring.js";
import { createFactoryAuditRing }   from "./factory-audit-ring.js";
import { createComponentWarehouse } from "./component-warehouse.js";
import { createReleaseRegistry }    from "./release-registry.js";
import { createArtifactVault }      from "./artifact-vault.js";

function FactoryMemory(options) {
  if (!options) options = {};

  this._clock = options.clock || null;
  this._caps  = options.caps  || {};

  this._work = createWorkMemoryRing({
    clock: this._clock,
    cap:   this._caps.work || 500
  });

  this._queue = createBuildQueueMemory({
    clock: this._clock,
    cap:   this._caps.queue || 200
  });

  this._energy = createFactoryEnergyRing({
    clock: this._clock,
    cap:   this._caps.energy || 1000
  });

  this._audit = createFactoryAuditRing({
    clock: this._clock,
    cap:   this._caps.audit || 5000
  });

  this._warehouse = createComponentWarehouse({
    clock: this._clock,
    cap:   this._caps.warehouse || 1000
  });

  this._releases = createReleaseRegistry({
    clock: this._clock,
    cap:   this._caps.releases || 500
  });

  // Inkrementaali-cache — BuildPipeline.IncrementalCheckPhase käyttää tätä
  this._vault = createArtifactVault({
    clock:        this._clock,
    maxArtifacts: this._caps.vault || 500
  });
}

// ── Propertygetterit BuildPipelinen injektiota varten ────────
// Factory._initializePipeline() lukee nämä:
//   memory: { vault: this._memory.vault, registry: this._memory.registry, ... }

Object.defineProperty(FactoryMemory.prototype, "vault", {
  get: function() { return this._vault; },
  enumerable: true
});

Object.defineProperty(FactoryMemory.prototype, "registry", {
  get: function() { return this._releases; },
  enumerable: true
});

Object.defineProperty(FactoryMemory.prototype, "audit", {
  get: function() { return this._audit; },
  enumerable: true
});

Object.defineProperty(FactoryMemory.prototype, "energy", {
  get: function() { return this._energy; },
  enumerable: true
});

Object.defineProperty(FactoryMemory.prototype, "workRing", {
  get: function() { return this._work; },
  enumerable: true
});

// ── write / read ─────────────────────────────────────────────

FactoryMemory.prototype.write = function(ring, data) {
  switch (ring) {
    case "work":      return this._work.push(data);
    case "queue":     return this._queue.enqueue(data);
    case "energy":    return this._energy.recordPhaseCost(data.phase, data.ms, data.bytes);
    case "audit":     return this._audit.append(data.event || "UNKNOWN", data);
    case "warehouse": return this._warehouse.upsertComponent(data);
    case "releases":  return this._releases.registerRelease(data);
    case "vault":     return this._vault.store(data);
    default:          return { ok: false, error: "Unknown ring: " + ring };
  }
};

FactoryMemory.prototype.read = function(ring, query) {
  if (!query) query = {};

  switch (ring) {
    case "work":
      if (query.traceId) return this._work.getByTraceId(query.traceId);
      return this._work.list(query.limit || 50);

    case "queue":
      if (query.jobId) return this._queue.getJob(query.jobId);
      return this._queue.getRecentJobs(query.limit || 20);

    case "energy":
      return this._energy.getState();

    case "audit":
      if (query.traceId) return this._audit.getEventsByTraceId(query.traceId, query.limit || 100);
      if (query.type)    return this._audit.getEventsByType(query.type, query.limit || 50);
      return this._audit.getEvents(query.limit || 100);

    case "warehouse":
      if (query.name) return this._warehouse.getComponentByName(query.name, query.version);
      if (query.tags) return this._warehouse.queryComponents(query.tags, query.limit || 50);
      return this._warehouse.listComponents(query.limit || 50);

    case "releases":
      if (query.project)   return this._releases.listReleases(query.project, query.limit || 50);
      if (query.releaseId) return this._releases.getRelease(query.releaseId);
      return this._releases.listAllReleases(query.limit || 100);

    case "vault":
      if (query.checksum) return this._vault.getByChecksum(query.checksum);
      if (query.id)       return this._vault.get(query.id);
      return this._vault.getLatest();

    default:
      return null;
  }
};

// ── Getterit ─────────────────────────────────────────────────

FactoryMemory.prototype.getWork      = function() { return this._work; };
FactoryMemory.prototype.getQueue     = function() { return this._queue; };
FactoryMemory.prototype.getEnergy    = function() { return this._energy; };
FactoryMemory.prototype.getAudit     = function() { return this._audit; };
FactoryMemory.prototype.getWarehouse = function() { return this._warehouse; };
FactoryMemory.prototype.getReleases  = function() { return this._releases; };
FactoryMemory.prototype.getVault     = function() { return this._vault; };

FactoryMemory.prototype.getStats = function() {
  return {
    work:      this._work.getStats(),
    queue:     this._queue.getStats(),
    energy:    this._energy.getStats(),
    audit:     this._audit.getStats(),
    warehouse: this._warehouse.getStats(),
    releases:  this._releases.getStats(),
    vault:     { count: this._vault.getAll ? this._vault.getAll().length : 0 }
  };
};

FactoryMemory.prototype.verify = function() {
  return { audit: this._audit.verify() };
};

function createFactoryMemory(options) {
  return new FactoryMemory(options);
}

export { FactoryMemory, createFactoryMemory };