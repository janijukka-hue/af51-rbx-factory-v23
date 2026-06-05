// m2/roblox/roblox-orchestrator.js — ESM
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RobloxTargetResolver } from './roblox-target-resolver.js';
import { RobloxBuildManager }   from './roblox-build-manager.js';
import { RobloxPublishGovernor } from './roblox-publish-governor.js';
import { RobloxPackageManager } from './roblox-package-manager.js';

export const INTENT = Object.freeze({ BUILD:'BUILD', INSPECT:'INSPECT', LIST:'LIST' });

export class RobloxOrchestrator {
  static async process(intent, opts={}) {
    const { auditLedger, targetsDir, profilesDir, exportsDir, buildRoot } = opts;
    const _a = (l,m,meta={}) => auditLedger?.[l]?.(`[Orchestrator] ${m}`, meta);

    if (!intent?.type) return { ok:false, error:'intent.type required', errors:['intent.type required'] };
    _a('info', `Intent: ${intent.type}`, { targetId: intent.targetId });

    if (intent.type === INTENT.LIST) {
      return { ok:true, result:{ targets: RobloxTargetResolver.listTargets(targetsDir), profiles: RobloxPackageManager.listProfiles(profilesDir) } };
    }

    if (intent.type === INTENT.INSPECT) {
      if (!intent.targetId) return { ok:false, error:'targetId required', errors:['targetId required'] };
      const r = RobloxTargetResolver.resolve({ targetId:intent.targetId, targetsDir, auditLedger });
      return { ok:r.ok, result:r.target, errors:r.errors, error:r.errors[0] };
    }

    if (intent.type === INTENT.BUILD) {
      if (!intent.targetId) return { ok:false, error:'targetId required', errors:['targetId required'] };

      const rr = RobloxTargetResolver.resolve({ targetId:intent.targetId, targetsDir, auditLedger });
      if (!rr.ok) return { ok:false, error:`Target resolution failed: ${rr.errors.join(', ')}`, errors:rr.errors };

      const pre = await RobloxPublishGovernor.preCheck({ target:rr.target, auditLedger });
      if (!pre.ok) return { ok:false, error:pre.error, errors:[pre.error] };

      const build = await RobloxBuildManager.build({
        target:rr.target, buildRoot, exportsDir,
        gameName:intent.gameName, version:intent.version,
        placeId:intent.placeId, universeId:intent.universeId,
        keepBuildDir:intent.keepBuildDir||false, auditLedger,
        // v63 — user-supplied Lua seed travels with the intent and is
        // preserved as an extra ServerScriptService script in the final
        // zip. Pure passthrough: orchestrator does not interpret it.
        userSource: intent.userSource || null,
      });
      if (!build.ok) return { ok:false, error:build.error, errors:build.errors||[build.error], result:build };

      const post = await RobloxPublishGovernor.postCheck({ target:rr.target, buildResult:build, auditLedger });
      if (!post.ok) return { ok:false, error:post.error, errors:[post.error], result:build };

      return { ok:true, buildId:build.buildId, outputZip:build.outputZip, zipPath:build.zipPath, ghostId:build.ghostId, artifactHash:build.artifactHash, errors:[], result:build };
    }

    return { ok:false, error:`Unknown intent: "${intent.type}"`, errors:[`Unknown intent: ${intent.type}`] };
  }
}