// t3/Factory/workers/al2-builder-worker.js
// AL2 Builder Worker - Käyttää AL-olioita koodin rakentamiseen

import { BaseWorker } from "./base-worker.js";
import { fnv1a32 } from "../core/factory-utils.js";

export class AL2BuilderWorker extends BaseWorker {
  constructor(options = {}) {
    super({ ...options, name: "AL2Builder" });
    
    this._alCoordinator = options.alCoordinator || null;
    this._alWorkers = options.alWorkers || [];
    this._buildHistory = [];
    this._maxHistory = 50;
  }

  setALCoordinator(coordinator) {
    this._alCoordinator = coordinator;
  }

  addALWorker(worker) {
    this._alWorkers.push(worker);
  }

  getALWorkers() {
    return this._alWorkers.map(w => ({
      id: w.getId(),
      name: w.getName(),
      state: w.getState()
    }));
  }

  async build(files, manifest) {
    return await this._runTask("build", async () => {
      const buildId = `build_${this._clock.now()}_${fnv1a32(JSON.stringify(files.map(f => f.path)))}`;
      
      const buildContext = {
        buildId,
        startedAt: this._clock.now(),
        files,
        manifest,
        phases: [],
        output: []
      };

      // Phase 1: Parse
      const parseResult = await this._parsePhase(buildContext);
      buildContext.phases.push({ name: "parse", result: parseResult });
      
      if (!parseResult.ok) {
        return { ok: false, error: parseResult.error, buildId };
      }

      // Phase 2: Transform (käytä AL-olioita jos saatavilla)
      const transformResult = await this._transformPhase(buildContext, parseResult.parsed);
      buildContext.phases.push({ name: "transform", result: transformResult });
      
      if (!transformResult.ok) {
        return { ok: false, error: transformResult.error, buildId };
      }

      // Phase 3: Optimize
      const optimizeResult = await this._optimizePhase(buildContext, transformResult.transformed);
      buildContext.phases.push({ name: "optimize", result: optimizeResult });
      
      if (!optimizeResult.ok) {
        return { ok: false, error: optimizeResult.error, buildId };
      }

      // Phase 4: Bundle
      const bundleResult = await this._bundlePhase(buildContext, optimizeResult.optimized);
      buildContext.phases.push({ name: "bundle", result: bundleResult });

      buildContext.finishedAt = this._clock.now();
      buildContext.output = bundleResult.bundle || files;

      this._addToHistory(buildContext);

      return {
        ok: true,
        buildId,
        output: buildContext.output,
        phases: buildContext.phases,
        stats: {
          inputFiles: files.length,
          outputFiles: buildContext.output.length,
          durationMs: buildContext.finishedAt - buildContext.startedAt
        }
      };
    });
  }

  async _parsePhase(context) {
    const parsed = [];

    for (const file of context.files) {
      const ext = (file.path || "").split(".").pop().toLowerCase();
      
      parsed.push({
        path: file.path,
        content: file.content,
        extension: ext,
        type: this._detectFileType(ext),
        ast: null,
        parsed: true
      });
    }

    return { ok: true, parsed };
  }

  async _transformPhase(context, parsed) {
    // Jos AL-koordinaattori on käytettävissä, käytä AL-olioita
    if (this._alCoordinator && this._alCoordinator.getState() === "ACTIVE") {
      return await this._transformWithAL(context, parsed);
    }

    // Muuten käytä suoraa transformaatiota
    const transformed = parsed.map(file => ({
      ...file,
      transformed: true,
      content: this._basicTransform(file.content, file.type)
    }));

    return { ok: true, transformed };
  }

  async _transformWithAL(context, parsed) {
    const transformed = [];

    for (const file of parsed) {
      // Delegoi AL-workerille
      const result = await this._alCoordinator.delegate(
        this._selectWorkerForFile(file),
        {
          skill: "transform",
          input: file,
          transformer: (f) => ({
            ...f,
            transformed: true,
            content: this._basicTransform(f.content, f.type)
          })
        }
      );

      if (result.ok) {
        transformed.push(result.output || file);
      } else {
        transformed.push({ ...file, transformed: true });
      }
    }

    return { ok: true, transformed, usedAL: true };
  }

  _selectWorkerForFile(file) {
    // Valitse sopiva AL-worker tiedostotyypin mukaan
    if (this._alWorkers.length === 0) return null;
    
    const index = fnv1a32(file.path) % this._alWorkers.length;
    return this._alWorkers[index]?.getId() || this._alWorkers[0]?.getId();
  }

  async _optimizePhase(context, transformed) {
    const optimized = transformed.map(file => ({
      ...file,
      optimized: true,
      content: this._basicOptimize(file.content)
    }));

    return { ok: true, optimized };
  }

  async _bundlePhase(context, optimized) {
    const bundle = optimized.map(file => ({
      path: file.path,
      content: file.content,
      bytes: file.content?.length || 0
    }));

    const totalBytes = bundle.reduce((sum, f) => sum + f.bytes, 0);

    return {
      ok: true,
      bundle,
      totalBytes
    };
  }

  _detectFileType(ext) {
    const types = {
      js: "javascript",
      jsx: "react",
      ts: "typescript",
      tsx: "react-typescript",
      css: "stylesheet",
      html: "markup",
      json: "data"
    };
    return types[ext] || "unknown";
  }

  _basicTransform(content, type) {
    if (!content) return content;
    
    // Poista kommentit (yksinkertainen versio)
    let transformed = content;
    
    if (type === "javascript" || type === "react" || type === "typescript") {
      // Poista console.log tuotantoon
      transformed = transformed.replace(/console\.log\([^)]*\);?\n?/g, "");
    }
    
    return transformed;
  }

  _basicOptimize(content) {
    if (!content) return content;
    
    // Poista ylimääräiset tyhjät rivit
    return content.replace(/\n\s*\n\s*\n/g, "\n\n");
  }

  _addToHistory(context) {
    this._buildHistory.push({
      buildId: context.buildId,
      startedAt: context.startedAt,
      finishedAt: context.finishedAt,
      inputCount: context.files.length,
      outputCount: context.output.length,
      phases: context.phases.map(p => p.name)
    });

    if (this._buildHistory.length > this._maxHistory) {
      this._buildHistory.shift();
    }
  }

  getBuildHistory(count = 10) {
    return this._buildHistory.slice(-count);
  }

  getStats() {
    return {
      ...super.getStats(),
      alWorkersCount: this._alWorkers.length,
      hasCoordinator: !!this._alCoordinator,
      historyCount: this._buildHistory.length
    };
  }
}

export function createAL2BuilderWorker(options) {
  return new AL2BuilderWorker(options);
}

export default AL2BuilderWorker;