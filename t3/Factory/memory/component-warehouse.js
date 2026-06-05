// t3/Factory/memory/component-warehouse.js
// Component Warehouse - Reusable component storage

export class ComponentWarehouse {
  constructor(options = {}) {
    this._clock = options.clock;
    this._maxItems = options.maxItems || 1000;
    this._components = new Map();
    this._tags = new Map();
  }

  store(component) {
    if (this._components.size >= this._maxItems && !this._components.has(component.id)) {
      return { ok: false, error: "Warehouse full" };
    }

    const entry = {
      ...component,
      storedAt: this._clock?.now() || Date.now()
    };

    this._components.set(component.id, entry);

    if (component.tags) {
      for (const tag of component.tags) {
        if (!this._tags.has(tag)) {
          this._tags.set(tag, new Set());
        }
        this._tags.get(tag).add(component.id);
      }
    }

    return { ok: true, componentId: component.id };
  }

  get(id) {
    return this._components.get(id) || null;
  }

  getByTag(tag) {
    const ids = this._tags.get(tag);
    if (!ids) return [];
    return Array.from(ids).map(id => this._components.get(id)).filter(Boolean);
  }

  search(query) {
    const lower = query.toLowerCase();
    return Array.from(this._components.values()).filter(c => {
      const name = (c.name || "").toLowerCase();
      const desc = (c.description || "").toLowerCase();
      return name.includes(lower) || desc.includes(lower);
    });
  }

  getAll() {
    return Array.from(this._components.values());
  }

  delete(id) {
    const component = this._components.get(id);
    if (component?.tags) {
      for (const tag of component.tags) {
        const tagSet = this._tags.get(tag);
        if (tagSet) {
          tagSet.delete(id);
          if (tagSet.size === 0) {
            this._tags.delete(tag);
          }
        }
      }
    }
    this._components.delete(id);
    return { ok: true };
  }

  getStats() {
    return {
      count: this._components.size,
      maxItems: this._maxItems,
      tagCount: this._tags.size
    };
  }
}

export function createComponentWarehouse(options) {
  return new ComponentWarehouse(options);
}

export default ComponentWarehouse;