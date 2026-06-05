// k1/alx/skills/roblox/RobloxBuildSkill.js
// AF51 Factory — ALX skill for Roblox builds
// Registers "roblox" intent into the ALX skill engine.

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require     = createRequire(import.meta.url);
const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const FACTORY_ROOT = path.resolve(__dirname, '../../../../');

export var ROBLOX_BUILD_SKILL_META = {
  id:          'roblox-build',
  version:     '1.0.0',
  description: 'Builds a Roblox-native Luau project ZIP capsule via AF51-RBX pipeline',
  intents:     ['roblox', 'roblox-build', 'build-roblox', 'rbx'],
  params: {
    targetId:  { type: 'string', required: true,  enum: ['obby', 'tycoon', 'simulator', 'rpg', 'fps'] },
    profileId: { type: 'string', required: false, default: 'development' },
    gameName:  { type: 'string', required: false },
    version:   { type: 'string', required: false, default: '1.0.0' },
  },
};

export async function execute(params, context) {
  var audit = context && context.auditLedger;

  var _log = function(level, msg, meta) {
    if (!audit) return;
    var fn = audit[level] || audit.info;
    if (typeof fn === 'function') fn.call(audit, '[RobloxBuildSkill] ' + msg, meta || {});
  };

  var targetId  = (params && params.targetId)  || 'obby';
  var profileId = (params && params.profileId) || 'development';
  var gameName  = (params && params.gameName)  || null;
  var version   = (params && params.version)   || '1.0.0';

  _log('info', 'Skill execute: target=' + targetId + ' profile=' + profileId);

  // Lazy-require CJS m2/roblox from ESM skill
  var m2;
  try {
    m2 = require('../../m2/roblox/index.js');
  } catch (e) {
    // Try relative from factory root
    m2 = require(path.join(FACTORY_ROOT, 'm2/roblox/index.js'));
  }

  var result = await m2.RobloxOrchestrator.process(
    {
      type:      'BUILD',
      targetId,
      profileId,
      gameName,
      version,
    },
    {
      targetsDir:  path.join(FACTORY_ROOT, 'targets'),
      profilesDir: path.join(FACTORY_ROOT, 'packageProfiles'),
      exportsDir:  path.join(FACTORY_ROOT, 'exports-rbx'),
      runtimeDir:  path.join(FACTORY_ROOT, 'runtime'),
      auditLedger: audit,
    }
  );

  if (result.ok) {
    _log('info', 'Build success: ' + result.zipPath, { buildId: result.buildId });
    return {
      ok:      true,
      buildId: result.buildId,
      zipPath: result.zipPath,
      message: 'Roblox ZIP capsule built: ' + path.basename(result.zipPath),
    };
  } else {
    _log('error', 'Build failed: ' + (result.error || 'unknown'), { errors: result.errors });
    return {
      ok:     false,
      error:  result.error,
      errors: result.errors,
    };
  }
}

export var RobloxBuildSkill = {
  name: 'roblox-build',
  meta: ROBLOX_BUILD_SKILL_META,
  execute,
};

export default RobloxBuildSkill;