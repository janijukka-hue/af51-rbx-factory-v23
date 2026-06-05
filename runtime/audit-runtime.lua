--!strict
-- AF51-RBX | runtime/audit-runtime.lua
-- Layer  : ReplicatedStorage.Packages.AF51Runtime.AuditRuntime
-- Role   : Append-only tamper-evident audit ledger.
--          First module initialized in RuntimeInit boot sequence.
--          All other runtime modules report through this one.
-- Rojo   : ModuleScript via .lua extension

local RunService = game:GetService("RunService")

local IS_SERVER: boolean = RunService:IsServer()

-- ─── Schema ───────────────────────────────────────────────────────────────

local SCHEMA_VERSION: number = 1

-- ─── Severity Levels ──────────────────────────────────────────────────────

local SEVERITY = {
	DEBUG    = "DEBUG",
	INFO     = "INFO",
	WARN     = "WARN",
	ERROR    = "ERROR",
	CRITICAL = "CRITICAL",
}

-- ─── Simple hash for entry chaining ───────────────────────────────────────
-- FNV1a-32 over a string. Pure Luau, no bit32 multiply needed.

local function _fnv1a32(s: string): string
	local h: number = 0x811c9dc5
	for i = 1, #s do
		h = bit32.bxor(h, string.byte(s, i))
		-- Approximate: h = h * 16777619 mod 2^32
		-- Use repeated addition to avoid overflow
		local lo = bit32.band(h, 0xFFFF)
		local hi = bit32.rshift(h, 16)
		lo = lo * 0x193
		hi = hi * 0x193 + bit32.rshift(lo, 16)
		h = bit32.band(bit32.lshift(hi, 16) + bit32.band(lo, 0xFFFF), 0xFFFFFFFF)
	end
	return string.format("%08x", h)
end

local function _hashEntry(entry: { [string]: any }): string
	-- Stable serialization of key fields
	local parts: { string } = {}
	local keys = { "seq", "action", "severity", "ts", "prevHash" }
	for _, k in ipairs(keys) do
		table.insert(parts, tostring(entry[k] or ""))
	end
	return _fnv1a32(table.concat(parts, "|"))
end

-- ─── Internal State ────────────────────────────────────────────────────────

local _ledger: { { [string]: any } } = {}
local _seq: number     = 0
local _prevHash: string = "0000000000000000"
local _ledgerLimit: number = 5000
local _sealed: boolean = false
local _datastoreFlushCallback: ((entries: { { [string]: any } }) -> ())? = nil
local _flushThreshold: number = 100
local _pendingFlush: number = 0

-- ─── Flush Hook ───────────────────────────────────────────────────────────

