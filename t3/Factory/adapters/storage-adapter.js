// t3/Factory/adapters/storage-adapter.js
// Storage Adapter - In-memory storage (React Native compatible)

export class StorageAdapter {
  constructor(options = {}) {
    this._storage = new Map();
    this._maxSize = options.maxSize || 100 * 1024 * 1024;
    this._currentSize = 0;
  }

  async write(key, data) {
    const bytes = typeof data === "string" ? data.length : JSON.stringify(data).length;
    
    if (this._currentSize + bytes > this._maxSize) {
      return { ok: false, error: "Storage full" };
    }

    this._storage.set(key, { data, bytes, createdAt: Date.now() });
    this._currentSize += bytes;

    return { ok: true, key, bytes };
  }

  async read(key) {
    const entry = this._storage.get(key);
    if (!entry) {
      return { ok: false, error: "Not found" };
    }
    return { ok: true, data: entry.data };
  }

  async delete(key) {
    const entry = this._storage.get(key);
    if (entry) {
      this._currentSize -= entry.bytes;
      this._storage.delete(key);
    }
    return { ok: true };
  }

  async exists(key) {
    return this._storage.has(key);
  }

  async list(prefix = "") {
    const keys = [];
    for (const key of this._storage.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  getStats() {
    return {
      itemCount: this._storage.size,
      currentSize: this._currentSize,
      maxSize: this._maxSize,
      utilization: this._currentSize / this._maxSize
    };
  }
}

export function createStorageAdapter(options) {
  return new StorageAdapter(options);
}

export default StorageAdapter;