// s4-rbx/PackageInspector/index.js — AF51-RBX Studio Layer
// Inspects manifest, Rojo project, lock file. Spec §16, §18.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export class PackageInspector {
  static inspect(buildRoot) {
    const r = { ok: true, rojo: null, manifest: null, lock: null, errors: [] };
    for (const [k, f] of [
      ['rojo',     'default.project.json'],
      ['manifest', 'manifest.json'],
      ['lock',     'package-lock.json'],
    ]) {
      const p = path.join(buildRoot, f);
      if (!existsSync(p)) { r.errors.push(`Missing:${f}`); continue; }
      try { r[k] = JSON.parse(readFileSync(p, 'utf8')); }
      catch (e) { r.errors.push(`Parse ${f}:${e.message}`); }
    }
    if (r.rojo && !r.rojo.tree) r.errors.push('default.project.json: missing tree');
    if (r.manifest) {
      for (const f of ['buildId', 'targetId', 'version', 'gameName']) {
        if (!r.manifest[f]) r.errors.push(`manifest.json missing:${f}`);
      }
    }
    r.ok = r.errors.length === 0;
    r.summary = {
      gameName: r.manifest?.gameName || '?',
      targetId: r.manifest?.targetId || '?',
      buildId:  r.manifest?.buildId  || '?',
      lockDeps: r.lock?.dependencies?.length || 0,
    };
    return r;
  }

  static print(buildRoot) {
    const { ok, summary, errors } = PackageInspector.inspect(buildRoot);
    console.log(`[PackageInspector] ok=${ok} game=${summary.gameName} target=${summary.targetId} build=${summary.buildId} deps=${summary.lockDeps}`);
    errors.forEach(e => console.error('  ✗ ' + e));
  }
}

export default PackageInspector;
