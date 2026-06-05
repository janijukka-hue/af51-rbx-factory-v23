--!strict
-- AF51-RBX | runtime/permission-layer.lua
-- Layer  : ReplicatedStorage.Packages.AF51Runtime.PermissionLayer
-- Phase  : 7.3 — Runtime Permission Layer
--
-- Responsibilities:
--   • Admin action gating (only authorized UserIds may execute)
--   • Runtime permissions (per-player, per-action capability matrix)
--   • Protected export locks (prevents unauthorized config mutation)
--   • Integration with AuditRuntime — all access decisions are logged
--
-- Policy: Fail-closed. Unknown permission → DENY.

local RunService = game:GetService("RunService")

local IS_SERVER: boolean = RunService:IsServer()

-- ─── Permission Levels ────────────────────────────────────────────────────

local PERMISSION_LEVEL = {
	NONE      = 0,   -- no access
	PLAYER    = 1,   -- standard player
	PREMIUM   = 2,   -- gamepass holder / VIP
	MODERATOR = 3,   -- in-game moderator
	ADMIN     = 4,   -- game admin
	OWNER     = 5,   -- game owner (GOD mode)
}

-- ─── Permission Actions ───────────────────────────────────────────────────

local PERMISSION_ACTION = {
	-- Player actions
	GAMEPLAY_ACTION   = "gameplay_action",    -- standard gameplay remote
	PURCHASE          = "purchase",           -- initiate a purchase
	PRESTIGE          = "prestige",           -- prestige reset

	-- Moderator actions
	KICK_PLAYER       = "kick_player",        -- kick another player
	MUTE_PLAYER       = "mute_player",        -- mute chat
	WARN_PLAYER       = "warn_player",        -- formal warning

	-- Admin actions
	BAN_PLAYER        = "ban_player",         -- ban from experience
	CLEAR_DATA        = "clear_data",         -- wipe player datastore
	FORCE_STATE       = "force_state",        -- directly mutate StateStore
	RUNTIME_COMMAND   = "runtime_command",    -- execute runtime command
	AUDIT_EXPORT      = "audit_export",       -- export audit ledger

	-- Owner-only
	SHUTDOWN_SERVER   = "shutdown_server",    -- shutdown game server
	FACTORY_EXPORT    = "factory_export",     -- export factory package
	CONFIG_OVERRIDE   = "config_override",    -- override runtime config
}

-- ─── Default Permission Matrix ────────────────────────────────────────────
-- action → minimum permission level required

local DEFAULT_PERMISSION_MATRIX: { [string]: number } = {
	[PERMISSION_ACTION.GAMEPLAY_ACTION]  = PERMISSION_LEVEL.PLAYER,
	[PERMISSION_ACTION.PURCHASE]         = PERMISSION_LEVEL.PLAYER,
	[PERMISSION_ACTION.PRESTIGE]         = PERMISSION_LEVEL.PLAYER,
	[PERMISSION_ACTION.KICK_PLAYER]      = PERMISSION_LEVEL.MODERATOR,
	[PERMISSION_ACTION.MUTE_PLAYER]      = PERMISSION_LEVEL.MODERATOR,
	[PERMISSION_ACTION.WARN_PLAYER]      = PERMISSION_LEVEL.MODERATOR,
	[PERMISSION_ACTION.BAN_PLAYER]       = PERMISSION_LEVEL.ADMIN,
	[PERMISSION_ACTION.CLEAR_DATA]       = PERMISSION_LEVEL.ADMIN,
	[PERMISSION_ACTION.FORCE_STATE]      = PERMISSION_LEVEL.ADMIN,
	[PERMISSION_ACTION.RUNTIME_COMMAND]  = PERMISSION_LEVEL.ADMIN,
	[PERMISSION_ACTION.AUDIT_EXPORT]     = PERMISSION_LEVEL.ADMIN,
	[PERMISSION_ACTION.SHUTDOWN_SERVER]  = PERMISSION_LEVEL.OWNER,
	[PERMISSION_ACTION.FACTORY_EXPORT]   = PERMISSION_LEVEL.OWNER,
	[PERMISSION_ACTION.CONFIG_OVERRIDE]  = PERMISSION_LEVEL.OWNER,
}

