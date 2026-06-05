// m2/oliot/builder-al.js
// AL2 BuilderAL - Enterprise-level Builder
// Handles build orchestration via t3 Factory

var BUILDER_STATE = {
  IDLE: "IDLE",
  BUILDING: "BUILDING",
  ERROR: "ERROR"
};

function fnv1a32(str) {
  var hash = 2166136261;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function BuilderAL(options) {
  if (!options) {
    options = {};
  }
  
  this._clock = options.clock || null;
  this._debug = options.debug || false;
  
  this._factory = options.factory || null;
  this._bridge = options.bridge || null;
  this._orchestrator = options.orchestrator || null;
  
  this._state = BUILDER_STATE.IDLE;
  this._currentBuild = null;
  this._buildCount = 0;
  this._successCount = 0;
  this._failCount = 0;
  this._sequence = 0;
}

BuilderAL.prototype._now = function() {
  return this._clock ? this._clock.now() : Date.now();
};

BuilderAL.prototype._generateBuildId = function() {
  var ts = this._now();
  this._sequence++;
  var seed = "build:" + ts + ":" + this._sequence;
  return "build_" + fnv1a32(seed).toString(16).padStart(8, "0");
};

BuilderAL.prototype.setFactory = function(factory) {
  this._factory = factory;
};

BuilderAL.prototype.setBridge = function(bridge) {
  this._bridge = bridge;
};

BuilderAL.prototype.setOrchestrator = function(orchestrator) {
  this._orchestrator = orchestrator;
};

BuilderAL.prototype.work = async function(analysis, context) {
  if (this._state === BUILDER_STATE.BUILDING) {
    return {
      ok: false,
      error: "BUILD_IN_PROGRESS",
      output: "Another build is in progress"
    };
  }
  
  if (!this._factory) {
    return {
      ok: false,
      error: "NO_FACTORY",
      output: "Factory not configured"
    };
  }
  
  var buildId = this._generateBuildId();
  var startTime = this._now();
  var endTime;
  var durationMs;
  
  this._state = BUILDER_STATE.BUILDING;
  this._currentBuild = buildId;
  this._buildCount++;
  
  var projectConfig = this._extractProjectConfig(analysis, context);
  
  await this._auditEvent("BUILD:START", {
    buildId: buildId,
    projectName: projectConfig.name,
    intent: analysis.intent
  });
  
  if (this._debug) {
    
  }
  
  try {
    var validation = this._validateConfig(projectConfig);
    if (!validation.valid) {
      throw new Error("Invalid config: " + validation.error);
    }
    
    var buildResult;
    
    if (this._bridge && typeof this._bridge.submitBuild === "function") {
      buildResult = await this._bridge.submitBuild(projectConfig);
    } else if (this._factory && typeof this._factory.build === "function") {
      buildResult = await this._factory.build(projectConfig);
    } else {
      throw new Error("No build method available");
    }
    
    endTime = this._now();
    durationMs = endTime - startTime;
    
    if (buildResult.ok) {
      this._successCount++;
      
      await this._auditEvent("BUILD:SUCCESS", {
        buildId: buildId,
        durationMs: durationMs,
        artifactCount: buildResult.artifacts ? buildResult.artifacts.length : 0
      });
      
      if (buildResult.artifacts && buildResult.artifacts.length > 0) {
        await this._publishArtifacts(buildId, buildResult.artifacts);
      }
      
      this._state = BUILDER_STATE.IDLE;
      this._currentBuild = null;
      
      return {
        ok: true,
        buildId: buildId,
        status: "SUCCESS",
        artifacts: buildResult.artifacts || [],
        durationMs: durationMs,
        output: "Build completed successfully"
      };
    } else {
      throw new Error(buildResult.error || "Build failed");
    }
    
  } catch (err) {
    endTime = this._now();
    durationMs = endTime - startTime;
    
    this._failCount++;
    this._state = BUILDER_STATE.ERROR;
    this._currentBuild = null;
    
    await this._auditEvent("BUILD:FAIL", {
      buildId: buildId,
      durationMs: durationMs,
      error: err.message
    });
    
    if (this._debug) {
      console.error("[BuilderAL] Build failed:", err.message);
    }
    
    this._state = BUILDER_STATE.IDLE;
    
    return {
      ok: false,
      buildId: buildId,
      status: "FAILED",
      error: err.message,
      durationMs: durationMs,
      output: "Build failed: " + err.message
    };
  }
};

BuilderAL.prototype._extractProjectConfig = function(analysis, context) {
  var config = {
    name: "project_" + this._now(),
    type: "standard",
    files: [],
    options: {}
  };
  
  if (analysis.metadata && analysis.metadata.projectConfig) {
    Object.assign(config, analysis.metadata.projectConfig);
  }
  
  if (context && context.projectName) {
    config.name = context.projectName;
  }
  
  if (context && context.files) {
    config.files = context.files;
  }
  
  return config;
};

BuilderAL.prototype._validateConfig = function(config) {
  if (!config) {
    return { valid: false, error: "No config provided" };
  }
  
  if (!config.name || typeof config.name !== "string") {
    return { valid: false, error: "Invalid project name" };
  }
  
  if (config.name.length > 200) {
    return { valid: false, error: "Project name too long" };
  }
  
  return { valid: true };
};

BuilderAL.prototype._auditEvent = async function(event, data) {
  if (!this._orchestrator) {
    if (this._debug) {
      
    }
    return;
  }
  
  try {
    await this._orchestrator.writeMemory("episodic", {
      event: event,
      source: "BuilderAL",
      data: data
    }, ["builder", "build", event.toLowerCase().replace(":", "_")]);
  } catch (err) {
    if (this._debug) {
      console.error("[BuilderAL] Audit error:", err);
    }
  }
};

BuilderAL.prototype._publishArtifacts = async function(buildId, artifacts) {
  if (!this._orchestrator) {
    return;
  }
  
  for (var i = 0; i < artifacts.length; i++) {
    var artifact = artifacts[i];
    
    try {
      await this._orchestrator.writeMemory("episodic", {
        event: "ARTIFACT:PUBLISHED",
        artifact: {
          id: artifact.id || buildId + "_" + i,
          buildId: buildId,
          name: artifact.name || "artifact_" + i,
          type: artifact.type || "unknown",
          size: artifact.size || 0,
          createdAt: new Date().toISOString()
        }
      }, ["factory", "publish", "artifact"]);
    } catch (err) {
      if (this._debug) {
        console.error("[BuilderAL] Publish error:", err);
      }
    }
  }
};

BuilderAL.prototype.getPipelineStatus = async function(context) {
  if (!this._factory) {
    return { ok: false, error: "No factory" };
  }
  
  var status = {
    state: this._state,
    currentBuild: this._currentBuild,
    buildCount: this._buildCount,
    successCount: this._successCount,
    failCount: this._failCount,
    successRate: this._buildCount > 0 
      ? Math.round((this._successCount / this._buildCount) * 100) 
      : 0
  };
  
  if (this._factory.getStatus) {
    status.factory = this._factory.getStatus();
  }
  
  return {
    ok: true,
    output: "Pipeline status retrieved",
    status: status
  };
};

BuilderAL.prototype.getStatus = function() {
  return {
    state: this._state,
    currentBuild: this._currentBuild,
    buildCount: this._buildCount,
    successCount: this._successCount,
    failCount: this._failCount,
    factoryConnected: !!this._factory,
    bridgeConnected: !!this._bridge,
    orchestratorConnected: !!this._orchestrator
  };
};

function createBuilderAL(options) {
  return new BuilderAL(options);
}

export { BuilderAL, createBuilderAL, BUILDER_STATE };