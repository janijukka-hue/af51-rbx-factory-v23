--!strict
-- AF51-RBX | runtime/network-layer.lua
-- Layer  : ReplicatedStorage.Packages.AF51Runtime.NetworkLayer
-- Role   : Governed RemoteEvent / RemoteFunction wrapper.
--          ALL client→server and server→client communication flows through here.
--          No raw RemoteEvent:FireServer() or RemoteEvent:FireClient() outside this module.
-- Policy : Server-authoritative. Client requests are validated before execution.
-- Rojo   : ModuleScript via .lua extension

local RunService    = game:GetService("RunService")
local Players       = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local IS_SERVER: boolean = RunService:IsServer()

-- ─── Rate Limit Config ────────────────────────────────────────────────────
-- Per-player, per-remote rate limiting. Prevents request flooding.

local DEFAULT_RATE_LIMIT: number = 20   -- requests per window
local DEFAULT_RATE_WINDOW: number = 1   -- seconds

-- ─── Remote Topology ──────────────────────────────────────────────────────
-- All remotes must be declared here before use.
-- This enforces the deterministic remote topology requirement.

type RemoteDescriptor = {
	name        : string,
	remoteType  : string,   -- "Event" | "Function"
	direction   : string,   -- "C2S" | "S2C" | "Bidirectional"
	rateLimit   : number,
	rateWindow  : number,
	validator   : ((player: Player, payload: any) -> (boolean, string?))?,
	instance    : (RemoteEvent | RemoteFunction)?,
}

local _remoteRegistry: { [string]: RemoteDescriptor } = {}
local _rateLimitState: { [string]: { [string]: { count: number, windowStart: number } } } = {}

-- Audit + Event hooks (set by RuntimeInit)
local _auditCallback: ((entry: { [string]: any }) -> ())? = nil
local _eventBusEmit: ((eventType: string, payload: any, source: string) -> ())? = nil

-- ─── Helpers ──────────────────────────────────────────────────────────────

local function _audit(action: string, data: { [string]: any }?): ()
	if _auditCallback then
		xpcall(function()
			_auditCallback({ action = "NetworkLayer." .. action, ts = tick(), data = data or {} })
		end, function(e) return e end)
	end
end

local function _getRemotesFolder(): Folder
	local rs = ReplicatedStorage:FindFirstChild("Remotes")
	if not rs then
		if IS_SERVER then
			local folder = Instance.new("Folder")
			folder.Name   = "Remotes"
			folder.Parent = ReplicatedStorage
			return folder
		else
			error("[AF51-NetworkLayer] Remotes folder not found in ReplicatedStorage. Server must initialize first.")
		end
	end
	return rs :: Folder
end

local function _checkRateLimit(remoteName: string, player: Player): boolean
	local desc = _remoteRegistry[remoteName]
	if not desc then return false end

	local playerId = tostring(player.UserId)
	local now = tick()

	if not _rateLimitState[remoteName] then
		_rateLimitState[remoteName] = {}
	end

	local playerState = _rateLimitState[remoteName][playerId]
	if not playerState then
		_rateLimitState[remoteName][playerId] = { count = 1, windowStart = now }
		return true
	end

	if now - playerState.windowStart > desc.rateWindow then
		-- Reset window
		playerState.count       = 1
		playerState.windowStart = now
		return true
	end

	if playerState.count >= desc.rateLimit then
		return false
	end

	playerState.count += 1
	return true
end

local function _cleanRateLimitState(): ()
	-- Called periodically to avoid memory growth
	local now = tick()
	for remoteName, players in pairs(_rateLimitState) do
		local desc = _remoteRegistry[remoteName]
		if desc then
			for playerId, state in pairs(players) do
				if now - state.windowStart > desc.rateWindow * 10 then
					players[playerId] = nil
				end
			end
		end
	end
end

-- ─── Public API ───────────────────────────────────────────────────────────

local NetworkLayer = {}

function NetworkLayer.setAuditCallback(cb: (entry: { [string]: any }) -> ()): ()
	_auditCallback = cb
