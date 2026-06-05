// s4/services/api.js
// ALX Factory - API Service
// Version: 1.0.0
// NOTE: s4 communicates ONLY with m2 (Orchestrator)
// s4 does NOT access t3 (Factory) directly

var API = {
  execute: async function(orchestrator, input, context) {
    if (!orchestrator) {
      return { ok: false, error: "Orchestrator not available" };
    }

    try {
      var result = await orchestrator.execute(input, context || {});
      return result;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  getStatus: function(orchestrator) {
    if (!orchestrator) {
      return null;
    }

    try {
      return orchestrator.getStatus ? orchestrator.getStatus() : null;
    } catch (err) {
      console.error("[API] getStatus error:", err);
      return null;
    }
  },

  querySeeds: async function(orchestrator, options) {
    if (!orchestrator || !orchestrator.querySeeds) {
      return [];
    }

    try {
      return await orchestrator.querySeeds(options || {});
    } catch (err) {
      console.error("[API] querySeeds error:", err);
      return [];
    }
  },

  queryMemory: async function(orchestrator, store, options) {
    if (!orchestrator || !orchestrator.queryMemory) {
      return [];
    }

    try {
      return await orchestrator.queryMemory(store, options || {});
    } catch (err) {
      console.error("[API] queryMemory error:", err);
      return [];
    }
  },

  getSuggestions: function(orchestrator, context) {
    if (!orchestrator || !orchestrator.getSuggestions) {
      return [];
    }

    try {
      return orchestrator.getSuggestions(context || {});
    } catch (err) {
      console.error("[API] getSuggestions error:", err);
      return [];
    }
  },

  getSkills: function(orchestrator) {
    if (!orchestrator || !orchestrator.getAllSkills) {
      return [];
    }

    try {
      return orchestrator.getAllSkills();
    } catch (err) {
      console.error("[API] getSkills error:", err);
      return [];
    }
  },

  subscribe: function(orchestrator, eventType, callback) {
    if (!orchestrator || typeof orchestrator.on !== "function") {
      return function() {};
    }

    try {
      return orchestrator.on(eventType, callback);
    } catch (err) {
      console.error("[API] subscribe error:", err);
      return function() {};
    }
  }
};

export { API };
export default API;