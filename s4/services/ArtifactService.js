// s4/services/ArtifactService.js
// ALX Factory - Artifact Service
// Version: 1.2.0
// - getArtifacts: käyttää lite normalizeArtifactMeta (querySeeds ei sisällä koodia)
// - getArtifact: käyttää getSeedDetails + normalizeArtifactFull (täysi data)
// - normalizeArtifactFull: fallbackaa lite-seedin fileCount/size kentille

import { Platform, Share } from "react-native";

var ARTIFACT_TYPE = {
  CALM: "CALM",
  COMPONENT: "COMPONENT",
  MODULE: "MODULE",
  APPLICATION: "APPLICATION",
  LIBRARY: "LIBRARY",
  CONFIG: "CONFIG",
  TEST: "TEST"
};

var FILE_TYPE = {
  JAVASCRIPT: "javascript",
  TYPESCRIPT: "typescript",
  JSON: "json",
  HTML: "html",
  CSS: "css",
  MARKDOWN: "markdown",
  TEXT: "text",
  BINARY: "binary"
};

var FILE_EXTENSIONS = {
  js: FILE_TYPE.JAVASCRIPT,
  mjs: FILE_TYPE.JAVASCRIPT,
  cjs: FILE_TYPE.JAVASCRIPT,
  ts: FILE_TYPE.TYPESCRIPT,
  tsx: FILE_TYPE.TYPESCRIPT,
  json: FILE_TYPE.JSON,
  html: FILE_TYPE.HTML,
  htm: FILE_TYPE.HTML,
  css: FILE_TYPE.CSS,
  scss: FILE_TYPE.CSS,
  md: FILE_TYPE.MARKDOWN,
  txt: FILE_TYPE.TEXT,
  log: FILE_TYPE.TEXT
};

