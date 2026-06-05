export class AssetWorker {
  async run({ assets }) {
    const validated = assets.map(asset => ({
      ...asset,
      valid: true
    }));

    return {
      assets: validated,
      deterministic: true
    };
  }
}