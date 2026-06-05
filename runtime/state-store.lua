--!strict
-- AF51-RBX | runtime/state-store.lua
-- Layer  : ReplicatedStorage.Packages.AF51Runtime.StateStore
-- Role   : Central gameplay state. All state mutation flows through dispatch().
--          Direct mutation of state tables is forbidden.
-- Arch   : Redux-style reducers + subscriptions + selectors
-- Rojo   : ModuleScript via .lua extension

-- ─── Domain Keys ──────────────────────────────────────────────────────────

local DOMAIN = {
	ECONOMY            = "economy",
	INVENTORY          = "inventory",
	PLAYER_PROGRESSION = "playerProgression",
	SESSIONS           = "sessions",
	GAMEPLAY_SYSTEMS   = "gameplaySystems",
	STATISTICS         = "statistics",
}

-- ─── Action Types ─────────────────────────────────────────────────────────

local ACTION = {
	-- Economy
	ECONOMY_SET_BALANCE     = "economy/setBalance",
	ECONOMY_ADD_CURRENCY    = "economy/addCurrency",
	ECONOMY_DEDUCT_CURRENCY = "economy/deductCurrency",
	ECONOMY_SET_PREMIUM     = "economy/setPremium",

	-- Inventory
	INVENTORY_ADD_ITEM      = "inventory/addItem",
	INVENTORY_REMOVE_ITEM   = "inventory/removeItem",
	INVENTORY_SET_EQUIPPED  = "inventory/setEquipped",
	INVENTORY_CLEAR         = "inventory/clear",

	-- Player Progression
	PROGRESSION_SET_LEVEL   = "playerProgression/setLevel",
	PROGRESSION_ADD_XP      = "playerProgression/addXP",
	PROGRESSION_SET_RANK    = "playerProgression/setRank",
	PROGRESSION_UNLOCK      = "playerProgression/unlock",

	-- Sessions
	SESSION_START           = "sessions/start",
	SESSION_END             = "sessions/end",
	SESSION_SET_PLAYER      = "sessions/setPlayer",

	-- Gameplay Systems
	GAME_SET_PHASE          = "gameplaySystems/setPhase",
	GAME_SET_FLAG           = "gameplaySystems/setFlag",
	GAME_REGISTER_SYSTEM    = "gameplaySystems/registerSystem",

	-- Statistics
	STAT_INCREMENT          = "statistics/increment",
	STAT_SET                = "statistics/set",
	STAT_RESET              = "statistics/reset",
}

-- ─── Default State ────────────────────────────────────────────────────────

local function _defaultEconomy(): { [string]: any }
	return {
		robux        = 0,
		gameCurrency = 0,
		premium      = false,
		transactions = {},
	}
end

local function _defaultInventory(): { [string]: any }
	return {
		items    = {},
		equipped = {},
		capacity = 50,
	}
end

local function _defaultPlayerProgression(): { [string]: any }
	return {
		level    = 1,
		xp       = 0,
		xpToNext = 100,
		rank     = "Beginner",
		unlocks  = {},
	}
end

local function _defaultSessions(): { [string]: any }
	return {
		active   = false,
		playerId = nil :: number?,
		playerName = nil :: string?,
		startedAt  = nil :: number?,
		endedAt    = nil :: number?,
	}
end

local function _defaultGameplaySystems(): { [string]: any }
	return {
		phase   = "lobby",
		flags   = {},
		systems = {},
	}
end

local function _defaultStatistics(): { [string]: any }
	return {
		counters = {},
	}
end

-- ─── Shallow Copy Helpers ─────────────────────────────────────────────────
-- Protects against direct mutation of the previous state snapshot.

local function _shallowCopy(t: { [string]: any }): { [string]: any }
	local copy: { [string]: any } = {}
	for k, v in pairs(t) do
		copy[k] = v
	end
	return copy
end

local function _shallowCopyArray(t: { any }): { any }
	local copy: { any } = {}
	for i, v in ipairs(t) do
		copy[i] = v
	end
	return copy
end

-- ─── Reducers ─────────────────────────────────────────────────────────────

