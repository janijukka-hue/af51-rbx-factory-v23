function _af51DeterministicNow() {
  const o = (typeof process !== "undefined" && process.env && process.env.AF51_BUILD_EPOCH) || "";
  const ms = o ? Number(o) : 315532800000;
  return new Date(ms).toISOString();
}

/**
 * AF51-RBX — RemoteBuilder
 * t3-rbx/remote-builder.js
 *
 * Generates the canonical ReplicatedStorage/Remotes/ topology:
 *   - RemoteEvent declarations (Luau)
 *   - RemoteFunction declarations (Luau)
 *   - Network contract manifest (JSON)
 *   - Anti-exploit validation gate (Luau)
 *
 * Layer:       T3-RBX / Factory Core
 * Output:      build/src/ReplicatedStorage/Remotes/
 * Governance:  All remotes routed through NetworkLayer runtime.
 *              Direct RemoteEvent.new() FORBIDDEN.
 *
 * Deterministic: same target → same output, byte for byte.
 */

import path from 'node:path';
import * as fs from 'node:fs';

// ── Remote topology definitions ───────────────────────────────────────────

/**
 * Core remotes always injected regardless of target type.
 * These are the AF51 governance bus remotes.
 */
const CORE_REMOTE_EVENTS = [
  { name: 'PlayerReady',       direction: 'server', description: 'Client signals boot complete' },
  { name: 'StateSync',         direction: 'client', description: 'Server pushes state delta to client' },
  { name: 'ActionRequest',     direction: 'server', description: 'Client requests a gameplay action' },
  { name: 'ActionResult',      direction: 'client', description: 'Server broadcasts action result' },
  { name: 'NotificationPush',  direction: 'client', description: 'Server pushes UI notification' },
  { name: 'AuditEvent',        direction: 'server', description: 'Client sends audit ping (rate-limited)' },
  { name: 'SessionHeartbeat',  direction: 'server', description: 'Client keepalive' },
  { name: 'UIToggle',          direction: 'client', description: 'Server drives UI visibility' },
];

const CORE_REMOTE_FUNCTIONS = [
  { name: 'GetPlayerData',     direction: 'server', description: 'Client fetches own player data' },
  { name: 'GetGameConfig',     direction: 'server', description: 'Client fetches game config snapshot' },
  { name: 'ValidateAction',    direction: 'server', description: 'Client validates action before commit' },
];

/**
 * Per-target-type additional remotes.
 */
const TARGET_REMOTE_EVENTS = {
  obby: [
    { name: 'CheckpointReached', direction: 'server', description: 'Player touched checkpoint' },
    { name: 'StageComplete',     direction: 'client', description: 'Server confirms stage done' },
    { name: 'ObbyReset',         direction: 'client', description: 'Server resets player position' },
  ],
  tycoon: [
    { name: 'PurchaseRequest',   direction: 'server', description: 'Player requests purchase' },
    { name: 'PurchaseResult',    direction: 'client', description: 'Server sends purchase outcome' },
    { name: 'TycoonUpdate',      direction: 'client', description: 'Server pushes tycoon state diff' },
    { name: 'DropperTick',       direction: 'client', description: 'Dropper tick broadcast' },
  ],
  simulator: [
    { name: 'ClickAction',       direction: 'server', description: 'Player click event' },
    { name: 'ResourceUpdate',    direction: 'client', description: 'Server pushes resource count' },
    { name: 'PrestigeRequest',   direction: 'server', description: 'Player requests prestige' },
    { name: 'PrestigeResult',    direction: 'client', description: 'Server sends prestige outcome' },
  ],
  rpg: [
    { name: 'CombatAction',      direction: 'server', description: 'Player combat input' },
    { name: 'CombatResult',      direction: 'client', description: 'Server sends combat resolution' },
    { name: 'QuestUpdate',       direction: 'client', description: 'Server pushes quest state' },
    { name: 'DialogueOpen',      direction: 'client', description: 'Server opens NPC dialogue' },
    { name: 'DialogueChoice',    direction: 'server', description: 'Player selects dialogue option' },
  ],
  fps: [
    { name: 'ShootAction',       direction: 'server', description: 'Player fire input' },
    { name: 'HitValidation',     direction: 'server', description: 'Client-side hit claim' },
    { name: 'HitResult',         direction: 'client', description: 'Server authoritative hit result' },
    { name: 'KillFeed',          direction: 'client', description: 'Kill feed broadcast' },
    { name: 'RespawnReady',      direction: 'client', description: 'Server signals respawn allowed' },
  ],
};

const TARGET_REMOTE_FUNCTIONS = {
  obby:      [{ name: 'GetCheckpoints', direction: 'server', description: 'Client fetches checkpoint list' }],
  tycoon:    [{ name: 'GetShopItems',   direction: 'server', description: 'Client fetches shop catalog' }],
  simulator: [{ name: 'GetUpgrades',    direction: 'server', description: 'Client fetches upgrade tree' }],
  rpg:       [{ name: 'GetQuestLog',    direction: 'server', description: 'Client fetches quest log' }],
  fps:       [{ name: 'GetLoadout',     direction: 'server', description: 'Client fetches player loadout' }],
};

