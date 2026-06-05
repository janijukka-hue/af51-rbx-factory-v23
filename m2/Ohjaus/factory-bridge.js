// m2/Ohjaus/factory-bridge.js
// Bridge between MasterRoom/ALX and T3 Factory.
// M2-kerros: ei kirjoita tiedostoja, ei aja komentoja.
// Muuntaa ProjectSpecin T3-komennoksi ja välittää Factorylle.

import { specToT3Command, validateProjectSpec } from "./project-spec.js";

export class FactoryBridge {

  constructor(options = {}) {
    this._factory       = options.factory || null;
    this._clock         = options.clock   || null;
    this._eventHandlers = new Map();
  }

  setFactory(factory) {
    this._factory = factory;
    this._subscribeToEvents();
  }

  getFactory() {
    return this._factory;
  }

  isConnected() {
    return this._factory !== null && this._factory.getState() !== "OFFLINE";
  }

  _subscribeToEvents() {
    if (!this._factory) return;
    const eventBus = this._factory.getEventBus();
    if (!eventBus) return;

    eventBus.subscribeAll((event) => {
      const handlers = this._eventHandlers.get(event.type) || [];
      for (const handler of handlers) {
        try { handler(event); }
        catch (err) { console.error("FactoryBridge event handler error:", err); }
      }
    });
  }

  onEvent(eventType, handler) {
    if (!this._eventHandlers.has(eventType)) {
      this._eventHandlers.set(eventType, []);
    }
    this._eventHandlers.get(eventType).push(handler);
    return () => {
      const handlers = this._eventHandlers.get(eventType);
      const index    = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    };
  }

  // ── Alkuperäinen build (files-pohjainen) ─────────────────

  async build(files, metadata = {}) {
    if (!this._factory) return { ok: false, error: "Factory not connected" };
    return await this._factory.handleCommand({
      intent:   "BUILD",
      files,
      metadata
    });
  }

  async buildAndPublish(files, metadata = {}, channels = ["LOCAL"]) {
    if (!this._factory) return { ok: false, error: "Factory not connected" };
    return await this._factory.handleCommand({
      intent:  "BUILD_AND_PUBLISH",
      files,
      metadata,
      options: { channels }
    });
  }

  // ── ProjectSpec-pohjainen build ──────────────────────────

  /**
   * buildFromSpec(spec)
   * M2 rakentaa ProjectSpecin, bridge muuntaa sen T3-komennoksi.
   *
   * Kulku:
   *   M2: buildProjectSpec(target, params) → spec
   *   M2: factoryBridge.buildFromSpec(spec)
   *   Bridge: validateProjectSpec → specToT3Command → factory.handleCommand
   *
   * @param  {object} spec — buildProjectSpec():n palauttama ProjectSpec-olio
   * @returns {Promise<{ok, traceId?, error?}>}
   */
  async buildFromSpec(spec) {
    if (!this._factory) return { ok: false, error: "Factory not connected" };

    // Validointi M2-tasolla ennen T3:een lähettämistä
    const validation = validateProjectSpec(spec);
    if (!validation.valid) {
      return {
        ok:     false,
        error:  "Virheellinen ProjectSpec: " + validation.errors.join(", "),
        errors: validation.errors
      };
    }

    let command;
    try {
      command = specToT3Command(spec);
    } catch (err) {
      return { ok: false, error: "specToT3Command epäonnistui: " + err.message };
    }

    return await this._factory.handleCommand(command);
  }

  /**
   * buildAndPublishFromSpec(spec, channels)
   * Sama kuin buildFromSpec mutta publishaa automaattisesti.
   */
  async buildAndPublishFromSpec(spec, channels = ["LOCAL"]) {
    if (!this._factory) return { ok: false, error: "Factory not connected" };

    const validation = validateProjectSpec(spec);
    if (!validation.valid) {
      return { ok: false, error: "Virheellinen ProjectSpec: " + validation.errors.join(", ") };
    }

    let command;
    try {
      command = specToT3Command(spec);
    } catch (err) {
      return { ok: false, error: "specToT3Command epäonnistui: " + err.message };
    }

    return await this._factory.handleCommand({
      ...command,
      intent:  "BUILD_AND_PUBLISH",
      options: { channels }
    });
  }

  // ── Muut operaatiot ──────────────────────────────────────

  async publish(channels = ["LOCAL"]) {
    if (!this._factory) return { ok: false, error: "Factory not connected" };
    return await this._factory.handleCommand({ intent: "PUBLISH", options: { channels } });
  }

  async validate(files) {
    if (!this._factory) return { ok: false, error: "Factory not connected" };
    return await this._factory.handleCommand({ intent: "VALIDATE", files });
  }

  // ── Tila ────────────────────────────────────────────────

  getStatus() {
    if (!this._factory) return { connected: false };
    return { connected: true, ...this._factory.getStatus() };
  }

  getArtifacts() {
    if (!this._factory) return [];
    const memory = this._factory.getMemory();
    return memory.vault?.getAll?.() || [];
  }

  getLatestArtifact() {
    if (!this._factory) return null;
    const memory = this._factory.getMemory();
    return memory.vault?.getLatest?.() || null;
  }

  getReleases() {
    if (!this._factory) return [];
    const memory = this._factory.getMemory();
    return memory.registry?.getAll?.() || [];
  }
}

export function createFactoryBridge(options) {
  return new FactoryBridge(options);
}

export default FactoryBridge;