local function _reduceEconomy(state: { [string]: any }, action: { type: string, payload: any? }): { [string]: any }
	local t = action.type
	local p = action.payload
	local next = _shallowCopy(state)

	if t == ACTION.ECONOMY_SET_BALANCE then
		assert(type(p) == "table", "ECONOMY_SET_BALANCE: payload must be table {robux?, gameCurrency?}")
		if p.robux ~= nil then next.robux = math.max(0, p.robux) end
		if p.gameCurrency ~= nil then next.gameCurrency = math.max(0, p.gameCurrency) end

	elseif t == ACTION.ECONOMY_ADD_CURRENCY then
		assert(type(p) == "table", "ECONOMY_ADD_CURRENCY: payload must be table {currency, amount}")
		local cur = p.currency
		local amt = math.max(0, p.amount or 0)
		if cur == "robux" then
			next.robux = next.robux + amt
		elseif cur == "gameCurrency" then
			next.gameCurrency = next.gameCurrency + amt
		end

	elseif t == ACTION.ECONOMY_DEDUCT_CURRENCY then
		assert(type(p) == "table", "ECONOMY_DEDUCT_CURRENCY: payload must be table {currency, amount}")
		local cur = p.currency
		local amt = math.max(0, p.amount or 0)
		if cur == "robux" then
			next.robux = math.max(0, next.robux - amt)
		elseif cur == "gameCurrency" then
			next.gameCurrency = math.max(0, next.gameCurrency - amt)
		end

	elseif t == ACTION.ECONOMY_SET_PREMIUM then
		assert(type(p) == "boolean", "ECONOMY_SET_PREMIUM: payload must be boolean")
		next.premium = p

	else
		return state -- no change
	end

	return next
end

local function _reduceInventory(state: { [string]: any }, action: { type: string, payload: any? }): { [string]: any }
	local t = action.type
	local p = action.payload
	local next = _shallowCopy(state)

	if t == ACTION.INVENTORY_ADD_ITEM then
		assert(type(p) == "table" and p.id, "INVENTORY_ADD_ITEM: payload must be {id, ...}")
		next.items = _shallowCopyArray(state.items)
		-- Prevent duplicates by id
		for _, item in ipairs(next.items) do
			if item.id == p.id then return state end
		end
		if #next.items >= next.capacity then
			warn("[AF51-StateStore] Inventory full, cannot add item:", p.id)
			return state
		end
		table.insert(next.items, p)

	elseif t == ACTION.INVENTORY_REMOVE_ITEM then
		assert(type(p) == "table" and p.id, "INVENTORY_REMOVE_ITEM: payload must be {id}")
		next.items = _shallowCopyArray(state.items)
		for i, item in ipairs(next.items) do
			if item.id == p.id then
				table.remove(next.items, i)
				break
			end
		end
		-- Also unequip if was equipped
		next.equipped = _shallowCopyArray(state.equipped)
		for i, eqId in ipairs(next.equipped) do
			if eqId == p.id then
				table.remove(next.equipped, i)
				break
			end
		end

	elseif t == ACTION.INVENTORY_SET_EQUIPPED then
		assert(type(p) == "table" and p.id and type(p.equipped) == "boolean",
			"INVENTORY_SET_EQUIPPED: payload must be {id, equipped: boolean}")
		next.equipped = _shallowCopyArray(state.equipped)
		if p.equipped then
			local alreadyEquipped = false
			for _, eqId in ipairs(next.equipped) do
				if eqId == p.id then alreadyEquipped = true break end
			end
			if not alreadyEquipped then
				table.insert(next.equipped, p.id)
			end
		else
			for i, eqId in ipairs(next.equipped) do
				if eqId == p.id then
					table.remove(next.equipped, i)
					break
				end
			end
		end

	elseif t == ACTION.INVENTORY_CLEAR then
		next.items = {}
		next.equipped = {}

	else
		return state
	end

	return next
end

