--!strict
-- AF51-RBX | runtime/runtime-init.lua
-- Layer  : ServerScriptService (server) / StarterPlayerScripts (client)
-- Role   : Orchestrated boot sequence for the AF51-RBX runtime.
--          Boot order is deterministic and fail-closed.
--          Server: AuditRuntime → EventBus → StateStore → ServiceRegistry → NetworkLayer
--          Client: AuditRuntime → EventBus → StateStore → NetworkLayer (resolve remotes)
-- Rojo   : This is a ModuleScript. The actual ServerScript/LocalScript require() it.

local RunService        = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local IS_SERVER: boolean = RunService:IsServer()

-- ─── Boot Phase Tracking ──────────────────────────────────────────────────

local BOOT_PHASE = {
	IDLE          = "IDLE",
	AUDIT_INIT    = "AUDIT_INIT",
	EVENTBUS_INIT = "EVENTBUS_INIT",
	STATE_INIT    = "STATE_INIT",
	SERVICES_INIT = "SERVICES_INIT",
	NETWORK_INIT  = "NETWORK_INIT",
	COMPLETE      = "COMPLETE",
	FAILED        = "FAILED",
}

local _bootPhase: string = BOOT_PHASE.IDLE
local _bootLog: { { phase: string, ts: number, ok: boolean, error: string? } } = {}
local _bootStartTs: number = 0

local function _logBoot(phase: string, ok: boolean, err: string?): ()
	table.insert(_bootLog, { phase = phase, ts = tick(), ok = ok, error = err })
end

-- ─── Package Resolution ───────────────────────────────────────────────────
-- Waits for AF51Runtime package folder with timeout.

local function _getRuntime(timeout: number?): Folder
	local t = timeout or 15
	local pkg = ReplicatedStorage:WaitForChild("Packages", t)
	assert(pkg, "[AF51-RuntimeInit] ReplicatedStorage.Packages not found within " .. t .. "s")
	local af51 = (pkg :: Folder):WaitForChild("AF51Runtime", t)
	assert(af51, "[AF51-RuntimeInit] AF51Runtime package not found within " .. t .. "s")
	return af51 :: Folder
end

-- ─── Boot Sequence ────────────────────────────────────────────────────────

local RuntimeInit = {}

