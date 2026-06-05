// t3/Factory/workers/packager-worker.js
// Packager Worker - Paketointi

import { BaseWorker } from "./base-worker.js";
import { fnv1a32 } from "../core/factory-utils.js";

export class PackagerWorker extends BaseWorker {
  constructor(options = {}) {
    super({ ...options, name: "Packager" });
  }

  async package(files, manifest) {
    return await this._runTask("package", async () => {
      const packageId = `pkg_${this._clock.now()}`;
      
      const packagedFiles = files.map(f => ({
        path: f.path,
        content: f.content,
        bytes: f.content?.length || 0
      }));

      const totalBytes = packagedFiles.reduce((sum, f) => sum + f.bytes, 0);
      const checksum = fnv1a32(JSON.stringify(packagedFiles)).toString(16);

      const pkg = {
        id: packageId,
        manifest: {
          name: manifest.projectName || "package",
          version: manifest.version || "1.0.0",
          target: manifest.target || "web"
        },
        files: packagedFiles,
        totalBytes,
        checksum,
        createdAt: this._clock.now()
      };

      return {
        ok: true,
        package: pkg
      };
    });
  }
}

export function createPackagerWorker(options) {
  return new PackagerWorker(options);
}

export default PackagerWorker;