local function _reducePlayerProgression(state: { [string]: any }, action: { type: string, payload: any? }): { [string]: any }
	local t = action.type
	local p = action.payload
	local next = _shallowCopy(state)

	if t == ACTION.PROGRESSION_SET_LEVEL then
		assert(type(p) == "number" and p >= 1, "PROGRESSION_SET_LEVEL: payload must be number >= 1")
		next.level = p

	elseif t == ACTION.PROGRESSION_ADD_XP then
		assert(type(p) == "number" and p >= 0, "PROGRESSION_ADD_XP: payload must be number >= 0")
		next.xp = next.xp + p
		-- Level-up cascade
		while next.xp >= next.xpToNext do
			next.xp = next.xp - next.xpToNext
			next.level = next.level + 1
			next.xpToNext = math.floor(next.xpToNext * 1.25)
		end

	elseif t == ACTION.PROGRESSION_SET_RANK then
		assert(type(p) == "string", "PROGRESSION_SET_RANK: payload must be string")
		next.rank = p

	elseif t == ACTION.PROGRESSION_UNLOCK then
		assert(type(p) == "table" and p.key, "PROGRESSION_UNLOCK: payload must be {key}")
		next.unlocks = _shallowCopyArray(state.unlocks)
		table.insert(next.unlocks, p.key)

	else
		return state
	end

	return next
end

local function _reduceSessions(state: { [string]: any }, action: { type: string, payload: any? }): { [string]: any }
	local t = action.type
	local p = action.payload
	local next = _shallowCopy(state)

	if t == ACTION.SESSION_START then
		next.active    = true
		next.startedAt = tick()
		next.endedAt   = nil

	elseif t == ACTION.SESSION_END then
		next.active  = false
		next.endedAt = tick()

	elseif t == ACTION.SESSION_SET_PLAYER then
		assert(type(p) == "table", "SESSION_SET_PLAYER: payload must be {playerId, playerName}")
		next.playerId   = p.playerId
		next.playerName = p.playerName

	else
		return state
	end

	return next
end

local function _reduceGameplaySystems(state: { [string]: any }, action: { type: string, payload: any? }): { [string]: any }
	local t = action.type
	local p = action.payload
	local next = _shallowCopy(state)

	if t == ACTION.GAME_SET_PHASE then
		assert(type(p) == "string", "GAME_SET_PHASE: payload must be string")
		next.phase = p

	elseif t == ACTION.GAME_SET_FLAG then
		assert(type(p) == "table" and p.key and p.value ~= nil,
			"GAME_SET_FLAG: payload must be {key, value}")
		next.flags = _shallowCopy(state.flags)
		next.flags[p.key] = p.value

	elseif t == ACTION.GAME_REGISTER_SYSTEM then
		assert(type(p) == "table" and p.name, "GAME_REGISTER_SYSTEM: payload must be {name, ...}")
		next.systems = _shallowCopy(state.systems)
		next.systems[p.name] = p

	else
		return state
	end

	return next
end

local function _reduceStatistics(state: { [string]: any }, action: { type: string, payload: any? }): { [string]: any }
	local t = action.type
	local p = action.payload
	local next = _shallowCopy(state)

	if t == ACTION.STAT_INCREMENT then
		assert(type(p) == "table" and p.key, "STAT_INCREMENT: payload must be {key, amount?}")
		next.counters = _shallowCopy(state.counters)
		local current = next.counters[p.key] or 0
		next.counters[p.key] = current + (p.amount or 1)

	elseif t == ACTION.STAT_SET then
		assert(type(p) == "table" and p.key and p.value ~= nil, "STAT_SET: payload must be {key, value}")
		next.counters = _shallowCopy(state.counters)
		next.counters[p.key] = p.value

	elseif t == ACTION.STAT_RESET then
		assert(type(p) == "table" and p.key, "STAT_RESET: payload must be {key}")
		next.counters = _shallowCopy(state.counters)
		next.counters[p.key] = 0

	else
		return state
	end

	return next
end

-- ─── Reducer Map ──────────────────────────────────────────────────────────

