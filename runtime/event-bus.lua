--!strict
-- AF51-RBX | runtime/event-bus.lua
-- Layer  : ReplicatedStorage.Packages.AF51Runtime.EventBus
-- Role   : Centralized runtime communication bus.
--          ALL script-to-script communication flows through this module.
--          No direct BindableEvent/BindableFunction usage outside this file.
-- Rules  : fail-closed, xpcall-protected, audit-integrated, server/client-aware
-- Rojo   : maps as ModuleScript via .lua extension

local RunService = game:GetService("RunService")

local IS_SERVER: boolean = RunService:IsServer()

-- ─── Priority Constants ────────────────────────────────────────────────────

local PRIORITY = {
	CRITICAL = 0,
	HIGH     = 1,
	NORMAL   = 2,
	LOW      = 3,
}

-- ─── Internal State ────────────────────────────────────────────────────────

local _sequence: number  = 0
local _eventCount: number = 0
local _subscribers: { [string]: { { id: string, priority: number, callback: (...any) -> () } } } = {}
local _wildcardSubscribers: { { id: string, priority: number, callback: (...any) -> () } } = {}
local _history: { { id: string, type: string, payload: any, timestamp: number, sequence: number, source: string } } = {}
local _historyLimit: number = 1000
local _auditCallback: ((entry: { [string]: any }) -> ())? = nil
local _initialized: boolean = false

-- ─── ID Generation ────────────────────────────────────────────────────────
-- Deterministic: timestamp * 10^6 + sequence, formatted as hex string.

local function _generateEventId(eventType: string): string
	_sequence += 1
	local ts = math.floor(tick() * 1000000)
	local safe = eventType:sub(1, 12):gsub("[^%w%-_]", "_")
	return string.format("evt_%s_%d_%06d", safe, ts, _sequence)
end

-- ─── Audit Hook ───────────────────────────────────────────────────────────

local function _audit(entry: { [string]: any }): ()
	if _auditCallback then
		local ok, err = xpcall(function()
			_auditCallback(entry)
		end, function(e) return e end)
		if not ok then
			warn("[AF51-EventBus] audit callback failed:", err)
		end
	end
end

-- ─── Subscriber Sort (by priority ascending = lower number = higher priority)

local function _sortSubscribers(subs: { { id: string, priority: number, callback: (...any) -> () } }): ()
	table.sort(subs, function(a, b)
		return a.priority < b.priority
	end)
end

-- ─── Core API ─────────────────────────────────────────────────────────────

local EventBus = {}

--[[
	Registers the audit runtime callback.
	Must be called by RuntimeInit before any events are emitted.
	@param cb  function(entry: table) — receives structured audit entries
]]
function EventBus.setAuditCallback(cb: (entry: { [string]: any }) -> ()): ()
	_auditCallback = cb
end

