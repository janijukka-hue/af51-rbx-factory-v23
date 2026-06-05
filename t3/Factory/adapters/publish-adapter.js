// t3/Factory/adapters/publish-adapter.js
// Publish Adapter - Multi-channel publishing

export const CHANNEL = {
  LOCAL: "LOCAL",
  GOOGLE_PLAY: "GOOGLE_PLAY",
  APPLE_APP_STORE: "APPLE_APP_STORE",
  WEB_HOSTING: "WEB_HOSTING",
  EXPORT_ZIP: "EXPORT_ZIP"
};

export class PublishAdapter {
  constructor(options = {}) {
    this._clock = options.clock;
    this._channelConfigs = new Map();
    this._setupDefaultChannels();
  }

  _setupDefaultChannels() {
    this._channelConfigs.set(CHANNEL.LOCAL, {
      name: "Local Storage",
      enabled: true,
      publish: async (artifact, release) => {
        return { ok: true, url: `local://${release.id}` };
      }
    });

    this._channelConfigs.set(CHANNEL.EXPORT_ZIP, {
      name: "Export ZIP",
      enabled: true,
      publish: async (artifact, release) => {
        return { ok: true, filename: `${release.projectName || "export"}_${release.version}.zip` };
      }
    });

    this._channelConfigs.set(CHANNEL.WEB_HOSTING, {
      name: "Web Hosting",
      enabled: true,
      publish: async (artifact, release) => {
        return { ok: true, url: `https://preview.factory.local/${release.id}` };
      }
    });

    this._channelConfigs.set(CHANNEL.GOOGLE_PLAY, {
      name: "Google Play",
      enabled: false,
      publish: async (artifact, release) => {
        return { ok: false, error: "Google Play credentials not configured" };
      }
    });

    this._channelConfigs.set(CHANNEL.APPLE_APP_STORE, {
      name: "Apple App Store",
      enabled: false,
      publish: async (artifact, release) => {
        return { ok: false, error: "App Store credentials not configured" };
      }
    });
  }

  configureChannel(channel, config) {
    const existing = this._channelConfigs.get(channel) || {};
    this._channelConfigs.set(channel, { ...existing, ...config });
  }

  async publish(artifact, release, channels) {
    const results = [];

    for (const channel of channels) {
      const config = this._channelConfigs.get(channel);
      
      if (!config) {
        results.push({ channel, ok: false, error: `Unknown channel: ${channel}` });
        continue;
      }

      if (!config.enabled) {
        results.push({ channel, ok: false, error: `Channel disabled: ${channel}` });
        continue;
      }

      try {
        const result = await config.publish(artifact, release);
        results.push({ channel, ...result });
      } catch (err) {
        results.push({ channel, ok: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.ok).length;

    return {
      ok: successCount === channels.length,
      status: successCount === channels.length ? "COMPLETED" : 
              successCount > 0 ? "PARTIAL" : "FAILED",
      results
    };
  }

  getAvailableChannels() {
    const channels = [];
    for (const [id, config] of this._channelConfigs) {
      channels.push({
        id,
        name: config.name,
        enabled: config.enabled
      });
    }
    return channels;
  }
}

export function createPublishAdapter(options) {
  return new PublishAdapter(options);
}

export default PublishAdapter;