--!strict
-- AF51-RBX | runtime/service-registry.lua
-- Layer  : ReplicatedStorage.Packages.AF51Runtime.ServiceRegistry
-- Role   : Service registration, lifecycle management, dependency ordering.
--          Services boot in dependency order. Circular deps are rejected.
-- Rojo   : ModuleScript via .lua extension

-- ─── Lifecycle States ────────────────────────────────────────────────────

local LIFECYCLE = {
	PENDING  = "PENDING",
	STARTING = "STARTING",
	RUNNING  = "RUNNING",
	STOPPING = "STOPPING",
	STOPPED  = "STOPPED",
	ERROR    = "ERROR",
}

-- ─── Internal ─────────────────────────────────────────────────────────────

type ServiceDescriptor = {
	name         : string,
	module       : { [string]: any },
	dependencies : { string },
	lifecycle    : string,
	startedAt    : number?,
	stoppedAt    : number?,
	error        : string?,
}

local _registry: { [string]: ServiceDescriptor } = {}
local _startOrder: { string } = {}
local _auditCallback: ((entry: { [string]: any }) -> ())? = nil
local _initialized: boolean = false

-- ─── Audit hook ───────────────────────────────────────────────────────────

local function _audit(action: string, data: { [string]: any }?): ()
	if _auditCallback then
		xpcall(function()
			_auditCallback({ action = "ServiceRegistry." .. action, ts = tick(), data = data or {} })
		end, function(e) return e end)
	end
end