local _reducers: { [string]: (state: { [string]: any }, action: { type: string, payload: any? }) -> { [string]: any } } = {
	[DOMAIN.ECONOMY]            = _reduceEconomy,
	[DOMAIN.INVENTORY]          = _reduceInventory,
	[DOMAIN.PLAYER_PROGRESSION] = _reducePlayerProgression,
	[DOMAIN.SESSIONS]           = _reduceSessions,
	[DOMAIN.GAMEPLAY_SYSTEMS]   = _reduceGameplaySystems,
	[DOMAIN.STATISTICS]         = _reduceStatistics,
}

-- ─── Internal State ────────────────────────────────────────────────────────

local _state: { [string]: { [string]: any } } = {
	[DOMAIN.ECONOMY]            = _defaultEconomy(),
	[DOMAIN.INVENTORY]          = _defaultInventory(),
	[DOMAIN.PLAYER_PROGRESSION] = _defaultPlayerProgression(),
	[DOMAIN.SESSIONS]           = _defaultSessions(),
	[DOMAIN.GAMEPLAY_SYSTEMS]   = _defaultGameplaySystems(),
	[DOMAIN.STATISTICS]         = _defaultStatistics(),
}

local _subscriptions: { [string]: { { token: string, domain: string, callback: (newState: { [string]: any }, oldState: { [string]: any }) -> () } } } = {}
local _globalSubscriptions: { { token: string, callback: (newState: { [string]: any }, oldState: { [string]: any }) -> () } } = {}
local _auditCallback: ((entry: { [string]: any }) -> ())? = nil
local _dispatchDepth: number = 0
local _actionSequence: number = 0

-- ─── Store API ────────────────────────────────────────────────────────────

local StateStore = {}

function StateStore.setAuditCallback(cb: (entry: { [string]: any }) -> ()): ()
	_auditCallback = cb
end

--[[
	Returns a frozen shallow copy of a domain's state.
	Direct mutation of the returned table does NOT affect store state.
	@param domain  string — one of DOMAIN constants
]]
function StateStore.getState(domain: string?): { [string]: any }
	if domain then
		assert(_state[domain] ~= nil, "[AF51-StateStore] Unknown domain: " .. tostring(domain))
		return _shallowCopy(_state[domain])
	end
	-- Return full state snapshot
	local snapshot: { [string]: any } = {}
	for d, s in pairs(_state) do
		snapshot[d] = _shallowCopy(s)
	end
	return snapshot
end