end

function NetworkLayer.setEventBusEmit(emitFn: (eventType: string, payload: any, source: string) -> ()): ()
	_eventBusEmit = emitFn
end

--[[
	Declares a remote in the governed topology.
	Must be called server-side during RuntimeInit before any remote is used.
	Client-side: call after server init (use WaitForChild in client scripts).

	@param name       string — unique remote name
	@param remoteType string — "Event" | "Function"
	@param direction  string — "C2S" | "S2C" | "Bidirectional"
	@param options    table? — { rateLimit, rateWindow, validator }
]]
--[[
	Set a per-remote validation function.
	Called before processing each server event. Return true to allow, false to reject.
]]
function NetworkLayer.setValidator(
	name: string,
	validatorFn: (player: Player, payload: any) -> (boolean, string?)
): ()
	if _remoteRegistry[name] then
		_remoteRegistry[name].validator = validatorFn
		_audit("setValidator", { name = name })
	end
end

function NetworkLayer.declareRemote(
	name: string,
	remoteType: string,
	direction: string,
	options: { rateLimit: number?, rateWindow: number?, validator: ((player: Player, payload: any) -> (boolean, string?))? }?
): ()
	assert(type(name) == "string" and #name > 0, "[AF51-NetworkLayer] name must be non-empty string")
	assert(remoteType == "Event" or remoteType == "Function",
		"[AF51-NetworkLayer] remoteType must be 'Event' or 'Function'")
	assert(direction == "C2S" or direction == "S2C" or direction == "Bidirectional",
		"[AF51-NetworkLayer] direction must be 'C2S', 'S2C', or 'Bidirectional'")
	assert(_remoteRegistry[name] == nil, "[AF51-NetworkLayer] Remote already declared: " .. name)

	local opts = options or {}

	local desc: RemoteDescriptor = {
		name        = name,
		remoteType  = remoteType,
		direction   = direction,
		rateLimit   = opts.rateLimit or DEFAULT_RATE_LIMIT,
		rateWindow  = opts.rateWindow or DEFAULT_RATE_WINDOW,
		validator   = opts.validator,
		instance    = nil,
	}

	-- Server: create the instance
	if IS_SERVER then
		local folder = _getRemotesFolder()
		if remoteType == "Event" then
			local re = Instance.new("RemoteEvent")
			re.Name   = name
			re.Parent = folder
			desc.instance = re
		else
			local rf = Instance.new("RemoteFunction")
			rf.Name   = name
			rf.Parent = folder
			desc.instance = rf
		end
	end

	_remoteRegistry[name] = desc
	_audit("declareRemote", { name = name, remoteType = remoteType, direction = direction })

	-- Return the created instance (server) or nil (client — use resolveRemote first)
	return desc.instance
end

--[[
	Resolves the remote instance client-side (uses WaitForChild).
	Must be called before firing from client.
	@param name     string
	@param timeout  number? — default 10 seconds
]]
function NetworkLayer.resolveRemote(name: string, timeout: number?): ()
	assert(not IS_SERVER, "[AF51-NetworkLayer] resolveRemote() is client-only")
	assert(_remoteRegistry[name] ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)

	local desc = _remoteRegistry[name]
	if desc.instance then return end

	local folder = ReplicatedStorage:WaitForChild("Remotes", timeout or 10) :: Folder
	assert(folder, "[AF51-NetworkLayer] Remotes folder not found within timeout")

	if desc.remoteType == "Event" then
		desc.instance = folder:WaitForChild(name, timeout or 10) :: RemoteEvent
	else
		desc.instance = folder:WaitForChild(name, timeout or 10) :: RemoteFunction
	end

	assert(desc.instance, "[AF51-NetworkLayer] Remote not found: " .. name)
	_audit("resolveRemote", { name = name })
end

--[[
	Server: registers a handler for a C2S RemoteEvent.
	All incoming requests are rate-limited and validated before handler is called.

	@param name     string
	@param handler  function(player: Player, payload: any) -> ()
]]
function NetworkLayer.onServerEvent(name: string, handler: (player: Player, payload: any) -> ()): ()
	assert(IS_SERVER, "[AF51-NetworkLayer] onServerEvent() is server-only")

	local desc = _remoteRegistry[name]
	assert(desc ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)
	assert(desc.remoteType == "Event", "[AF51-NetworkLayer] " .. name .. " is not a RemoteEvent")
	assert(desc.direction == "C2S" or desc.direction == "Bidirectional",
		"[AF51-NetworkLayer] " .. name .. " direction does not allow C2S")

	local re = desc.instance :: RemoteEvent
	assert(re ~= nil, "[AF51-NetworkLayer] Remote instance not created: " .. name)

	re.OnServerEvent:Connect(function(player: Player, payload: any)
		-- Rate limit
		if not _checkRateLimit(name, player) then
			_audit("rateLimitExceeded", { name = name, player = player.Name, userId = player.UserId })
			return
		end

		-- Validate
		if desc.validator then
			local ok, reason = desc.validator(player, payload)
			if not ok then
				_audit("validationFailed", {
					name   = name,
					player = player.Name,
					userId = player.UserId,
					reason = reason or "unknown",
				})
				return
			end
		end

		-- Dispatch via EventBus if available
		if _eventBusEmit then
			_eventBusEmit("network:incoming:" .. name, { player = player, payload = payload }, "NetworkLayer")
		end

		-- Call handler
		local handlerOk, handlerErr = xpcall(function()
			handler(player, payload)
		end, function(e) return debug.traceback(e, 2) end)

		if not handlerOk then
			warn("[AF51-NetworkLayer] Handler error for " .. name .. ":", handlerErr)
			_audit("handlerError", { name = name, player = player.Name, error = tostring(handlerErr) })
		end
	end)

	_audit("onServerEvent", { name = name })
end

--[[
	Server: registers an OnServerInvoke handler for a RemoteFunction.
]]
function NetworkLayer.onServerInvoke(name: string, handler: (player: Player, payload: any) -> any): ()
	assert(IS_SERVER, "[AF51-NetworkLayer] onServerInvoke() is server-only")

	local desc = _remoteRegistry[name]
	assert(desc ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)
	assert(desc.remoteType == "Function", "[AF51-NetworkLayer] " .. name .. " is not a RemoteFunction")

	local rf = desc.instance :: RemoteFunction
	assert(rf ~= nil, "[AF51-NetworkLayer] Remote instance not created: " .. name)

	rf.OnServerInvoke = function(player: Player, payload: any): any
		if not _checkRateLimit(name, player) then
			_audit("rateLimitExceeded", { name = name, player = player.Name, userId = player.UserId })
			return { ok = false, error = "RATE_LIMITED" }
		end

		if desc.validator then
			local ok, reason = desc.validator(player, payload)
			if not ok then
				_audit("validationFailed", { name = name, player = player.Name, reason = reason })
				return { ok = false, error = "VALIDATION_FAILED", reason = reason }
			end
		end

		local handlerOk, result = xpcall(function()
			return handler(player, payload)
		end, function(e) return debug.traceback(e, 2) end)

		if not handlerOk then
			_audit("handlerError", { name = name, player = player.Name, error = tostring(result) })
			return { ok = false, error = "HANDLER_ERROR" }
		end

		return result
	end

	_audit("onServerInvoke", { name = name })
end

--[[
	Server: fires a S2C RemoteEvent to a specific player.
]]
function NetworkLayer.fireClient(name: string, player: Player, payload: any?): ()
	assert(IS_SERVER, "[AF51-NetworkLayer] fireClient() is server-only")

	local desc = _remoteRegistry[name]
	assert(desc ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)
	assert(desc.remoteType == "Event", "[AF51-NetworkLayer] " .. name .. " is not a RemoteEvent")
	assert(desc.direction == "S2C" or desc.direction == "Bidirectional",
		"[AF51-NetworkLayer] " .. name .. " direction does not allow S2C")

	local re = desc.instance :: RemoteEvent
	re:FireClient(player, payload)
	_audit("fireClient", { name = name, player = player.Name })
end

--[[
	Server: fires a S2C RemoteEvent to all players.
]]
function NetworkLayer.fireAllClients(name: string, payload: any?): ()
	assert(IS_SERVER, "[AF51-NetworkLayer] fireAllClients() is server-only")

	local desc = _remoteRegistry[name]
	assert(desc ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)
	assert(desc.remoteType == "Event", "[AF51-NetworkLayer] " .. name .. " is not a RemoteEvent")

	local re = desc.instance :: RemoteEvent
	re:FireAllClients(payload)
	_audit("fireAllClients", { name = name, playerCount = #Players:GetPlayers() })
end

--[[
	Client: fires a C2S RemoteEvent.
	Remote must have been resolved first via resolveRemote().
]]
function NetworkLayer.fireServer(name: string, payload: any?): ()
	assert(not IS_SERVER, "[AF51-NetworkLayer] fireServer() is client-only")

	local desc = _remoteRegistry[name]
	assert(desc ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)
	assert(desc.instance ~= nil, "[AF51-NetworkLayer] Remote not resolved. Call resolveRemote() first: " .. name)
	assert(desc.remoteType == "Event", "[AF51-NetworkLayer] " .. name .. " is not a RemoteEvent")
	assert(desc.direction == "C2S" or desc.direction == "Bidirectional",
		"[AF51-NetworkLayer] " .. name .. " direction does not allow C2S")

	local re = desc.instance :: RemoteEvent
	re:FireServer(payload)
end

--[[
	Client: invokes a RemoteFunction.
]]
function NetworkLayer.invokeServer(name: string, payload: any?): any
	assert(not IS_SERVER, "[AF51-NetworkLayer] invokeServer() is client-only")

	local desc = _remoteRegistry[name]
	assert(desc ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)
	assert(desc.instance ~= nil, "[AF51-NetworkLayer] Remote not resolved. Call resolveRemote() first: " .. name)
	assert(desc.remoteType == "Function", "[AF51-NetworkLayer] " .. name .. " is not a RemoteFunction")

	local rf = desc.instance :: RemoteFunction
	return rf:InvokeServer(payload)
end

--[[
	Client: registers a listener for a S2C RemoteEvent.
]]
function NetworkLayer.onClientEvent(name: string, handler: (payload: any) -> ()): ()
	assert(not IS_SERVER, "[AF51-NetworkLayer] onClientEvent() is client-only")

	local desc = _remoteRegistry[name]
	assert(desc ~= nil, "[AF51-NetworkLayer] Remote not declared: " .. name)
	assert(desc.instance ~= nil, "[AF51-NetworkLayer] Remote not resolved. Call resolveRemote() first: " .. name)
	assert(desc.remoteType == "Event", "[AF51-NetworkLayer] " .. name .. " is not a RemoteEvent")

	local re = desc.instance :: RemoteEvent
	re.OnClientEvent:Connect(function(payload: any)
		if _eventBusEmit then
			_eventBusEmit("network:outgoing:" .. name, payload, "NetworkLayer")
		end
		local ok, err = xpcall(function()
			handler(payload)
		end, function(e) return debug.traceback(e, 2) end)
		if not ok then
			warn("[AF51-NetworkLayer] Client handler error for " .. name .. ":", err)
		end
	end)
end

--[[
	Periodic maintenance. Call from a server heartbeat.
]]
function NetworkLayer.tick(): ()
	if IS_SERVER then
		_cleanRateLimitState()
	end
end

--[[
	Returns topology snapshot for diagnostics.
]]
function NetworkLayer.getTopology(): { [string]: any }
	local topo: { [string]: any } = {}
	for name, desc in pairs(_remoteRegistry) do
		topo[name] = {
			remoteType = desc.remoteType,
			direction  = desc.direction,
			rateLimit  = desc.rateLimit,
			rateWindow = desc.rateWindow,
			resolved   = desc.instance ~= nil,
		}
	end
	return topo
end

return NetworkLayer