function createArtifactService(orchestrator) {
  // Cache yksittäisille full-artifakteille (getSeedDetails-tulokset).
  // Listanäkymää ei cacheta — se on aina fresh querySeeds-tulos.
  var detailsCache = new Map();

  // -----------------------------------------------------------------------
  // getArtifacts — listanäkymä, vain metadata
  // querySeeds palauttaa jo lite-rakenteen, normalisoidaan listakorttia varten.
  // -----------------------------------------------------------------------
  async function getArtifacts(options) {
    var opts = options || {};
    var limit = opts.limit || 50;
    var offset = opts.offset || 0;
    var typeFilter = opts.type || null;
    var search = opts.search || null;

    if (!orchestrator || !orchestrator.querySeeds) {
      return [];
    }

    try {
      var seeds = await orchestrator.querySeeds({ limit: limit + offset });
      var slice = seeds.slice(offset, offset + limit);

      if (typeFilter) {
        slice = slice.filter(function(a) {
          return a.seedType === typeFilter || a.type === typeFilter;
        });
      }

      if (search) {
        var sl = search.toLowerCase();
        slice = slice.filter(function(a) {
          var name = (a.title || a.name || "").toLowerCase();
          var lang = (a.language || "").toLowerCase();
          return name.indexOf(sl) !== -1 || lang.indexOf(sl) !== -1;
        });
      }

      return slice.map(normalizeArtifactMeta);
    } catch (err) {
      console.error("[ArtifactService] getArtifacts error:", err);
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // getArtifact — detaljinakyma, täysi artifact
  // Kutsutaan VAIN ArtifactDetailsScreen / FileViewerScreen.
  // Käyttää orchestrator.getSeedDetails(id) → koko payload.
  // -----------------------------------------------------------------------
  async function getArtifact(id) {
    if (detailsCache.has(id)) {
      return detailsCache.get(id);
    }

    if (!orchestrator || typeof orchestrator.getSeedDetails !== "function") {
      console.warn("[ArtifactService] getSeedDetails ei saatavilla orchestratorissa");
      return null;
    }

    try {
      var result = await orchestrator.getSeedDetails(id);

      if (!result || !result.ok || !result.artifact) {
        console.warn("[ArtifactService] getSeedDetails: ei löydetty id:", id, result && result.error);
        return null;
      }

      var normalized = normalizeArtifactFull(result.artifact);
      detailsCache.set(id, normalized);
      return normalized;
    } catch (err) {
      console.error("[ArtifactService] getArtifact error:", err);
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // normalizeArtifactMeta
  // Kevyt normalisointi listanäkymää varten.
  // Syöte: lite seed {id, title, createdAt, energy, chaos, language, fileCount, size, tags}
  // EI sisällä: code, files, content
  // -----------------------------------------------------------------------
  function normalizeArtifactMeta(raw) {
    return {
      id: raw.id,
      name: raw.title || raw.name || "Untitled",
      title: raw.title || raw.name || "Untitled",
      description: raw.description || "",
      type: raw.seedType || raw.type || ARTIFACT_TYPE.CALM,
      language: raw.language || "javascript",
      // Koodikenttiä ei ole lite-seedissä — jätetään tyhjiksi
      code: "",
      files: [],
      // fileCount ja size luetaan suoraan lite-seedin metadatasta
      fileCount: raw.fileCount || 0,
      size: raw.size || 0,
      energy: raw.energy || 50,
      chaos: raw.chaos || 0,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      tags: raw.tags || [],
      metadata: raw.metadata || {}
    };
  }

  // -----------------------------------------------------------------------
  // normalizeArtifactFull
  // Täysi normalisointi — käytetään kun artifact on haettu getSeedDetails:llä.
  // Syöte: täysi artifact {id, code, files, language, ...}
  // Fallbackaa lite-seedin fileCount/size kentille jos files[] on tyhjä.
  // -----------------------------------------------------------------------
  function normalizeArtifactFull(raw) {
    var files = [];

    if (raw.code) {
      var ext = raw.language === "typescript" ? "ts" : "js";
      var mainName = raw.filename || ("index." + ext);
      files.push({
        id: "main",
        path: mainName,
        name: mainName,
        content: raw.code,
        size: raw.code.length,
        type: getFileType(mainName),
        language: raw.language || "javascript"
      });
    }

    if (raw.files && Array.isArray(raw.files)) {
      raw.files.forEach(function(f, idx) {
        var fname = f.name || f.path || ("file_" + idx);
        files.push({
          id: f.id || ("file_" + idx),
          path: f.path || fname,
          name: fname,
          content: f.content || "",
          size: f.size || (f.content ? f.content.length : 0),
          type: getFileType(f.path || fname),
          language: f.language || getLanguageFromPath(f.path || fname)
        });
      });
    }

    var calculatedSize = calculateTotalSize(files);

    return {
      id: raw.id,
      name: raw.name || raw.title || "Untitled",
      title: raw.title || raw.name || "Untitled",
      description: raw.description || "",
      type: raw.seedType || raw.type || ARTIFACT_TYPE.CALM,
      language: raw.language || "javascript",
      code: raw.code || "",
      files: files,
      // fileCount: prefer actual files, fall back to stored meta
      fileCount: files.length || raw.fileCount || 0,
      // size: prefer calculated from contents, fall back to stored meta
      size: calculatedSize || raw.size || 0,
      energy: raw.energy || 50,
      chaos: raw.chaos || 0,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      metadata: raw.metadata || {},
      buildId: raw.buildId || (raw.metadata ? raw.metadata.buildId : null),
      version: raw.version || "1.0.0",
      tags: raw.tags || [],
      dependencies: raw.dependencies || []
    };
  }

  // -----------------------------------------------------------------------
  // Apufunktiot
  // -----------------------------------------------------------------------

  function getFileType(filename) {
    if (!filename) return FILE_TYPE.TEXT;
    var ext = filename.split(".").pop().toLowerCase();
    return FILE_EXTENSIONS[ext] || FILE_TYPE.TEXT;
  }

  function getLanguageFromPath(path) {
    if (!path) return "text";
    var ext = path.split(".").pop().toLowerCase();
    var langMap = {
      js: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      ts: "typescript",
      tsx: "typescript",
      json: "json",
      html: "html",
      css: "css",
      md: "markdown"
    };
    return langMap[ext] || "text";
  }

  function calculateTotalSize(files) {
    return files.reduce(function(total, file) {
      return total + (file.size || 0);
    }, 0);
  }

  function getFile(artifact, fileId) {
    if (!artifact || !artifact.files) return null;
    return artifact.files.find(function(f) {
      return f.id === fileId || f.path === fileId;
    }) || null;
  }

  // -----------------------------------------------------------------------
  // Export / Share / Download
  // -----------------------------------------------------------------------

  async function exportArtifact(artifact, format) {
    var fmt = format || "json";

    if (fmt === "json") {
      return JSON.stringify(artifact, null, 2);
    }

    if (fmt === "code") {
      if (artifact.files && artifact.files.length > 0) {
        return artifact.files.map(function(f) {
          return "// === " + f.path + " ===\n" + f.content;
        }).join("\n\n");
      }
      return artifact.code || "";
    }

    if (fmt === "markdown") {
      var md = "# " + artifact.title + "\n\n";
      md += "**Type:** " + artifact.type + "\n";
      md += "**Language:** " + artifact.language + "\n";
      md += "**Created:** " + artifact.createdAt + "\n\n";
      if (artifact.description) {
        md += "## Description\n\n" + artifact.description + "\n\n";
      }
      md += "## Files\n\n";
      artifact.files.forEach(function(f) {
        md += "### " + f.path + "\n\n```" + f.language + "\n" + f.content + "\n```\n\n";
      });
      return md;
    }

    return JSON.stringify(artifact, null, 2);
  }

  async function shareArtifact(artifact) {
    var content = await exportArtifact(artifact, "code");

    if (Platform.OS === "web") {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(content);
        return { success: true, method: "clipboard" };
      }
      return { success: false, error: "Clipboard not available" };
    }

    try {
      var result = await Share.share({ message: content, title: artifact.title });
      return { success: result.action !== Share.dismissedAction, method: "share" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function copyToClipboard(content) {
    if (Platform.OS === "web") {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(content);
        return true;
      }
      return false;
    }
    try {
      await Share.share({ message: content });
      return true;
    } catch (err) {
      return false;
    }
  }

  async function downloadArtifact(artifact, filename) {
    var content = await exportArtifact(artifact, "json");
    var fname = filename || (artifact.name + ".json");

    if (Platform.OS === "web") {
      var blob = new Blob([content], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }

    return shareArtifact(artifact);
  }

  function clearCache() {
    detailsCache.clear();
  }

  return {
    getArtifacts: getArtifacts,
    getArtifact: getArtifact,
    getFile: getFile,
    exportArtifact: exportArtifact,
    shareArtifact: shareArtifact,
    copyToClipboard: copyToClipboard,
    downloadArtifact: downloadArtifact,
    clearCache: clearCache,
    // normalizeArtifact on aliaksena normalizeArtifactFull —
    // käytetään ArtifactBrowserScreenissä lite-seedeille (koodi puuttuu, se on ok).
    normalizeArtifact: normalizeArtifactFull,
    ARTIFACT_TYPE: ARTIFACT_TYPE,
    FILE_TYPE: FILE_TYPE
  };
}

export { createArtifactService, ARTIFACT_TYPE, FILE_TYPE, FILE_EXTENSIONS };
export default createArtifactService;