local function _maybeFlush(): ()
	if not _datastoreFlushCallback then return end
	_pendingFlush += 1
	if _pendingFlush >= _flushThreshold then
		_pendingFlush = 0
		local toFlush: { { [string]: any } } = {}
		local start = math.max(1, #_ledger - _flushThreshold + 1)
		for i = start, #_ledger do
			table.insert(toFlush, _ledger[i])
		end
		local ok, err = xpcall(function()
			_datastoreFlushCallback(toFlush)
		end, function(e) return debug.traceback(e, 2) end)
		if not ok then
			warn("[AF51-AuditRuntime] DataStore flush failed:", err)
		end
	end
end

-- ─── Core Append ──────────────────────────────────────────────────────────

local function _append(action: string, severity: string, data: { [string]: any }?): string
	if _sealed then
		warn("[AF51-AuditRuntime] Ledger is sealed. Entry rejected:", action)
		return ""
	end

	_seq += 1

	local entry: { [string]: any } = {
		schemaVersion = SCHEMA_VERSION,
		seq           = _seq,
		action        = action,
		severity      = severity,
		ts            = tick(),
		isServer      = IS_SERVER,
		prevHash      = _prevHash,
		data          = data or {},
		hash          = "", -- filled after
	}

	entry.hash = _hashEntry(entry)
	_prevHash  = entry.hash

	-- Cap ledger
	table.insert(_ledger, entry)
	if #_ledger > _ledgerLimit then
		table.remove(_ledger, 1)
	end

	_maybeFlush()

	return entry.hash
end

-- ─── Public API ───────────────────────────────────────────────────────────

local AuditRuntime = {}

AuditRuntime.SEVERITY = SEVERITY

--[[
	Sets a DataStore flush callback.
	Called automatically when _pendingFlush >= _flushThreshold.
	Only valid server-side.
]]
function AuditRuntime.setDataStoreFlushCallback(cb: (entries: { { [string]: any } }) -> ()): ()
	assert(IS_SERVER, "[AF51-AuditRuntime] DataStore flush only valid server-side")
	_datastoreFlushCallback = cb
end

--[[
	Main log function. Used by all runtime modules.
	@param action    string — dot-namespaced identifier, e.g. "EventBus.emit"
	@param severity  string — SEVERITY constant
	@param data      table? — structured payload
	@return hash     string — entry chain hash
]]
function AuditRuntime.log(action: string, severity: string, data: { [string]: any }?): string
	assert(type(action) == "string" and #action > 0, "[AF51-AuditRuntime] action must be non-empty string")
	return _append(action, severity, data)
end

--[[
	Shorthand helpers.
]]
function AuditRuntime.debug(action: string, data: { [string]: any }?): string
	return _append(action, SEVERITY.DEBUG, data)
end

function AuditRuntime.info(action: string, data: { [string]: any }?): string
	return _append(action, SEVERITY.INFO, data)
end

function AuditRuntime.warn(action: string, data: { [string]: any }?): string
	return _append(action, SEVERITY.WARN, data)
end

function AuditRuntime.error(action: string, data: { [string]: any }?): string
	return _append(action, SEVERITY.ERROR, data)
end

function AuditRuntime.critical(action: string, data: { [string]: any }?): string
	return _append(action, SEVERITY.CRITICAL, data)
end

--[[
	Returns the last N entries.
	@param n  number? — default 50
]]
function AuditRuntime.tail(n: number?): { { [string]: any } }
	local count = n or 50
	local result: { { [string]: any } } = {}
	local start = math.max(1, #_ledger - count + 1)
	for i = start, #_ledger do
		table.insert(result, _ledger[i])
	end
	return result
end

--[[
	Returns all entries matching a severity filter.
	@param severity  string — SEVERITY constant
]]
function AuditRuntime.getBySeverity(severity: string): { { [string]: any } }
	local result: { { [string]: any } } = {}
	for _, entry in ipairs(_ledger) do
		if entry.severity == severity then
			table.insert(result, entry)
		end
	end
	return result
end

--[[
	Verifies chain integrity from entry at index [from] to [to].
	Returns { ok: boolean, brokenAt: number? }
]]
function AuditRuntime.verifyChain(from: number?, to: number?): { ok: boolean, brokenAt: number? }
	local start = from or 1
	local finish = to or #_ledger
	local prevHash = "0000000000000000"
	if start > 1 then
		prevHash = _ledger[start - 1] and _ledger[start - 1].hash or "0000000000000000"
	end

	for i = start, math.min(finish, #_ledger) do
		local entry = _ledger[i]
		if entry.prevHash ~= prevHash then
			return { ok = false, brokenAt = i }
		end
		local expectedHash = _hashEntry(entry)
		if entry.hash ~= expectedHash then
			return { ok = false, brokenAt = i }
		end
		prevHash = entry.hash
	end

	return { ok = true, brokenAt = nil }
end

--[[
	Seals the ledger. No further entries can be appended.
	Used during emergency shutdown or vault finalization.
]]
function AuditRuntime.seal(): ()
	_append("AuditRuntime.seal", SEVERITY.CRITICAL, { reason = "ledger_sealed" })
	_sealed = true
end

--[[
	Returns diagnostic stats.
]]
function AuditRuntime.getStats(): { [string]: any }
	return {
		seq          = _seq,
		ledgerSize   = #_ledger,
		ledgerLimit  = _ledgerLimit,
		sealed       = _sealed,
		prevHash     = _prevHash,
		pendingFlush = _pendingFlush,
		isServer     = IS_SERVER,
	}
end

return AuditRuntime