--[[
	Boots the AF51-RBX runtime.
	Server: declares remotes, registers services, starts all.
	Client: resolves remotes, connects client handlers.

	@param config  table? — {
	  timeout: number?,               -- WaitForChild timeout (default 15s)
	  services: {string: table}?,     -- name → module table for ServiceRegistry
	  remotes: { {                    -- remote declarations
	    name: string,
	    remoteType: string,
	    direction: string,
	    options: table?,
	  } }?,
	  onBootComplete: (() -> ())?,    -- called after successful boot
	  onBootFailed:  ((err: string) -> ())?,
	}
]]
function RuntimeInit.boot(config: {
	timeout        : number?,
	services       : { [string]: { [string]: any } }?,
	remotes        : { { name: string, remoteType: string, direction: string, options: { [string]: any }? } }?,
	onBootComplete : (() -> ())?,
	onBootFailed   : ((err: string) -> ())?,
}?): ()
	local cfg = config or {}
	_bootStartTs = tick()
	_bootPhase   = BOOT_PHASE.AUDIT_INIT

	local af51Runtime: Folder

	-- ── Phase 1: Resolve package ────────────────────────────────────────
	local resolveOk, resolveErr = xpcall(function()
		af51Runtime = _getRuntime(cfg.timeout)
	end, function(e) return debug.traceback(e, 2) end)

	if not resolveOk then
		_bootPhase = BOOT_PHASE.FAILED
		_logBoot("RESOLVE_PACKAGE", false, tostring(resolveErr))
		local msg = "[AF51-RuntimeInit] Package resolution failed: " .. tostring(resolveErr)
		if cfg.onBootFailed then cfg.onBootFailed(msg) end
		error(msg)
	end
	_logBoot("RESOLVE_PACKAGE", true)

	-- ── Phase 2: AuditRuntime ───────────────────────────────────────────
	local AuditRuntime: { [string]: any }
	local auditOk, auditErr = xpcall(function()
		AuditRuntime = require(af51Runtime:WaitForChild("AuditRuntime", cfg.timeout or 15))
		AuditRuntime.info("RuntimeInit.boot", {
			isServer = IS_SERVER,
			phase    = "audit_init",
			ts       = tick(),
		})
	end, function(e) return debug.traceback(e, 2) end)

	if not auditOk then
		_bootPhase = BOOT_PHASE.FAILED
		_logBoot(BOOT_PHASE.AUDIT_INIT, false, tostring(auditErr))
		local msg = "[AF51-RuntimeInit] AuditRuntime init failed: " .. tostring(auditErr)
		if cfg.onBootFailed then cfg.onBootFailed(msg) end
		error(msg)
	end
	_logBoot(BOOT_PHASE.AUDIT_INIT, true)
	_bootPhase = BOOT_PHASE.EVENTBUS_INIT

	-- ── Phase 3: EventBus ───────────────────────────────────────────────
	local EventBus: { [string]: any }
	local ebOk, ebErr = xpcall(function()
		EventBus = require(af51Runtime:WaitForChild("EventBus", cfg.timeout or 15))
		EventBus.setAuditCallback(function(entry: { [string]: any })
			AuditRuntime.log(entry.action or "EventBus.unknown", AuditRuntime.SEVERITY.DEBUG, entry)
		end)
		AuditRuntime.info("RuntimeInit.boot", { phase = "eventbus_ready" })
	end, function(e) return debug.traceback(e, 2) end)

	if not ebOk then
		_bootPhase = BOOT_PHASE.FAILED
		_logBoot(BOOT_PHASE.EVENTBUS_INIT, false, tostring(ebErr))
		local msg = "[AF51-RuntimeInit] EventBus init failed: " .. tostring(ebErr)
		if cfg.onBootFailed then cfg.onBootFailed(msg) end
		error(msg)
	end
	_logBoot(BOOT_PHASE.EVENTBUS_INIT, true)
	_bootPhase = BOOT_PHASE.STATE_INIT

	-- ── Phase 4: StateStore ─────────────────────────────────────────────
	local StateStore: { [string]: any }
	local ssOk, ssErr = xpcall(function()
		StateStore = require(af51Runtime:WaitForChild("StateStore", cfg.timeout or 15))
		StateStore.setAuditCallback(function(entry: { [string]: any })
			AuditRuntime.log(entry.action or "StateStore.unknown", AuditRuntime.SEVERITY.DEBUG, entry)
		end)
		EventBus.emit("runtime:stateStore:ready", nil, "RuntimeInit")
		AuditRuntime.info("RuntimeInit.boot", { phase = "statestore_ready" })
	end, function(e) return debug.traceback(e, 2) end)

	if not ssOk then
		_bootPhase = BOOT_PHASE.FAILED
		_logBoot(BOOT_PHASE.STATE_INIT, false, tostring(ssErr))
		local msg = "[AF51-RuntimeInit] StateStore init failed: " .. tostring(ssErr)
		if cfg.onBootFailed then cfg.onBootFailed(msg) end
		error(msg)
	end
	_logBoot(BOOT_PHASE.STATE_INIT, true)
	_bootPhase = BOOT_PHASE.NETWORK_INIT

	-- ── Phase 5: NetworkLayer ───────────────────────────────────────────
	local NetworkLayer: { [string]: any }
	local nlOk, nlErr = xpcall(function()
		NetworkLayer = require(af51Runtime:WaitForChild("NetworkLayer", cfg.timeout or 15))
		NetworkLayer.setAuditCallback(function(entry: { [string]: any })
			AuditRuntime.log(entry.action or "NetworkLayer.unknown", AuditRuntime.SEVERITY.INFO, entry)
		end)
		NetworkLayer.setEventBusEmit(function(eventType: string, payload: any, source: string)
			EventBus.emit(eventType, payload, source)
		end)

		-- Declare remotes
		if IS_SERVER and cfg.remotes then
			for _, remote in ipairs(cfg.remotes) do
				NetworkLayer.declareRemote(remote.name, remote.remoteType, remote.direction, remote.options)
			end
		end

		-- Client: resolve all declared remotes
		if not IS_SERVER and cfg.remotes then
			for _, remote in ipairs(cfg.remotes) do
				NetworkLayer.declareRemote(remote.name, remote.remoteType, remote.direction, remote.options)
				NetworkLayer.resolveRemote(remote.name, cfg.timeout)
			end
		end

		AuditRuntime.info("RuntimeInit.boot", { phase = "network_ready", isServer = IS_SERVER })
	end, function(e) return debug.traceback(e, 2) end)

	if not nlOk then
		_bootPhase = BOOT_PHASE.FAILED
		_logBoot(BOOT_PHASE.NETWORK_INIT, false, tostring(nlErr))
		local msg = "[AF51-RuntimeInit] NetworkLayer init failed: " .. tostring(nlErr)
		if cfg.onBootFailed then cfg.onBootFailed(msg) end
		error(msg)
	end
	_logBoot(BOOT_PHASE.NETWORK_INIT, true)

	-- ── Phase 6 (Server only): ServiceRegistry ──────────────────────────
	local ServiceRegistry: { [string]: any }? = nil

	if IS_SERVER then
		_bootPhase = BOOT_PHASE.SERVICES_INIT

		local srOk, srErr = xpcall(function()
			ServiceRegistry = require(af51Runtime:WaitForChild("ServiceRegistry", cfg.timeout or 15))
			ServiceRegistry.setAuditCallback(function(entry: { [string]: any })
				AuditRuntime.log(entry.action or "ServiceRegistry.unknown", AuditRuntime.SEVERITY.INFO, entry)
			end)

			-- Register caller-provided services
			if cfg.services then
				for serviceName, serviceModule in pairs(cfg.services) do
					local deps = serviceModule._dependencies or {}
					ServiceRegistry.register(serviceName, serviceModule, deps)
				end
			end

			ServiceRegistry.init()
			ServiceRegistry.startAll()

			EventBus.emit("runtime:services:ready", nil, "RuntimeInit")
			AuditRuntime.info("RuntimeInit.boot", { phase = "services_ready" })
		end, function(e) return debug.traceback(e, 2) end)

		if not srOk then
			_bootPhase = BOOT_PHASE.FAILED
			_logBoot(BOOT_PHASE.SERVICES_INIT, false, tostring(srErr))
			local msg = "[AF51-RuntimeInit] ServiceRegistry init failed: " .. tostring(srErr)
			if cfg.onBootFailed then cfg.onBootFailed(msg) end
			error(msg)
		end
		_logBoot(BOOT_PHASE.SERVICES_INIT, true)
	end

	-- ── Complete ────────────────────────────────────────────────────────
	_bootPhase = BOOT_PHASE.COMPLETE
	local bootDuration = tick() - _bootStartTs

	AuditRuntime.info("RuntimeInit.boot", {
		phase       = "complete",
		isServer    = IS_SERVER,
		durationMs  = math.floor(bootDuration * 1000),
	})

	EventBus.emit("runtime:boot:complete", {
		isServer   = IS_SERVER,
		durationMs = math.floor(bootDuration * 1000),
	}, "RuntimeInit")

	if cfg.onBootComplete then
		xpcall(function()
			cfg.onBootComplete()
		end, function(e)
			warn("[AF51-RuntimeInit] onBootComplete callback error:", debug.traceback(e, 2))
		end)
	end
end

--[[
	Returns the boot phase and log.
]]
function RuntimeInit.getBootStatus(): { [string]: any }
	return {
		phase    = _bootPhase,
		log      = _bootLog,
		duration = _bootPhase == BOOT_PHASE.COMPLETE and (tick() - _bootStartTs) or nil,
	}
end

RuntimeInit.BOOT_PHASE = BOOT_PHASE

return RuntimeInit
