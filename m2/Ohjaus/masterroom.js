// m2/Ohjaus/masterroom.js
// M2 MasterRoom - Active Orchestration Layer
// Routes commands to appropriate AL entities

var MASTERROOM_STATE = {
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  STOPPED: "STOPPED"
};

function MasterRoom(options) {
  if (!options) {
    options = {};
  }
  
  this._clock = options.clock || null;
  this._debug = options.debug || false;
  
  this._alx = options.alx || null;
  this._orchestrator = options.orchestrator || null;
  this._builderAL = options.builderAL || null;
  this._guardianAL = options.guardianAL || null;
  
  this._state = MASTERROOM_STATE.IDLE;
  this._commandCount = 0;
}

MasterRoom.prototype.boot = function() {
  this._state = MASTERROOM_STATE.RUNNING;
  
  if (this._debug) {
    
    
    
    
  }
  
  return { ok: true };
};

MasterRoom.prototype.shutdown = function() {
  this._state = MASTERROOM_STATE.STOPPED;
  
  if (this._debug) {
    
  }
  
  return { ok: true };
};

MasterRoom.prototype.setALX = function(alx) {
  this._alx = alx;
};

MasterRoom.prototype.setOrchestrator = function(orchestrator) {
  this._orchestrator = orchestrator;
};

MasterRoom.prototype.setBuilderAL = function(builderAL) {
  this._builderAL = builderAL;
};

MasterRoom.prototype.setGuardianAL = function(guardianAL) {
  this._guardianAL = guardianAL;
};

MasterRoom.prototype.execute = async function(input, context) {
  if (this._state !== MASTERROOM_STATE.RUNNING) {
    return { ok: false, error: "MasterRoom not running" };
  }
  
  if (!this._alx) {
    return { ok: false, error: "ALX not connected" };
  }
  
  if (!context) {
    context = {};
  }
  
  this._commandCount++;
  
  // STEP 1: Call ALX for intent analysis
  var analysis = await this._alx.execute(input, context);
  
  if (!analysis.ok) {
    return analysis;
  }
  
  // STEP 2: Route based on intent
  var intent = analysis.intent;
  
  if (this._debug) {
    
  }
  
  // BUILD intents -> BuilderAL
  if (intent === "BUILD" || intent === "BUILD_START" || intent === "BUILD_PROJECT") {
    if (!this._builderAL) {
      return {
        ok: false,
        error: "BUILD_NO_BUILDER",
        output: "BuilderAL not configured",
        intent: intent
      };
    }
    
    // Guardian validation (if available)
    if (this._guardianAL) {
      var guardResult = this._guardianAL.validate({
        type: "BUILD",
        input: input,
        context: context
      });
      
      if (!guardResult.ok) {
        return {
          ok: false,
          error: "BUILD_GUARDIAN_REJECT",
          output: "Guardian rejected build: " + guardResult.reason,
          intent: intent
        };
      }
    }
    
    // Delegate to BuilderAL
    return await this._builderAL.work(analysis, context);
  }
  
  // PIPELINE intents -> BuilderAL (pipeline mode)
  if (intent === "PIPELINE" || intent === "PIPELINE_STATUS") {
    if (this._builderAL && typeof this._builderAL.getPipelineStatus === "function") {
      return await this._builderAL.getPipelineStatus(context);
    }
  }
  
  // SECURITY intents -> GuardianAL
  if (intent === "SECURITY" || intent === "LOCKDOWN" || intent === "AUDIT") {
    if (this._guardianAL && typeof this._guardianAL.handleSecurity === "function") {
      return await this._guardianAL.handleSecurity(analysis, context);
    }
  }
  
  // Default: Return ALX analysis result
  return analysis;
};

MasterRoom.prototype.getStatus = function() {
  return {
    state: this._state,
    commandCount: this._commandCount,
    alxConnected: !!this._alx,
    builderALConnected: !!this._builderAL,
    guardianALConnected: !!this._guardianAL
  };
};

function createMasterRoom(options) {
  return new MasterRoom(options);
}

export { MasterRoom, createMasterRoom, MASTERROOM_STATE };