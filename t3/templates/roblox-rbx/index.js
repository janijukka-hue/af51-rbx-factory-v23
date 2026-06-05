// t3/templates/roblox-rbx/index.js
// AF51 Factory — Roblox Template
// Integrates into the factory's template registry.
// Delegates actual build to m2/roblox/RobloxOrchestrator.

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export var TEMPLATE_META = {
  id:          'roblox-rbx',
  version:     '1.0.0',
  target:      'roblox-rbx',
  stack:       'roblox-luau',
  description: 'Roblox-native Luau project — k1 governed, Rojo-compatible ZIP capsule',
  minNode:     '18',
  outputs:     ['zip'],
  robloxNative: true,
};

/**
 * getFiles() — returns the Roblox build intent for TemplatePhase.
 * Unlike web templates that return static files, this returns a
 * build intent that is handed off to RobloxOrchestrator.
 *
 * @param {object} params
 * @param {string} params.targetId   - 'obby' | 'tycoon' | 'simulator' | 'rpg' | 'fps'
 * @param {string} [params.profileId] - 'development' | 'production' | 'creator' | 'marketplace'
 * @param {string} [params.gameName]
 * @param {string} [params.version]
 * @returns {{ __robloxBuildIntent: true, targetId, profileId, gameName, version }}
 */
export function getFiles(params) {
  var p = params || {};
  var targetId  = p.targetId  || 'obby';
  var profileId = p.profileId || 'development';
  var gameName  = p.gameName  || null;
  var version   = p.version   || '1.0.0';

  var VALID_TARGETS = ['obby', 'tycoon', 'simulator', 'rpg', 'fps'];
  if (!VALID_TARGETS.includes(targetId)) {
    throw new Error(
      'roblox-rbx template: unknown targetId "' + targetId +
      '". Valid: ' + VALID_TARGETS.join(', ')
    );
  }

  // Return a build intent marker — RobloxBuildPhase intercepts this
  return [{
    path: '__roblox_build_intent__.json',
    content: JSON.stringify({
      __robloxBuildIntent: true,
      targetId,
      profileId,
      gameName,
      version,
      templateRoot: path.resolve(__dirname, '../../../'),
    }, null, 2),
  }];
}

export var ROBLOX_RBX_TEMPLATE = {
  meta:     TEMPLATE_META,
  getFiles,
};

export default ROBLOX_RBX_TEMPLATE;