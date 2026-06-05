export class VaultWorker {
  async run({ manifest }) {
    return {
      stored: true,
      manifest
    };
  }
}