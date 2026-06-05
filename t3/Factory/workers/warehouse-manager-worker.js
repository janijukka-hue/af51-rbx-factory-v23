// t3/Factory/workers/warehouse-manager-worker.js
// Warehouse Manager Worker - Komponenttivaraston hallinta

import { BaseWorker } from "./base-worker.js";

export class WarehouseManagerWorker extends BaseWorker {
  constructor(options = {}) {
    super({ ...options, name: "WarehouseManager" });
    this._warehouse = options.warehouseMemory || null;
  }

  setWarehouse(warehouse) {
    this._warehouse = warehouse;
  }

  async storeComponent(component) {
    return await this._runTask("store", async () => {
      if (!this._warehouse) {
        return { ok: false, error: "No warehouse connected" };
      }

      this._warehouse.store(component);
      return { ok: true, componentId: component.id };
    });
  }

  async retrieveComponent(id) {
    return await this._runTask("retrieve", async () => {
      if (!this._warehouse) {
        return { ok: false, error: "No warehouse connected" };
      }

      const component = this._warehouse.get(id);
      if (!component) {
        return { ok: false, error: `Component not found: ${id}` };
      }

      return { ok: true, component };
    });
  }

  async searchComponents(query) {
    return await this._runTask("search", async () => {
      if (!this._warehouse) {
        return { ok: false, error: "No warehouse connected" };
      }

      const results = this._warehouse.search(query);
      return { ok: true, results };
    });
  }
}

export function createWarehouseManagerWorker(options) {
  return new WarehouseManagerWorker(options);
}

export default WarehouseManagerWorker;