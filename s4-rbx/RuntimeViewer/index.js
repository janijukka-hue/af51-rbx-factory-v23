// s4-rbx/RuntimeViewer/index.js — AF51-RBX Studio Layer
// Inspects injected Luau runtime modules. Spec §9, §18.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const BOOT_ORDER = ['AuditRuntime', 'EventBus', 'StateStore', 'NetworkLayer', 'ServiceRegistry', 'RuntimeInit'];

export class RuntimeViewer {
  static inspect(buildRoot) {
    const dir = path.join(buildRoot, 'src', 'ReplicatedStorage', 'Packages', 'AF51Runtime');
    if (!existsSync(dir)) return { ok: false, modules: [], error: 'AF51Runtime not found' };
    const modules = readdirSync(dir)
      .filter(f => f.endsWith('.lua') && !f.startsWith('.'))
      .map(f => {
        const full = path.join(dir, f);
        const content = readFileSync(full, 'utf8');
        const lines = content.split('\n').length;
        return {
          name:      f,
          lines,
          sizeBytes: statSync(full).size,
          bootOrder: (BOOT_ORDER.indexOf(f.replace('.lua', '')) + 1) || 99,
          hasStrict: content.includes('--!strict'),
        };
      })
      .sort((a, b) => a.bootOrder - b.bootOrder);
    return {
      ok: true,
      modules,
      summary: {
        count:      modules.length,
        totalLines: modules.reduce((s, m) => s + m.lines, 0),
        allStrict:  modules.every(m => m.hasStrict),
      },
    };
  }

  static print(buildRoot) {
    const { ok, modules, summary, error } = RuntimeViewer.inspect(buildRoot);
    if (!ok) { console.error('[RuntimeViewer] ' + error); return; }
    console.log(`[RuntimeViewer] ${summary.count} modules, ${summary.totalLines} lines, allStrict=${summary.allStrict}`);
    modules.forEach(m => console.log(`  ${m.bootOrder}. ${m.name} (${m.lines} lines, ${m.sizeBytes}B, strict=${m.hasStrict})`));
  }
}

export default RuntimeViewer;