// ── FNV1a-32 ──────────────────────────────────────────────────────────────

function _fnv1a32(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Luau template helpers ─────────────────────────────────────────────────

function _luauHeader(description) {
  return [
    '--!strict',
    `-- ${description}`,
    '-- AF51-RBX | Generated by RemoteBuilder — DO NOT EDIT',
    '-- All remotes routed through NetworkLayer. Direct .new() FORBIDDEN.',
    '',
  ].join('\n');
}

function _generateRemoteEventScript(remotes, targetType) {
  const lines = [
    _luauHeader(`RemoteEvents — ${targetType} topology`),
    'local NetworkLayer = require(game.ReplicatedStorage.Packages.AF51Runtime.NetworkLayer)',
    '',
    '-- Declare all RemoteEvents through NetworkLayer governance',
    `local REMOTE_EVENTS: { [string]: RemoteEvent } = {}`,
    '',
    'local function declareAll()',
  ];

  for (const r of remotes) {
    // Map generator direction → NetworkLayer direction:
    //   'server' = client→server = C2S,  'client' = server→client = S2C
    const dir = r.direction === 'server' ? 'C2S' : (r.direction === 'client' ? 'S2C' : 'Bidirectional');
    lines.push(
      `\t-- ${r.description}`,
      `\tREMOTE_EVENTS["${r.name}"] = NetworkLayer.declareRemote("${r.name}", "Event", "${dir}") :: RemoteEvent`,
    );
  }

  lines.push(
    'end',
    '',
    'declareAll()',
    '',
    'return REMOTE_EVENTS',
  );

  return lines.join('\n');
}

function _generateRemoteFunctionScript(remotes, targetType) {
  const lines = [
    _luauHeader(`RemoteFunctions — ${targetType} topology`),
    'local NetworkLayer = require(game.ReplicatedStorage.Packages.AF51Runtime.NetworkLayer)',
    '',
    '-- Declare all RemoteFunctions through NetworkLayer governance',
    `local REMOTE_FUNCTIONS: { [string]: RemoteFunction } = {}`,
    '',
    'local function declareAll()',
  ];

  for (const r of remotes) {
    // RemoteFunctions are request/response — always Bidirectional in practice,
    // but honor explicit direction when the generator specifies one.
    const dir = r.direction === 'server' ? 'C2S' : (r.direction === 'client' ? 'S2C' : 'Bidirectional');
    lines.push(
      `\t-- ${r.description}`,
      `\tREMOTE_FUNCTIONS["${r.name}"] = NetworkLayer.declareRemote("${r.name}", "Function", "${dir}") :: RemoteFunction`,
    );
  }

  lines.push(
    'end',
    '',
    'declareAll()',
    '',
    'return REMOTE_FUNCTIONS',
  );

  return lines.join('\n');
}

function _generateValidationGate(events, functions, targetType) {
  const allNames = [...events.map(r => r.name), ...functions.map(r => r.name)].sort();

  const validatorLines = [];
  for (const name of allNames) {
    let body;
    if (['PlayerReady','SessionHeartbeat'].includes(name)) {
      body = '\t\treturn true';
    } else if (name === 'AuditEvent') {
      body = '\t\tif type(payload)~="table" then return false,"not_table" end\n\t\tlocal ev=payload.event\n\t\tif type(ev)~="string" or #ev==0 or #ev>128 then return false,"bad_event" end\n\t\treturn true';
    } else if (name === 'PurchaseRequest') {
      body = '\t\tif type(payload)~="table" then return false,"not_table" end\n\t\tlocal ok={upgrade=true,shop=true}\n\t\tif not ok[payload.action] then return false,"bad_action: "..tostring(payload.action) end\n\t\treturn true';
    } else if (name === 'ActionRequest') {
      body = '\t\tif type(payload)~="table" then return false,"not_table" end\n\t\tif type(payload.action)~="string" or #payload.action>64 then return false,"bad_action" end\n\t\treturn true';
    } else {
      body = '\t\tif payload~=nil and type(payload)~="table" then return false,"not_table" end\n\t\treturn true';
    }
    validatorLines.push(`NetworkLayer.setValidator("${name}", function(player: Player, payload: any)\n${body}\nend)\n`);
  }

  return [
    `--!strict`,
    `-- AF51-RBX | ValidationGate — ${targetType} — ${allNames.length} remotes`,
    `local af51 = game.ReplicatedStorage:WaitForChild("Packages",15):WaitForChild("AF51Runtime",15)`,
    `local NetworkLayer = require(af51:WaitForChild("NetworkLayer",15))`,
    `local AuditRuntime = require(af51:WaitForChild("AuditRuntime",15))`,
    ``,
    `local function reject(player: Player, remote: string, reason: string): (boolean, string)`,
    `\tAuditRuntime.warn("[VG] BLOCKED "..remote, { player=player.Name, reason=reason })`,
    `\treturn false, reason`,
    `end`,
    `local _r = reject`,
    ``,
    ...validatorLines,
    `AuditRuntime.info("[ValidationGate] OK", { target="${targetType}", count=${allNames.length} })`,
    `return { ALLOWED_COUNT=${allNames.length} }`,
  ].join('\n');
}

// ── RemoteBuilder ─────────────────────────────────────────────────────────

class RemoteBuilder {

  /**
   * Build the full Remotes topology for a target.
   *
   * @param {object} opts
   * @param {string} opts.buildRoot       - path to assembled build dir
   * @param {object} opts.target          - resolved target descriptor
   * @param {object} [opts.auditLedger]
   * @returns {{ ok: boolean, manifest: object|null, errors: string[] }}
   */
  static build({ buildRoot, target, auditLedger }) {
    const errors    = [];
    const targetType = (target.type || 'obby').toLowerCase();

    const _audit = (level, msg, meta = {}) => {
      if (auditLedger && typeof auditLedger[level] === 'function') {
        auditLedger[level](`[RemoteBuilder] ${msg}`, {
          source: 'RemoteBuilder.build',
          targetId: target.id,
          ...meta,
        });
      }
    };

    _audit('info', `Building remote topology for type='${targetType}'`);

    // ── Resolve remote sets ─────────────────────────────────────────────
    const extraEvents    = TARGET_REMOTE_EVENTS[targetType]    || [];
    const extraFunctions = TARGET_REMOTE_FUNCTIONS[targetType] || [];

    const allEvents    = [...CORE_REMOTE_EVENTS,    ...extraEvents];
    const allFunctions = [...CORE_REMOTE_FUNCTIONS, ...extraFunctions];

    // ── Output dir ──────────────────────────────────────────────────────
    const remotesDir = path.join(buildRoot, 'src', 'ReplicatedStorage', 'Remotes');
    try {
      fs.mkdirSync(remotesDir, { recursive: true });
    } catch (e) {
      errors.push(`Cannot create Remotes dir: ${e.message}`);
      return { ok: false, manifest: null, errors };
    }

    // ── Generate RemoteEvents.lua ───────────────────────────────────────
    const eventsScript = _generateRemoteEventScript(allEvents, targetType);
    try {
      fs.writeFileSync(path.join(remotesDir, 'RemoteEvents.lua'), eventsScript, 'utf8');
    } catch (e) {
      errors.push(`RemoteEvents.lua write failed: ${e.message}`);
    }

    // ── Generate RemoteFunctions.lua ────────────────────────────────────
    const functionsScript = _generateRemoteFunctionScript(allFunctions, targetType);
    try {
      fs.writeFileSync(path.join(remotesDir, 'RemoteFunctions.lua'), functionsScript, 'utf8');
    } catch (e) {
      errors.push(`RemoteFunctions.lua write failed: ${e.message}`);
    }

    // ── Generate ValidationGate.lua ─────────────────────────────────────
    const gateScript = _generateValidationGate(allEvents, allFunctions, targetType);
    try {
      fs.writeFileSync(path.join(remotesDir, 'ValidationGate.lua'), gateScript, 'utf8');
    } catch (e) {
      errors.push(`ValidationGate.lua write failed: ${e.message}`);
    }

    // ── Generate network-contract.json ──────────────────────────────────
    const contract = {
      schemaVersion: '1.0.0',
      targetId:      target.id,
      targetType,
      generatedAt:   _af51DeterministicNow(),
      contractHash:  _fnv1a32(
        `${target.id}:${allEvents.map(e => e.name).join(',')}:${allFunctions.map(f => f.name).join(',')}`
      ),
      remoteEvents:    allEvents,
      remoteFunctions: allFunctions,
      totalRemotes:    allEvents.length + allFunctions.length,
    };

    try {
      fs.writeFileSync(
        path.join(remotesDir, 'network-contract.json'),
        JSON.stringify(contract, null, 2),
        'utf8'
      );
    } catch (e) {
      errors.push(`network-contract.json write failed: ${e.message}`);
    }

    if (errors.length > 0) {
      return { ok: false, manifest: null, errors };
    }

    _audit('info', `Remote topology complete: ${allEvents.length} events, ${allFunctions.length} functions`, {
      totalRemotes: contract.totalRemotes,
      contractHash: contract.contractHash,
    });

    return { ok: true, manifest: contract, errors: [] };
  }

  /**
   * Return the canonical remote topology for a target type.
   * Used by PackageValidator to verify remote contracts.
   *
   * @param {string} targetType
   * @returns {{ events: object[], functions: object[] }}
   */
  static getTopology(targetType) {
    const t = (targetType || 'obby').toLowerCase();
    return {
      events:    [...CORE_REMOTE_EVENTS,    ...(TARGET_REMOTE_EVENTS[t]    || [])],
      functions: [...CORE_REMOTE_FUNCTIONS, ...(TARGET_REMOTE_FUNCTIONS[t] || [])],
    };
  }
}

// ── Exports ───────────────────────────────────────────────────────────────

export {

  RemoteBuilder,
  CORE_REMOTE_EVENTS,
  CORE_REMOTE_FUNCTIONS,
  TARGET_REMOTE_EVENTS,
  TARGET_REMOTE_FUNCTIONS,

};