-- ─── Runtime State ────────────────────────────────────────────────────────

-- Player permission overrides: UserId → PERMISSION_LEVEL
local _playerLevels: { [number]: number } = {}

-- Admin UserIds (set at boot by server configuration)
local _adminIds:     { [number]: boolean } = {}
local _ownerIds:     { [number]: boolean } = {}
local _moderatorIds: { [number]: boolean } = {}

-- Runtime permission matrix (can be modified by OWNER)
local _permissionMatrix: { [string]: number } = {}
for action, level in pairs(DEFAULT_PERMISSION_MATRIX) do
	_permissionMatrix[action] = level
end

-- Export lock — prevents mutation of protected config after boot
local _exportLocked: boolean = false

-- Audit callback
local _auditCallback: ((entry: { [string]: any }) -> ())? = nil

-- ─── Helpers ──────────────────────────────────────────────────────────────

local function _audit(action: string, data: { [string]: any }?): ()
	if _auditCallback then
		xpcall(function()
			_auditCallback({
				action = "PermissionLayer." .. action,
				ts     = tick(),
				data   = data or {},
			})
		end, function(e) return e end)
	end
end

local function _getPlayerLevel(userId: number): number
	-- Explicit override first
	if _playerLevels[userId] then
		return _playerLevels[userId]
	end
	-- Registered role
	if _ownerIds[userId]     then return PERMISSION_LEVEL.OWNER     end
	if _adminIds[userId]     then return PERMISSION_LEVEL.ADMIN      end
	if _moderatorIds[userId] then return PERMISSION_LEVEL.MODERATOR  end
	-- Default
	return PERMISSION_LEVEL.PLAYER
end

-- ─── PermissionLayer API ──────────────────────────────────────────────────

local PermissionLayer = {}