-- ─── Topological Sort (Kahn's algorithm) ─────────────────────────────────

local function _topoSort(names: { string }): ({ string }, string?)
	-- Build adjacency and in-degree
	local inDegree: { [string]: number } = {}
	local adj: { [string]: { string } } = {}

	for _, name in ipairs(names) do
		inDegree[name] = inDegree[name] or 0
		adj[name]      = adj[name] or {}
	end

	for _, name in ipairs(names) do
		local desc = _registry[name]
		if desc then
			for _, dep in ipairs(desc.dependencies) do
				if _registry[dep] then
					table.insert(adj[dep], name)
					inDegree[name] = (inDegree[name] or 0) + 1
				end
			end
		end
	end

	-- Queue: nodes with in-degree 0
	local queue: { string } = {}
	for _, name in ipairs(names) do
		if (inDegree[name] or 0) == 0 then
			table.insert(queue, name)
		end
	end

	local sorted: { string } = {}
	local visited = 0

	while #queue > 0 do
		-- Take first (stable sort by name for determinism)
		table.sort(queue)
		local node = table.remove(queue, 1)
		table.insert(sorted, node)
		visited += 1

		for _, neighbor in ipairs(adj[node] or {}) do
			inDegree[neighbor] -= 1
			if inDegree[neighbor] == 0 then
				table.insert(queue, neighbor)
			end
		end
	end

	if visited ~= #names then
		return {}, "Circular dependency detected among services"
	end

	return sorted, nil
end

-- ─── Public API ───────────────────────────────────────────────────────────

local ServiceRegistry = {}

ServiceRegistry.LIFECYCLE = LIFECYCLE

function ServiceRegistry.setAuditCallback(cb: (entry: { [string]: any }) -> ()): ()
	_auditCallback = cb
end

--[[
	Registers a service module.
	@param name          string — unique service name
	@param serviceModule table  — must implement :init() and :start(), optionally :stop() and :healthCheck()
	@param dependencies  {string}? — names of services that must start before this one
]]
function ServiceRegistry.register(name: string, serviceModule: { [string]: any }, dependencies: { string }?): ()
	assert(type(name) == "string" and #name > 0, "[AF51-ServiceRegistry] name must be non-empty string")
	assert(type(serviceModule) == "table", "[AF51-ServiceRegistry] serviceModule must be a table")
	assert(_registry[name] == nil, "[AF51-ServiceRegistry] Service already registered: " .. name)
	assert(not _initialized, "[AF51-ServiceRegistry] Cannot register after init(). Register all services before calling init().")

	local deps = dependencies or {}

	_registry[name] = {
		name         = name,
		module       = serviceModule,
		dependencies = deps,
		lifecycle    = LIFECYCLE.PENDING,
		startedAt    = nil,
		stoppedAt    = nil,
		error        = nil,
	}

	_audit("register", { name = name, dependencies = deps })
end

--[[
	Initializes all registered services in dependency order.
	Calls :init() on each service if it exists.
	Must be called once before startAll().
]]
function ServiceRegistry.init(): ()
	assert(not _initialized, "[AF51-ServiceRegistry] Already initialized.")

	local names: { string } = {}
	for name in pairs(_registry) do
		table.insert(names, name)
	end

	local sorted, err = _topoSort(names)
	if err then
		error("[AF51-ServiceRegistry] init() failed: " .. err)
	end

	_startOrder = sorted
	_initialized = true

	_audit("init", { order = sorted })

	-- Call :init() on each in order
	for _, name in ipairs(sorted) do
		local desc = _registry[name]
		if desc.module.init then
			local ok, initErr = xpcall(function()
				desc.module:init()
			end, function(e) return debug.traceback(e, 2) end)
			if not ok then
				desc.lifecycle = LIFECYCLE.ERROR
				desc.error     = tostring(initErr)
				_audit("initError", { name = name, error = tostring(initErr) })
				error("[AF51-ServiceRegistry] Service init() failed: " .. name .. " — " .. tostring(initErr))
			end
		end
	end
end

--[[
	Starts all services in dependency order.
	Calls :start() on each service.
	Aborts on first failure (fail-closed).
]]
function ServiceRegistry.startAll(): ()
	assert(_initialized, "[AF51-ServiceRegistry] Must call init() before startAll().")

	for _, name in ipairs(_startOrder) do
		local desc = _registry[name]
		if desc.lifecycle == LIFECYCLE.ERROR then
			error("[AF51-ServiceRegistry] Cannot start services: " .. name .. " is in ERROR state.")
		end

		desc.lifecycle = LIFECYCLE.STARTING
		_audit("starting", { name = name })

		if desc.module.start then
			local ok, startErr = xpcall(function()
				desc.module:start()
			end, function(e) return debug.traceback(e, 2) end)
			if not ok then
				desc.lifecycle = LIFECYCLE.ERROR
				desc.error     = tostring(startErr)
				_audit("startError", { name = name, error = tostring(startErr) })
				error("[AF51-ServiceRegistry] Service start() failed: " .. name .. " — " .. tostring(startErr))
			end
		end

		desc.lifecycle  = LIFECYCLE.RUNNING
		desc.startedAt  = tick()
		_audit("started", { name = name, startedAt = desc.startedAt })
	end
end

--[[
	Stops all services in reverse start order.
	Calls :stop() if it exists. Errors are logged but not fatal.
]]
function ServiceRegistry.stopAll(): ()
	local reversed: { string } = {}
	for i = #_startOrder, 1, -1 do
		table.insert(reversed, _startOrder[i])
	end

	for _, name in ipairs(reversed) do
		local desc = _registry[name]
		if desc.lifecycle == LIFECYCLE.RUNNING then
			desc.lifecycle = LIFECYCLE.STOPPING
			_audit("stopping", { name = name })

			if desc.module.stop then
				local ok, stopErr = xpcall(function()
					desc.module:stop()
				end, function(e) return debug.traceback(e, 2) end)
				if not ok then
					warn("[AF51-ServiceRegistry] Service stop() error: " .. name .. " — " .. tostring(stopErr))
					_audit("stopError", { name = name, error = tostring(stopErr) })
				end
			end

			desc.lifecycle = LIFECYCLE.STOPPED
			desc.stoppedAt = tick()
			_audit("stopped", { name = name, stoppedAt = desc.stoppedAt })
		end
	end
end

--[[
	Returns a running service by name.
	Errors if not found or not running.
]]
function ServiceRegistry.get(name: string): { [string]: any }
	local desc = _registry[name]
	assert(desc ~= nil, "[AF51-ServiceRegistry] Service not registered: " .. tostring(name))
	assert(desc.lifecycle == LIFECYCLE.RUNNING,
		"[AF51-ServiceRegistry] Service not running: " .. name .. " (state: " .. desc.lifecycle .. ")")
	return desc.module
end

--[[
	Health check. Calls :healthCheck() on all running services.
	Returns { ok: boolean, results: {name: string, ok: boolean, error: string?}[] }
]]
function ServiceRegistry.healthCheck(): { ok: boolean, results: { { name: string, ok: boolean, error: string? } } }
	local results: { { name: string, ok: boolean, error: string? } } = {}
	local allOk = true

	for _, name in ipairs(_startOrder) do
		local desc = _registry[name]
		local ok = true
		local errStr: string? = nil

		if desc.lifecycle ~= LIFECYCLE.RUNNING then
			ok     = false
			errStr = "Not running (state: " .. desc.lifecycle .. ")"
			allOk  = false
		elseif desc.module.healthCheck then
			local callOk, result = xpcall(function()
				return desc.module:healthCheck()
			end, function(e) return { ok = false, error = debug.traceback(e, 2) } end)
			if not callOk or (type(result) == "table" and not result.ok) then
				ok     = false
				errStr = type(result) == "table" and result.error or tostring(result)
				allOk  = false
			end
		end

		table.insert(results, { name = name, ok = ok, error = errStr })
	end

	_audit("healthCheck", { allOk = allOk })
	return { ok = allOk, results = results }
end

--[[
	Returns the full registry snapshot for diagnostics.
]]
function ServiceRegistry.getSnapshot(): { [string]: any }
	local snap: { [string]: any } = {}
	for name, desc in pairs(_registry) do
		snap[name] = {
			lifecycle    = desc.lifecycle,
			dependencies = desc.dependencies,
			startedAt    = desc.startedAt,
			stoppedAt    = desc.stoppedAt,
			error        = desc.error,
		}
	end
	return { initialized = _initialized, startOrder = _startOrder, services = snap }
end

return ServiceRegistry
