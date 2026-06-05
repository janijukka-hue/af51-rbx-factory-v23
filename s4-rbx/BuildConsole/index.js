// s4-rbx/BuildConsole/index.js — AF51-RBX Studio Layer
// Drives rbx build pipeline with phase streaming. Spec §18. Node.js only.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

export class BuildConsole {
  static async run({ targetId, profileId = 'development', onPhase } = {}) {
    console.log(`[BuildConsole] running target=${targetId} profile=${profileId}`);
    const { RobloxOrchestrator, INTENT } = await import('../../m2/roblox/roblox-orchestrator.js');
    const audit = {
      log:      (e, l) => console.log(`[audit:${l || 'INFO'}] ${e}`),
      debug:    (m)    => console.log(`  [DEBUG] ${m}`),
      info:     (m)    => console.log(`  [INFO ] ${m}`),
      warn:     (m)    => console.warn(`  [WARN ] ${m}`),
      error:    (m)    => console.error(`  [ERROR] ${m}`),
      critical: (m)    => console.error(`  [CRIT ] ${m}`),
    };
    const result = await RobloxOrchestrator.process(
      { type: INTENT.BUILD, targetId, profileId },
      {
        targetsDir:  path.join(ROOT, 'targets'),
        profilesDir: path.join(ROOT, 'packageProfiles'),
        exportsDir:  path.join(ROOT, 'exports-rbx'),
        auditLedger: audit,
      }
    );
    (result.result?.phases || []).forEach(p => { if (onPhase) onPhase(p.name, p); });
    if (!result.ok) console.error('[BuildConsole] ✗ ' + result.error);
    return result;
  }
}

export default BuildConsole;