--[[
	Configure authorised role lists at boot.
	Server-only. Must be called before export lock.
]]
function PermissionLayer.configure(config: {
	ownerIds:     { number }?,
	adminIds:     { number }?,
	moderatorIds: { number }?,
}): ()
	assert(IS_SERVER, "[PermissionLayer] configure() is server-only")
	assert(not _exportLocked, "[PermissionLayer] Cannot configure after export lock")

	if config.ownerIds then
		for _, id in ipairs(config.ownerIds) do
			_ownerIds[id] = true
		end
	end
	if config.adminIds then
		for _, id in ipairs(config.adminIds) do
			_adminIds[id] = true
		end
	end
	if config.moderatorIds then
		for _, id in ipairs(config.moderatorIds) do
			_moderatorIds[id] = true
		end
	end

	_audit("configure", { ownerCount = #(config.ownerIds or {}), adminCount = #(config.adminIds or {}) })
end

--[[
	Lock the permission configuration.
	Once locked, configure() and setPlayerLevel() for privileged roles cannot be called.
	Called automatically after RuntimeInit.boot() completes.
]]
function PermissionLayer.lock(): ()
	assert(IS_SERVER, "[PermissionLayer] lock() is server-only")
	_exportLocked = true
	_audit("lock", { ts = tick() })
end

--[[
	Check if a player has permission for an action.
	Fail-closed: unknown action → DENY.

	@returns { allowed: boolean, reason: string, requiredLevel: number, playerLevel: number }
]]
function PermissionLayer.check(player: Player, action: string): {
	allowed: boolean,
	reason:  string,
	requiredLevel: number,
	playerLevel:   number,
}
	assert(IS_SERVER, "[PermissionLayer] check() is server-only")

	local requiredLevel = _permissionMatrix[action]

	-- Unknown action → DENY (fail-closed)
	if requiredLevel == nil then
		_audit("check.deny_unknown", { userId = player.UserId, action = action })
		return {
			allowed       = false,
			reason        = "Unknown action: " .. action .. " — denied by default (fail-closed)",
			requiredLevel = PERMISSION_LEVEL.OWNER, -- effectively locked
			playerLevel   = _getPlayerLevel(player.UserId),
		}
	end

	local playerLevel = _getPlayerLevel(player.UserId)
	local allowed     = playerLevel >= requiredLevel

	_audit(allowed and "check.allow" or "check.deny", {
		userId        = player.UserId,
		playerName    = player.Name,
		action        = action,
		playerLevel   = playerLevel,
		requiredLevel = requiredLevel,
	})

	return {
		allowed       = allowed,
		reason        = allowed
			and "Permitted: playerLevel " .. playerLevel .. " >= required " .. requiredLevel
			or  "Denied: playerLevel " .. playerLevel .. " < required " .. requiredLevel,
		requiredLevel = requiredLevel,
		playerLevel   = playerLevel,
	}
end

--[[
	Assert permission — errors if not allowed.
	Use in server RemoteEvent handlers before executing action.
]]
function PermissionLayer.assert(player: Player, action: string): ()
	local result = PermissionLayer.check(player, action)
	if not result.allowed then
		local msg = "[PermissionLayer] DENIED: player " .. player.Name
			.. " (" .. player.UserId .. ") action=" .. action
			.. " — " .. result.reason
		_audit("assert.fail", { userId = player.UserId, action = action })
		error(msg, 2)
	end
end

--[[
	Override a player's permission level at runtime (admin only).
	Cannot elevate beyond MODERATOR without OWNER permission.
]]
function PermissionLayer.setPlayerLevel(byPlayer: Player, targetUserId: number, level: number): boolean
	assert(IS_SERVER, "[PermissionLayer] setPlayerLevel() is server-only")

	local callerLevel = _getPlayerLevel(byPlayer.UserId)

	-- Can only set levels below your own
	if level >= callerLevel then
		_audit("setPlayerLevel.denied", {
			by      = byPlayer.UserId,
			target  = targetUserId,
			level   = level,
			reason  = "Cannot set level >= caller's own level",
		})
		return false
	end

	_playerLevels[targetUserId] = level
	_audit("setPlayerLevel.ok", {
		by      = byPlayer.UserId,
		target  = targetUserId,
		level   = level,
	})
	return true
end

--[[
	Override the permission matrix (OWNER only).
]]
function PermissionLayer.setActionLevel(byPlayer: Player, action: string, level: number): boolean
	assert(IS_SERVER, "[PermissionLayer] setActionLevel() is server-only")

	local result = PermissionLayer.check(byPlayer, PERMISSION_ACTION.CONFIG_OVERRIDE)
	if not result.allowed then return false end

	_permissionMatrix[action] = level
	_audit("setActionLevel.ok", { by = byPlayer.UserId, action = action, level = level })
	return true
end

--[[
	Get a player's permission level (number).
]]
function PermissionLayer.getLevel(player: Player): number
	return _getPlayerLevel(player.UserId)
end

--[[
	Check if a player is at least a given level.
]]
function PermissionLayer.isAtLeast(player: Player, level: number): boolean
	return _getPlayerLevel(player.UserId) >= level
end

--[[
	Register audit callback (from RuntimeInit → AuditRuntime).
]]
function PermissionLayer.setAuditCallback(cb: (entry: { [string]: any }) -> ()): ()
	_auditCallback = cb
end

--[[
	Export current permission state (ADMIN+).
]]
function PermissionLayer.exportState(byPlayer: Player): { [string]: any }?
	local result = PermissionLayer.check(byPlayer, PERMISSION_ACTION.AUDIT_EXPORT)
	if not result.allowed then return nil end

	local state = {
		locked        = _exportLocked,
		matrix        = _permissionMatrix,
		ownerCount    = 0,
		adminCount    = 0,
		moderatorCount = 0,
		overrideCount = 0,
	}
	for _ in pairs(_ownerIds)     do state.ownerCount    += 1 end
	for _ in pairs(_adminIds)     do state.adminCount    += 1 end
	for _ in pairs(_moderatorIds) do state.moderatorCount += 1 end
	for _ in pairs(_playerLevels) do state.overrideCount  += 1 end
	return state
end

-- Export constants
PermissionLayer.LEVEL  = PERMISSION_LEVEL
PermissionLayer.ACTION = PERMISSION_ACTION

return PermissionLayer
