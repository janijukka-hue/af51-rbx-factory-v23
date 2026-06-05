// t3/Factory/memory/release-registry.js
// Release Registry - Published release tracking

export class ReleaseRegistry {
  constructor(options = {}) {
    this._clock = options.clock;
    this._maxReleases = options.maxReleases || 500;
    this._releases = new Map();
    this._byVersion = new Map();
    this._byChannel = new Map();
  }

  register(release) {
    if (this._releases.size >= this._maxReleases && !this._releases.has(release.id)) {
      this._pruneOldest(1);
    }

    const entry = {
      ...release,
      registeredAt: this._clock?.now() || Date.now()
    };

    this._releases.set(release.id, entry);

    if (release.version) {
      if (!this._byVersion.has(release.version)) {
        this._byVersion.set(release.version, []);
      }
      this._byVersion.get(release.version).push(release.id);
    }

    if (release.channels) {
      for (const channel of release.channels) {
        if (!this._byChannel.has(channel)) {
          this._byChannel.set(channel, []);
        }
        this._byChannel.get(channel).push(release.id);
      }
    }

    return { ok: true, releaseId: release.id };
  }

  get(id) {
    return this._releases.get(id) || null;
  }

  getByVersion(version) {
    const ids = this._byVersion.get(version) || [];
    return ids.map(id => this._releases.get(id)).filter(Boolean);
  }

  getByChannel(channel) {
    const ids = this._byChannel.get(channel) || [];
    return ids.map(id => this._releases.get(id)).filter(Boolean);
  }

  getLatest() {
    let latest = null;
    let latestTime = 0;

    for (const release of this._releases.values()) {
      if (release.registeredAt > latestTime) {
        latestTime = release.registeredAt;
        latest = release;
      }
    }

    return latest;
  }

  getAll() {
    return Array.from(this._releases.values());
  }

  getRecent(count = 20) {
    return Array.from(this._releases.values())
      .sort((a, b) => b.registeredAt - a.registeredAt)
      .slice(0, count);
  }

  _pruneOldest(count) {
    const sorted = Array.from(this._releases.entries())
      .sort((a, b) => a[1].registeredAt - b[1].registeredAt);

    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      const [id] = sorted[i];
      this._releases.delete(id);
    }
  }

  getStats() {
    return {
      count: this._releases.size,
      maxReleases: this._maxReleases,
      versionCount: this._byVersion.size,
      channelCount: this._byChannel.size
    };
  }
}

export function createReleaseRegistry(options) {
  return new ReleaseRegistry(options);
}

export default ReleaseRegistry;