--[[
	Subscribes to a specific event type.
	@param eventType  string — exact event type string, or "*" for wildcard
	@param callback   function(...) — handler function
	@param priority   number? — PRIORITY constant (default NORMAL)
	@return token     string — unsubscribe token
]]
function EventBus.on(eventType: string, callback: (...any) -> (), priority: number?): string
	assert(type(eventType) == "string" and #eventType > 0, "[AF51-EventBus] eventType must be a non-empty string")
	assert(type(callback) == "function", "[AF51-EventBus] callback must be a function")

	local p = priority or PRIORITY.NORMAL
	local token = _generateEventId("sub_" .. eventType)

	local entry = { id = token, priority = p, callback = callback }

	if eventType == "*" then
		table.insert(_wildcardSubscribers, entry)
		_sortSubscribers(_wildcardSubscribers)
	else
		if not _subscribers[eventType] then
			_subscribers[eventType] = {}
		end
		table.insert(_subscribers[eventType], entry)
		_sortSubscribers(_subscribers[eventType])
	end

	_audit({
		action    = "EventBus.on",
		eventType = eventType,
		token     = token,
		priority  = p,
		isServer  = IS_SERVER,
		ts        = tick(),
	})

	return token
end

--[[
	Subscribes to an event type once. Auto-unsubscribes after first dispatch.
	@param eventType  string
	@param callback   function(...)
	@param priority   number?
	@return token     string
]]
function EventBus.once(eventType: string, callback: (...any) -> (), priority: number?): string
	local token: string = ""
	local function wrapper(...: any): ()
		EventBus.off(token)
		callback(...)
	end
	token = EventBus.on(eventType, wrapper, priority)
	return token
end

--[[
	Unsubscribes a listener by token.
	@param token  string — token returned by on() or once()
	@return removed  boolean
]]
function EventBus.off(token: string): boolean
	assert(type(token) == "string" and #token > 0, "[AF51-EventBus] token must be a non-empty string")

	-- Check wildcard subscribers
	for i, sub in ipairs(_wildcardSubscribers) do
		if sub.id == token then
			table.remove(_wildcardSubscribers, i)
			_audit({ action = "EventBus.off", token = token, scope = "wildcard", ts = tick() })
			return true
		end
	end

	-- Check typed subscribers
	for eventType, subs in pairs(_subscribers) do
		for i, sub in ipairs(subs) do
			if sub.id == token then
				table.remove(subs, i)
				_audit({ action = "EventBus.off", token = token, scope = eventType, ts = tick() })
				return true
			end
		end
	end

	warn("[AF51-EventBus] off(): token not found:", token)
	return false
end

--[[
	Emits an event to all matching subscribers.
	Execution is xpcall-protected per handler.
	History is capped at _historyLimit.

	@param eventType  string
	@param payload    any?
	@param source     string? — caller identifier for audit trail
	@return eventId   string
]]
function EventBus.emit(eventType: string, payload: any?, source: string?): string
	assert(type(eventType) == "string" and #eventType > 0, "[AF51-EventBus] eventType must be a non-empty string")

	_sequence += 1
	_eventCount += 1
	local eventId = _generateEventId(eventType)
	local ts = tick()
	local src = source or (IS_SERVER and "server" or "client")

	local record = {
		id       = eventId,
		type     = eventType,
		payload  = payload,
		timestamp = ts,
		sequence = _sequence,
		source   = src,
	}

	-- Append to history with cap
	table.insert(_history, record)
	if #_history > _historyLimit then
		table.remove(_history, 1)
	end

	-- Dispatch to typed subscribers
	local typed = _subscribers[eventType]
	if typed then
		for _, sub in ipairs(typed) do
			local ok, err = xpcall(function()
				sub.callback(payload, record)
			end, function(e)
				return debug.traceback(e, 2)
			end)
			if not ok then
				warn(string.format("[AF51-EventBus] handler error [%s] token=%s: %s", eventType, sub.id, tostring(err)))
				_audit({
					action    = "EventBus.emit.handlerError",
					eventId   = eventId,
					eventType = eventType,
					token     = sub.id,
					error     = tostring(err),
					ts        = ts,
				})
			end
		end
	end

	-- Dispatch to wildcard subscribers
	for _, sub in ipairs(_wildcardSubscribers) do
		local ok, err = xpcall(function()
			sub.callback(payload, record)
		end, function(e)
			return debug.traceback(e, 2)
		end)
		if not ok then
			warn(string.format("[AF51-EventBus] wildcard handler error [%s] token=%s: %s", eventType, sub.id, tostring(err)))
			_audit({
				action    = "EventBus.emit.wildcardHandlerError",
				eventId   = eventId,
				eventType = eventType,
				token     = sub.id,
				error     = tostring(err),
				ts        = ts,
			})
		end
	end

	_audit({
		action       = "EventBus.emit",
		eventId      = eventId,
		eventType    = eventType,
		source       = src,
		subscriberCount = (typed and #typed or 0) + #_wildcardSubscribers,
		ts           = ts,
	})

	return eventId
end

--[[
	Returns a snapshot of the event history.
	@param limit  number? — max entries to return (default: all)
	@return entries  table
]]
function EventBus.getHistory(limit: number?): { { [string]: any } }
	if limit then
		local start = math.max(1, #_history - limit + 1)
		local result = {}
		for i = start, #_history do
			table.insert(result, _history[i])
		end
		return result
	end
	-- Shallow copy
	local copy = {}
	for i, v in ipairs(_history) do
		copy[i] = v
	end
	return copy
end

--[[
	Returns diagnostic statistics.
]]
function EventBus.getStats(): { [string]: any }
	local typedCount = 0
	local typeList = {}
	for eventType, subs in pairs(_subscribers) do
		typedCount += #subs
		table.insert(typeList, { type = eventType, count = #subs })
	end
	return {
		eventCount          = _eventCount,
		sequence            = _sequence,
		historySize         = #_history,
		historyLimit        = _historyLimit,
		wildcardSubscribers = #_wildcardSubscribers,
		typedSubscribers    = typedCount,
		subscribedTypes     = typeList,
		isServer            = IS_SERVER,
	}
end

-- Expose priority constants
EventBus.PRIORITY = PRIORITY

return EventBus
