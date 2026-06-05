#!/usr/bin/env node
// rbx.mjs — AF51 Factory: Roblox Build CLI (ESM)
//
// Käyttö:
//   node rbx.mjs build <targetId> [profileId]
//   node rbx.mjs list
//   node rbx.mjs inspect <targetId>
//   node rbx.mjs preview [targetId]   # opens http://localhost:8765/

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RobloxOrchestrator, INTENT } from './m2/roblox/roblox-orchestrator.js';
import { RobloxTargetResolver }       from './m2/roblox/roblox-target-resolver.js';
import { RobloxPackageManager }       from './m2/roblox/roblox-package-manager.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = __dirname;
const TARGETS_DIR  = path.join(ROOT, 'targets');
const PROFILES_DIR = path.join(ROOT, 'packageProfiles');
const EXPORTS_DIR  = path.join(ROOT, 'exports-rbx');

function makeAudit() {
  const LVL = { debug:'  [DEBUG]', info:'  [INFO ]', warn:'  [WARN ]', error:'  [ERROR]', critical:'  [CRIT ]' };
  const _log = (s, m) => console.log((LVL[s] || LVL.info) + ' ' + (typeof m === 'string' ? m : JSON.stringify(m)));
  return {
    log:      (e,l,m) => _log((l||'info').toLowerCase(), e),
    debug:    (m) => _log('debug',    m),
    info:     (m) => _log('info',     m),
    warn:     (m) => _log('warn',     m),
    error:    (m) => _log('error',    m),
    critical: (m) => _log('critical', m),
  };
}

const [,,command, arg1, arg2] = process.argv;
const audit = makeAudit();

// Determinism is the default for CLI builds — same input must yield same ZIP
// across runs (byte-stable SHA). To opt out for a one-off debug run, set
// RBX_DETERMINISTIC_BUILD=0 explicitly. Anything other than "0" keeps it on.
if (process.env.RBX_DETERMINISTIC_BUILD !== '0') {
  process.env.RBX_DETERMINISTIC_BUILD = '1';
}

switch (command) {
  case 'build': {
    if (!arg1) { console.error('Käyttö: node rbx.mjs build <targetId> [profileId]'); process.exit(1); }
    
    
    
    const r = await RobloxOrchestrator.process(
      { type: INTENT.BUILD, targetId: arg1, profileId: arg2 || 'development' },
      { targetsDir: TARGETS_DIR, profilesDir: PROFILES_DIR, exportsDir: EXPORTS_DIR, auditLedger: audit }
    );
    if (r.ok) {
      console.log('\n✓ BUILD OK');
      console.log('  ZIP:      ' + (r.zipPath || r.outputZip || '?'));
      console.log('  Build ID: ' + (r.buildId || '?'));
      process.exit(0);
    } else {
      console.error('\n✗ BUILD FAILED');
      (r.errors || [r.error]).forEach(e => console.error('  ' + e));
      process.exit(1);
    }
    break;
  }
  case 'list': {
    const targets  = RobloxTargetResolver.listTargets(TARGETS_DIR);
    const profiles = RobloxPackageManager.listProfiles(PROFILES_DIR);
    
    console.log('\nTARGETS:');
    targets.forEach(t => console.log('  - ' + (t.id || t)));
    console.log('\nPROFILES:');
    profiles.forEach(p => console.log('  - ' + (p.id || p)));
    
    break;
  }
  case 'inspect': {
    if (!arg1) { console.error('Käyttö: node rbx.mjs inspect <targetId>'); process.exit(1); }
    const r = RobloxTargetResolver.resolve({ targetId: arg1, targetsDir: TARGETS_DIR });
    r.ok ? console.log(JSON.stringify(r.target || r, null, 2)) : (console.error(r.errors), process.exit(1));
    break;
  }
  case 'preview': {
    const { startPreviewServer } = await import('./runtime/preview-engine/preview-server.js');
    const { url } = await startPreviewServer();
    if (arg1) console.log('  Target hint: ' + arg1 + '  (pass ?target=' + arg1 + ' or use the top bar)');
    console.log('  AF51-RBX Studio Preview ready: ' + url);
    console.log('  Ctrl-C to stop.');
    break;
  }
  default: {
    console.error('Tuntematon komento: ' + (command || '(tyhjä)'));
    console.error('Käyttö: node rbx.mjs build|list|inspect|preview');
    process.exit(1);
  }
}