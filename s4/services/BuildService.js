// s4/services/BuildService.js
// ALX Factory - Build Service
// Version: 1.0.0
// Build configuration and submission via m2 Orchestrator

var BUILD_TEMPLATE = {
  CALM:            "CALM",
  COMPONENT:       "COMPONENT",
  MODULE:          "MODULE",
  APPLICATION:     "APPLICATION",
  APPLICATION_WEB: "APPLICATION_WEB",
  LIBRARY:         "LIBRARY",
  CONFIG:          "CONFIG",
  TEST:            "TEST"
};

var TEMPLATE_DEFINITIONS = {
  CALM: {
    id: "CALM",
    name: "CALM Seed",
    description: "Basic code artifact with language model integration",
    icon: "🌱",
    defaultLanguage: "javascript",
    stages: ["validate", "synthesize", "build", "package"],
    requiredFields: ["name", "code"],
    optionalFields: ["description", "tags", "dependencies"],
    energyCost: 10
  },
  COMPONENT: {
    id: "COMPONENT",
    name: "UI Component",
    description: "Reusable user interface component",
    icon: "🧩",
    defaultLanguage: "javascript",
    stages: ["validate", "synthesize", "build", "test", "package"],
    requiredFields: ["name", "code"],
    optionalFields: ["props", "styles", "tests"],
    energyCost: 15
  },
  MODULE: {
    id: "MODULE",
    name: "Module",
    description: "Self-contained module with exports",
    icon: "📦",
    defaultLanguage: "javascript",
    stages: ["validate", "deps", "synthesize", "build", "test", "package"],
    requiredFields: ["name", "code", "exports"],
    optionalFields: ["dependencies", "tests"],
    energyCost: 20
  },
  APPLICATION: {
    id: "APPLICATION",
    name: "Application",
    description: "Full application with entry point",
    icon: "🚀",
    defaultLanguage: "javascript",
    stages: ["validate", "template", "deps", "synthesize", "build", "test", "security", "package"],
    requiredFields: ["name", "entryPoint"],
    optionalFields: ["config", "dependencies", "assets"],
    energyCost: 50
  },
  APPLICATION_WEB: {
    id: "APPLICATION_WEB",
    name: "Web Application",
    description: "Pure React DOM -sovellus — renderöitävissä suoraan LiveRenderView:ssa",
    icon: "🌐",
    defaultLanguage: "javascript",
    stages: ["validate", "template", "deps", "synthesize", "build", "test", "security", "package"],
    requiredFields: ["name", "entryPoint"],
    optionalFields: ["config", "dependencies", "features"],
    energyCost: 45
  },
  LIBRARY: {
    id: "LIBRARY",
    name: "Library",
    description: "Reusable library package",
    icon: "📚",
    defaultLanguage: "javascript",
    stages: ["validate", "deps", "synthesize", "build", "test", "package", "publish"],
    requiredFields: ["name", "version", "exports"],
    optionalFields: ["dependencies", "peerDependencies", "readme"],
    energyCost: 30
  },
  CONFIG: {
    id: "CONFIG",
    name: "Configuration",
    description: "Configuration or settings file",
    icon: "⚙️",
    defaultLanguage: "json",
    stages: ["validate", "synthesize", "package"],
    requiredFields: ["name", "config"],
    optionalFields: ["schema", "defaults"],
    energyCost: 5
  },
  TEST: {
    id: "TEST",
    name: "Test Suite",
    description: "Test cases and test utilities",
    icon: "🧪",
    defaultLanguage: "javascript",
    stages: ["validate", "synthesize", "build", "test"],
    requiredFields: ["name", "tests"],
    optionalFields: ["fixtures", "runtimes"],
    energyCost: 15
  }
};

var PATCH_OPERATION = {
  ADD: "add",
  REMOVE: "remove",
  REPLACE: "replace",
  MOVE: "move",
  COPY: "copy",
  TEST: "test"
};

