// s4-rbx/AssetBrowser/index.js — AF51-RBX Studio Layer
// Reads asset manifests. Spec §14, §18.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export class AssetBrowser {
  static read(buildRoot) {
    const d = path.join(buildRoot, 'assets');
    const r = { ok: true, manifest: null, map: null, hashes: null, errors: [] };
    for (const [k, f] of [
      ['manifest', 'asset-manifest.json'],
      ['map',      'asset-map.json'],
      ['hashes',   'asset-hashes.json'],
    ]) {
      const p = path.join(d, f);
      if (!existsSync(p)) { r.errors.push(`Missing:${f}`); continue; }
      try { r[k] = JSON.parse(readFileSync(p, 'utf8')); }
      catch (e) { r.errors.push(`Parse ${f}:${e.message}`); }
    }
    r.ok = r.errors.length === 0;
    r.summary = {
      assetCount:   r.manifest?.assets?.length || 0,
      hasHashChain: !!r.hashes?.chainHash,
    };
    return r;
  }

  static print(buildRoot) {
    const { ok, manifest, summary, errors } = AssetBrowser.read(buildRoot);
    console.log(`[AssetBrowser] ok=${ok} assets=${summary.assetCount} hashChain=${summary.hasHashChain}`);
    if (errors.length) errors.forEach(e => console.error('  ✗ ' + e));
    (manifest?.assets || []).forEach(a => console.log(`  • ${a.name || a.id || a.path || JSON.stringify(a)}`));
  }
}

export default AssetBrowser;