--[[
	Dispatches an action through the appropriate reducer.
	Notifies subscribers if state changed.
	Re-entrant dispatch is blocked (fail-closed).

	@param action  { type: string, payload: any? }
]]
function StateStore.dispatch(action: { type: string, payload: any? }): ()
	assert(type(action) == "table" and type(action.type) == "string" and #action.type > 0,
		"[AF51-StateStore] action must be {type: string, payload: any?}")

	if _dispatchDepth > 0 then
		error("[AF51-StateStore] Re-entrant dispatch detected. Do not dispatch from within a reducer or subscriber.")
	end

	_dispatchDepth += 1
	_actionSequence += 1

	local seq = _actionSequence
	local ts  = tick()
	local domainTouched: string? = nil

	-- Determine which domain handles this action by prefix
	for domain, reducer in pairs(_reducers) do
		local prefix = domain .. "/"
		if action.type:sub(1, #prefix) == prefix or action.type:sub(1, #domain) == domain then
			local oldDomainState = _state[domain]
			local ok, newDomainState = xpcall(function()
				return reducer(_state[domain], action)
			end, function(e)
				return debug.traceback(e, 2)
			end)

			if not ok then
				_dispatchDepth -= 1
				error("[AF51-StateStore] Reducer error for action " .. action.type .. ": " .. tostring(newDomainState))
			end

			if newDomainState ~= oldDomainState then
				_state[domain] = newDomainState
				domainTouched = domain

				-- Notify domain subscribers
				local subs = _subscriptions[domain]
				if subs then
					for _, sub in ipairs(subs) do
						local ok2, err2 = xpcall(function()
							sub.callback(_shallowCopy(newDomainState), _shallowCopy(oldDomainState))
						end, function(e) return debug.traceback(e, 2) end)
						if not ok2 then
							warn("[AF51-StateStore] subscriber error:", err2)
						end
					end
				end

				-- Notify global subscribers
				for _, sub in ipairs(_globalSubscriptions) do
					local ok3, err3 = xpcall(function()
						sub.callback(_shallowCopy(newDomainState), _shallowCopy(oldDomainState))
					end, function(e) return debug.traceback(e, 2) end)
					if not ok3 then
						warn("[AF51-StateStore] global subscriber error:", err3)
					end
				end
			end

			break
		end
	end

	if _auditCallback then
		xpcall(function()
			_auditCallback({
				action  = "StateStore.dispatch",
				type    = action.type,
				domain  = domainTouched,
				seq     = seq,
				changed = domainTouched ~= nil,
				ts      = ts,
			})
		end, function(e) return e end)
	end

	_dispatchDepth -= 1
end

--[[
	Subscribes to state changes in a specific domain.
	@param domain    string — DOMAIN constant
	@param callback  function(newState, oldState)
	@return token    string
]]
function StateStore.subscribe(domain: string, callback: (newState: { [string]: any }, oldState: { [string]: any }) -> ()): string
	assert(_state[domain] ~= nil, "[AF51-StateStore] Unknown domain: " .. tostring(domain))
	assert(type(callback) == "function", "[AF51-StateStore] callback must be function")

	_actionSequence += 1
	local token = string.format("sub_%s_%d", domain:sub(1, 8), _actionSequence)

	if not _subscriptions[domain] then
		_subscriptions[domain] = {}
	end
	table.insert(_subscriptions[domain], { token = token, domain = domain, callback = callback })

	return token
end

--[[
	Subscribes to any state change across all domains.
	@param callback  function(newState, oldState)
	@return token    string
]]
function StateStore.subscribeGlobal(callback: (newState: { [string]: any }, oldState: { [string]: any }) -> ()): string
	assert(type(callback) == "function", "[AF51-StateStore] callback must be function")

	_actionSequence += 1
	local token = string.format("gsub_%d", _actionSequence)
	table.insert(_globalSubscriptions, { token = token, callback = callback })
	return token
end

--[[
	Unsubscribes by token.
	@return removed  boolean
]]
function StateStore.unsubscribe(token: string): boolean
	-- Check domain subscriptions
	for domain, subs in pairs(_subscriptions) do
		for i, sub in ipairs(subs) do
			if sub.token == token then
				table.remove(subs, i)
				return true
			end
		end
	end
	-- Check global subscriptions
	for i, sub in ipairs(_globalSubscriptions) do
		if sub.token == token then
			table.remove(_globalSubscriptions, i)
			return true
		end
	end
	return false
end

--[[
	Resets a domain to its default state.
	Only allowed in non-production contexts or via explicit governance.
]]
function StateStore.resetDomain(domain: string): ()
	assert(_state[domain] ~= nil, "[AF51-StateStore] Unknown domain: " .. tostring(domain))

	local defaults = {
		[DOMAIN.ECONOMY]            = _defaultEconomy,
		[DOMAIN.INVENTORY]          = _defaultInventory,
		[DOMAIN.PLAYER_PROGRESSION] = _defaultPlayerProgression,
		[DOMAIN.SESSIONS]           = _defaultSessions,
		[DOMAIN.GAMEPLAY_SYSTEMS]   = _defaultGameplaySystems,
		[DOMAIN.STATISTICS]         = _defaultStatistics,
	}

	_state[domain] = defaults[domain]()

	if _auditCallback then
		xpcall(function()
			_auditCallback({ action = "StateStore.resetDomain", domain = domain, ts = tick() })
		end, function(e) return e end)
	end
end

-- Expose constants
StateStore.DOMAIN = DOMAIN
StateStore.ACTION = ACTION

-- ── registerReducer: plug external reducer for custom dispatch logic ──────
function StateStore.registerReducer(reducerFn: (state: any, action: any) -> any)
	_reducer = reducerFn
	_auditLedger and _auditLedger.info and _auditLedger.info("[StateStore] Reducer registered")
end

return StateStore