function createBuildService(orchestrator) {

  function getTemplates() {
    return Object.values(TEMPLATE_DEFINITIONS);
  }

  function getTemplate(templateId) {
    return TEMPLATE_DEFINITIONS[templateId] || null;
  }

  function createBuildConfig(templateId, options) {
    var template = getTemplate(templateId);
    if (!template) {
      return null;
    }

    var opts = options || {};

    return {
      id: generateId(),
      templateId: templateId,
      template: template,
      name: opts.name || "Untitled",
      description: opts.description || "",
      language: opts.language || template.defaultLanguage,
      code: opts.code || "",
      files: opts.files || [],
      patches: opts.patches || [],
      dependencies: opts.dependencies || [],
      config: opts.config || {},
      metadata: opts.metadata || {},
      tags: opts.tags || [],
      createdAt: new Date().toISOString()
    };
  }

  function validateBuildConfig(config) {
    var errors = [];
    var failures = [];

    if (!config) {
      errors.push({ field: "config", message: "Build config is required" });
      return { valid: false, errors: errors, failures: failures };
    }

    var template = config.template || getTemplate(config.templateId);
    if (!template) {
      errors.push({ field: "templateId", message: "Invalid template" });
      return { valid: false, errors: errors, failures: failures };
    }

    template.requiredFields.forEach(function(field) {
      if (!config[field] && field !== "code") {
        errors.push({ field: field, message: field + " is required" });
      }
    });

    if (!config.name || config.name.trim() === "") {
      errors.push({ field: "name", message: "Name is required" });
    }

    if (template.requiredFields.indexOf("code") !== -1) {
      if (!config.code && (!config.files || config.files.length === 0)) {
        errors.push({ field: "code", message: "Code or files are required" });
      }
    }

    if (config.patches && config.patches.length > 0) {
      config.patches.forEach(function(patch, index) {
        var patchValidation = validatePatch(patch);
        if (!patchValidation.valid) {
          patchValidation.errors.forEach(function(err) {
            errors.push({
              field: "patches[" + index + "]." + err.field,
              message: err.message
            });
          });
        }
      });
    }

    if (config.dependencies && config.dependencies.length > 50) {
      failures.push({ field: "dependencies", message: "Large number of dependencies may slow down build" });
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      failures: failures
    };
  }

  function validatePatch(patch) {
    var errors = [];

    if (!patch.op) {
      errors.push({ field: "op", message: "Operation is required" });
    } else if (Object.values(PATCH_OPERATION).indexOf(patch.op) === -1) {
      errors.push({ field: "op", message: "Invalid operation: " + patch.op });
    }

    if (!patch.path) {
      errors.push({ field: "path", message: "Path is required" });
    }

    if (patch.op === PATCH_OPERATION.ADD || patch.op === PATCH_OPERATION.REPLACE) {
      if (patch.value === undefined) {
        errors.push({ field: "value", message: "Value is required for " + patch.op });
      }
    }

    if (patch.op === PATCH_OPERATION.MOVE || patch.op === PATCH_OPERATION.COPY) {
      if (!patch.from) {
        errors.push({ field: "from", message: "From path is required for " + patch.op });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  function createPatch(operation, path, value, from) {
    var patch = {
      id: generateId(),
      op: operation,
      path: path
    };

    if (value !== undefined) {
      patch.value = value;
    }

    if (from) {
      patch.from = from;
    }

    return patch;
  }

  async function submitBuild(config) {
    if (!orchestrator) {
      return { ok: false, error: "Orchestrator not available" };
    }

    var validation = validateBuildConfig(config);
    if (!validation.valid) {
      return {
        ok: false,
        error: "Validation failed",
        errors: validation.errors
      };
    }

    // Enterprise-templatet (APPLICATION, LIBRARY) käyttävät ProjectSpec-pipelinea.
    // Muut (CALM, COMPONENT, MODULE, CONFIG, TEST) käyttävät vanhaa worker-loopia.
    var ENTERPRISE_TEMPLATES = { APPLICATION: true, APPLICATION_WEB: true, LIBRARY: true };

    if (ENTERPRISE_TEMPLATES[config.templateId]) {
      return await _submitEnterpriseSpec(config);
    }

    // Vanha polku: teksti-komento → ALX → BuildSkill
    var buildCommand = formatBuildCommand(config);
    try {
      var result = await orchestrator.execute(buildCommand);
      return result;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ── Enterprise-build: BuildWizard → FactoryBridge.buildFromSpec ────────────
  // Rakentaa ProjectSpec-objektin ja kutsuu suoraan FactoryBridgeä.
  // Ei kierrä ALX/BuildSkill-reittiä — command intent on BUILD_PROJECT.

  async function _submitEnterpriseSpec(config) {
    var bridge = orchestrator.getFactoryBridge ? orchestrator.getFactoryBridge() : null;
    if (!bridge || !bridge.buildFromSpec) {
      // Fallback: vanha reitti jos bridge ei ole käytössä
      var cmd = formatBuildCommand(config);
      try { return await orchestrator.execute(cmd); }
      catch (e) { return { ok: false, error: e.message }; }
    }

    // Muodostetaan ProjectSpec BuildWizard-config-objektista
    var specTarget = config.templateId === "LIBRARY"         ? "node-service"
                   : config.templateId === "APPLICATION_WEB" ? "web-react"
                   : "expo-app";

    var patches = (config.patches || []).map(function(p) {
      return {
        op:    p.op    || "replace",
        path:  p.path  || "",
        value: p.value !== undefined ? p.value : ""
      };
    });

    var deps = (config.dependencies || []).map(function(d) {
      if (typeof d === "string") return { name: d, version: "latest" };
      return { name: d.name, version: d.version || "latest" };
    });

    var spec = {
      target:      specTarget,
      projectName: config.name || "untitled",
      version:     (config.config && config.config.version) || "1.0.0",
      stack:       (config.config && config.config.stack) || null,
      features:    (config.config && config.config.features) || [],
      constraints: (config.config && config.config.constraints) || {},
      patches:     patches,
      deps:        deps,
      metadata:    Object.assign({
        templateId:  config.templateId,
        description: config.description || "",
        language:    config.language || "javascript",
        tags:        config.tags || []
      }, config.metadata || {})
    };

    try {
      return await bridge.buildFromSpec(spec);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  function formatBuildCommand(config) {
    var parts = ["build"];

    if (config.templateId) {
      parts.push("--template=" + config.templateId);
    }

    if (config.name) {
      parts.push("--name=\"" + config.name + "\"");
    }

    if (config.language) {
      parts.push("--lang=" + config.language);
    }

    var command = parts.join(" ");

    if (config.code) {
      command += "\n```" + config.language + "\n" + config.code + "\n```";
    }

    if (config.patches && config.patches.length > 0) {
      command += "\n\n### Patches:\n```json\n" + JSON.stringify(config.patches, null, 2) + "\n```";
    }

    if (config.dependencies && config.dependencies.length > 0) {
      command += "\n\n### Dependencies:\n" + config.dependencies.map(function(d) {
        return "- " + (typeof d === "string" ? d : d.name + "@" + (d.version || "latest"));
      }).join("\n");
    }

    return command;
  }

  function estimateEnergy(config) {
    var template = config.template || getTemplate(config.templateId);
    var baseEnergy = template ? template.energyCost : 10;

    var codeSize = (config.code || "").length;
    var codeFactor = Math.ceil(codeSize / 1000) * 2;

    var depFactor = (config.dependencies || []).length * 1;

    var patchFactor = (config.patches || []).length * 1;

    var fileFactor = (config.files || []).length * 2;

    return baseEnergy + codeFactor + depFactor + patchFactor + fileFactor;
  }

  function estimateDuration(config) {
    var template = config.template || getTemplate(config.templateId);
    var stageCount = template ? template.stages.length : 4;

    var baseTime = stageCount * 2000;

    var codeSize = (config.code || "").length;
    var codeTime = Math.ceil(codeSize / 500) * 100;

    var depTime = (config.dependencies || []).length * 500;

    return baseTime + codeTime + depTime;
  }

  function generateId() {
    return Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 9);
  }

  return {
    getTemplates: getTemplates,
    getTemplate: getTemplate,
    createBuildConfig: createBuildConfig,
    validateBuildConfig: validateBuildConfig,
    validatePatch: validatePatch,
    createPatch: createPatch,
    submitBuild: submitBuild,
    formatBuildCommand: formatBuildCommand,
    estimateEnergy: estimateEnergy,
    estimateDuration: estimateDuration,
    BUILD_TEMPLATE: BUILD_TEMPLATE,
    TEMPLATE_DEFINITIONS: TEMPLATE_DEFINITIONS,
    PATCH_OPERATION: PATCH_OPERATION
  };
}

export {
  createBuildService,
  BUILD_TEMPLATE,
  TEMPLATE_DEFINITIONS,
  PATCH_OPERATION
};

export default createBuildService;