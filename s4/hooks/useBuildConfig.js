// s4/hooks/useBuildConfig.js
// ALX Factory - Build Config Hook
// Version: 1.0.0

import { useState, useCallback, useRef, useEffect } from "react";
import { createBuildService, BUILD_TEMPLATE, PATCH_OPERATION } from "../services/BuildService.js";

function useBuildConfig(orchestrator, initialTemplate) {
  var buildServiceRef = useRef(null);

  var configState = useState(null);
  var config = configState[0];
  var setConfig = configState[1];

  var validationState = useState({ valid: true, errors: [], failures: [] });
  var validation = validationState[0];
  var setValidation = validationState[1];

  var submittingState = useState(false);
  var submitting = submittingState[0];
  var setSubmitting = submittingState[1];

  var resultState = useState(null);
  var result = resultState[0];
  var setResult = resultState[1];

  useEffect(function() {
    buildServiceRef.current = createBuildService(orchestrator);

    if (initialTemplate) {
      var initial = buildServiceRef.current.createBuildConfig(initialTemplate);
      setConfig(initial);
    }
  }, [orchestrator, initialTemplate, setConfig]);

  var selectTemplate = useCallback(function(templateId) {
    if (!buildServiceRef.current) return;

    var newConfig = buildServiceRef.current.createBuildConfig(templateId);
    setConfig(newConfig);
    setValidation({ valid: true, errors: [], failures: [] });
    setResult(null);
  }, [setConfig, setValidation, setResult]);

  var updateConfig = useCallback(function(updates) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  }, [setConfig]);

  var setName = useCallback(function(name) {
    updateConfig({ name: name });
  }, [updateConfig]);

  var setDescription = useCallback(function(description) {
    updateConfig({ description: description });
  }, [updateConfig]);

  var setLanguage = useCallback(function(language) {
    updateConfig({ language: language });
  }, [updateConfig]);

  var setCode = useCallback(function(code) {
    updateConfig({ code: code });
  }, [updateConfig]);

  var addFile = useCallback(function(file) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        files: prev.files.concat([{
          id: Date.now().toString(),
          ...file
        }])
      };
    });
  }, [setConfig]);

  var updateFile = useCallback(function(fileId, updates) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        files: prev.files.map(function(f) {
          return f.id === fileId ? { ...f, ...updates } : f;
        })
      };
    });
  }, [setConfig]);

  var removeFile = useCallback(function(fileId) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        files: prev.files.filter(function(f) {
          return f.id !== fileId;
        })
      };
    });
  }, [setConfig]);

  var addPatch = useCallback(function(operation, path, value, from) {
    if (!buildServiceRef.current) return;

    var patch = buildServiceRef.current.createPatch(operation, path, value, from);

    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        patches: prev.patches.concat([patch])
      };
    });

    return patch;
  }, [setConfig]);

  var updatePatch = useCallback(function(patchId, updates) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        patches: prev.patches.map(function(p) {
          return p.id === patchId ? { ...p, ...updates } : p;
        })
      };
    });
  }, [setConfig]);

  var removePatch = useCallback(function(patchId) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        patches: prev.patches.filter(function(p) {
          return p.id !== patchId;
        })
      };
    });
  }, [setConfig]);

  var reorderPatches = useCallback(function(fromIndex, toIndex) {
    setConfig(function(prev) {
      if (!prev) return prev;

      var patches = prev.patches.slice();
      var moved = patches.splice(fromIndex, 1)[0];
      patches.splice(toIndex, 0, moved);

      return { ...prev, patches: patches };
    });
  }, [setConfig]);

  var addDependency = useCallback(function(dependency) {
    setConfig(function(prev) {
      if (!prev) return prev;

      var dep = typeof dependency === "string"
        ? { name: dependency, version: "latest" }
        : dependency;

      var exists = prev.dependencies.some(function(d) {
        return d.name === dep.name;
      });

      if (exists) return prev;

      return {
        ...prev,
        dependencies: prev.dependencies.concat([dep])
      };
    });
  }, [setConfig]);

  var updateDependency = useCallback(function(name, version) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        dependencies: prev.dependencies.map(function(d) {
          return d.name === name ? { ...d, version: version } : d;
        })
      };
    });
  }, [setConfig]);

  var removeDependency = useCallback(function(name) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        dependencies: prev.dependencies.filter(function(d) {
          return d.name !== name;
        })
      };
    });
  }, [setConfig]);

  var addTag = useCallback(function(tag) {
    setConfig(function(prev) {
      if (!prev) return prev;
      if (prev.tags.indexOf(tag) !== -1) return prev;
      return { ...prev, tags: prev.tags.concat([tag]) };
    });
  }, [setConfig]);

  var removeTag = useCallback(function(tag) {
    setConfig(function(prev) {
      if (!prev) return prev;
      return {
        ...prev,
        tags: prev.tags.filter(function(t) {
          return t !== tag;
        })
      };
    });
  }, [setConfig]);

  var validate = useCallback(function() {
    if (!buildServiceRef.current || !config) {
      return { valid: false, errors: [{ field: "config", message: "No config" }], failures: [] };
    }

    var result = buildServiceRef.current.validateBuildConfig(config);
    setValidation(result);
    return result;
  }, [config, setValidation]);

  var submit = useCallback(async function() {
    if (!buildServiceRef.current || !config) {
      return { ok: false, error: "No config" };
    }

    var validationResult = validate();
    if (!validationResult.valid) {
      return { ok: false, error: "Validation failed", errors: validationResult.errors };
    }

    setSubmitting(true);
    setResult(null);

    try {
      var buildResult = await buildServiceRef.current.submitBuild(config);
      setResult(buildResult);
      setSubmitting(false);
      return buildResult;
    } catch (err) {
      var errorResult = { ok: false, error: err.message };
      setResult(errorResult);
      setSubmitting(false);
      return errorResult;
    }
  }, [config, validate, setSubmitting, setResult]);

  var reset = useCallback(function() {
    setConfig(null);
    setValidation({ valid: true, errors: [], failures: [] });
    setResult(null);
  }, [setConfig, setValidation, setResult]);

  var getEstimates = useCallback(function() {
    if (!buildServiceRef.current || !config) {
      return { energy: 0, duration: 0 };
    }

    return {
      energy: buildServiceRef.current.estimateEnergy(config),
      duration: buildServiceRef.current.estimateDuration(config)
    };
  }, [config]);

  var getPreviewCommand = useCallback(function() {
    if (!buildServiceRef.current || !config) {
      return "";
    }

    return buildServiceRef.current.formatBuildCommand(config);
  }, [config]);

  return {
    config: config,
    validation: validation,
    submitting: submitting,
    result: result,
    selectTemplate: selectTemplate,
    updateConfig: updateConfig,
    setName: setName,
    setDescription: setDescription,
    setLanguage: setLanguage,
    setCode: setCode,
    addFile: addFile,
    updateFile: updateFile,
    removeFile: removeFile,
    addPatch: addPatch,
    updatePatch: updatePatch,
    removePatch: removePatch,
    reorderPatches: reorderPatches,
    addDependency: addDependency,
    updateDependency: updateDependency,
    removeDependency: removeDependency,
    addTag: addTag,
    removeTag: removeTag,
    validate: validate,
    submit: submit,
    reset: reset,
    getEstimates: getEstimates,
    getPreviewCommand: getPreviewCommand,
    templates: buildServiceRef.current ? buildServiceRef.current.getTemplates() : [],
    BUILD_TEMPLATE: BUILD_TEMPLATE,
    PATCH_OPERATION: PATCH_OPERATION
  };
}

export { useBuildConfig };
export default useBuildConfig;