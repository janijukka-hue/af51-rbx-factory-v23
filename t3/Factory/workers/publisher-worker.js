// t3/Factory/workers/publisher-worker.js
// Publisher Worker - Julkaisu eri kanaviin

import { BaseWorker } from "./base-worker.js";

export const PUBLISH_CHANNEL = {
  LOCAL: "LOCAL",
  GOOGLE_PLAY: "GOOGLE_PLAY",
  APPLE_APP_STORE: "APPLE_APP_STORE",
  WEB_HOSTING: "WEB_HOSTING",
  EXPORT_ZIP: "EXPORT_ZIP"
};

export class PublisherWorker extends BaseWorker {
  constructor(options = {}) {
    super({ ...options, name: "Publisher" });
    this._adapters = new Map();
    this._setupDefaultAdapters();
  }

  _setupDefaultAdapters() {
    this._adapters.set(PUBLISH_CHANNEL.LOCAL, {
      name: "Local",
      publish: async (artifact, release) => {
        return { ok: true, location: `/local/${release.id}` };
      }
    });

    this._adapters.set(PUBLISH_CHANNEL.EXPORT_ZIP, {
      name: "Export ZIP",
      publish: async (artifact, release) => {
        return { ok: true, location: `${release.id}.zip` };
      }
    });
  }

  registerAdapter(channel, adapter) {
    this._adapters.set(channel, adapter);
  }

  async publish(artifact, release, channels) {
    return await this._runTask("publish", async () => {
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const channel of channels) {
        const adapter = this._adapters.get(channel);
        
        if (!adapter) {
          results.push({
            channel,
            ok: false,
            error: `No adapter for channel: ${channel}`
          });
          failCount++;
          continue;
        }

        try {
          const result = await adapter.publish(artifact, release);
          results.push({ channel, ...result });
          if (result.ok) successCount++;
          else failCount++;
        } catch (err) {
          results.push({ channel, ok: false, error: err.message });
          failCount++;
        }
      }

      return {
        ok: failCount === 0,
        status: failCount === 0 ? "COMPLETED" : successCount > 0 ? "PARTIAL" : "FAILED",
        results,
        summary: { total: channels.length, success: successCount, failed: failCount }
      };
    });
  }
}

export function createPublisherWorker(options) {
  return new PublisherWorker(options);
}

export default PublisherWorker;