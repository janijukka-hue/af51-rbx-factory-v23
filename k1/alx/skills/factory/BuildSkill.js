// k1/alx/skills/factory/BuildSkill.js
// Build Skill - Trigger factory builds
// Version: 2.4.0 - Smart code detection

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";

var CODE_INDICATORS = [
  /^(const|let|var|function|class|import|export)\s+/m,
  /=>\s*[\{\(]/,
  /function\s*\w*\s*\(/,
  /\{\s*\n/,
  /;\s*\n/,
  /\)\s*\{/,
  /export\s+default/,
  /import\s+.*from/,
  /React\./,
  /useState|useEffect|useCallback|useMemo/,
  /StyleSheet\.create/,
  /<\w+[^>]*>/
];

function looksLikeCode(text) {
  if (!text || text.length < 20) return false;
  
  var matches = 0;
  for (var i = 0; i < CODE_INDICATORS.length; i++) {
    if (CODE_INDICATORS[i].test(text)) {
      matches++;
    }
  }
  
  return matches >= 2;
}

function looksLikeCodeLine(line) {
  if (!line) return false;
  var trimmed = line.trim();
  
  return /^(import|export|const|let|var|function|class|return|if|else|for|while|switch|case|try|catch|\/\/|\/\*|\*|}\s*$|{\s*$|\);?\s*$)/.test(trimmed) ||
         /[=:;{}\[\]()]/.test(trimmed);
}

function detectLanguage(code) {
  if (!code) return "javascript";
  
  if (code.indexOf("import React") !== -1 || 
      code.indexOf("from 'react'") !== -1 ||
      code.indexOf("from \"react\"") !== -1 ||
      code.indexOf("useState") !== -1 ||
      code.indexOf("StyleSheet.create") !== -1) {
    return "jsx";
  }
  
  if (code.indexOf("<!DOCTYPE") !== -1 || code.indexOf("<html") !== -1) {
    return "html";
  }
  
  if (code.indexOf(": string") !== -1 || 
      code.indexOf(": number") !== -1 ||
      code.indexOf("interface ") !== -1 ||
      code.indexOf(": React.FC") !== -1) {
    return "typescript";
  }
  
  if (code.indexOf("def ") !== -1 && code.indexOf("self") !== -1) {
    return "python";
  }
  
  return "javascript";
}

function extractCodeBlocksFromInput(input) {
  if (!input) return [];
  
  var blocks = [];
  
  var fenceRegex = /```(\w*)\n?([\s\S]*?)```/g;
  var match;
  
  while ((match = fenceRegex.exec(input)) !== null) {
    var lang = match[1] || "javascript";
    var code = match[2].trim();
    
    if (code.length > 0) {
      blocks.push({
        language: lang,
        code: code
      });
    }
  }
  
  if (blocks.length === 0) {
    // Strippaa komento useammalta riviltä — "build\nexport default..."
    var cleanedInput = input
      .replace(/^(build|rakenna|buildaa|compile)[\s\n]*/i, "")
      .trim();
    
    if (looksLikeCode(cleanedInput)) {
      var detectedLang = detectLanguage(cleanedInput);
      blocks.push({
        language: detectedLang,
        code: cleanedInput
      });
    }
  }
  
  // Poista "build"-sana koodin alusta myös jos se jäi mukaan
  for (var b = 0; b < blocks.length; b++) {
    blocks[b].code = blocks[b].code
      .replace(/^(build|rakenna|buildaa|compile)[\s\n]+/i, "")
      .trim();
  }
  
  if (blocks.length === 0) {
    var lines = input.split("\n");
    var codeLines = [];
    var inCode = false;
    
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      
      if (j === 0 && /^(build|rakenna|buildaa|compile)\s*/i.test(line)) {
        continue;
      }
      
      if (looksLikeCodeLine(line)) {
        inCode = true;
        codeLines.push(line);
      } else if (inCode && line.trim().length > 0) {
        codeLines.push(line);
      }
    }
    
    if (codeLines.length > 0) {
      var combinedCode = codeLines.join("\n").trim();
      if (combinedCode.length > 20) {
        blocks.push({
          language: detectLanguage(combinedCode),
          code: combinedCode
        });
      }
    }
  }
  
  return blocks;
}

export class BuildSkill {
  constructor(options) {
    if (!options) {
      options = {};
    }
    this.name = "build";
    this.description = "Build project through factory pipeline";
    this.category = SKILL_CATEGORY.FACTORY;
    this.aliases = ["rakenna", "buildaa", "compile", "kaanna"];
    this._factory = options.factory || null;
    this._bridge = options.bridge || null;
    this._alx = options.alx || null;
  }

  setFactory(factory) {
    this._factory = factory;
  }

  setBridge(bridge) {
    this._bridge = bridge;
  }

  setALX(alx) {
    this._alx = alx;
  }

  async execute(ctx) {
    
    
    if (!this._factory && !this._bridge) {
      return createSkillResult(false, {
        output: "Factory ei ole yhdistetty."
      });
    }
    
    var codeBlocks = extractCodeBlocksFromInput(ctx.input);
    
    
    if (codeBlocks.length === 0) {
      return createSkillResult(false, {
        output: "Koodia ei loytynyt. Syota koodi suoraan build-komennon jalkeen."
      });
    }
    
    var projectName = null;
    if (ctx.intent && ctx.intent.params && ctx.intent.params._remaining) {
      projectName = ctx.intent.params._remaining[0];
    }
    if (!projectName || projectName === "project" || projectName.length < 2) {
      projectName = "Build_" + Date.now();
    }
    
    var files = [];
    var combinedCode = "";
    
    for (var i = 0; i < codeBlocks.length; i++) {
      var block = codeBlocks[i];
      var lang = block.language || "js";
      var ext = lang === "jsx" ? "jsx" : lang === "typescript" ? "ts" : lang === "tsx" ? "tsx" : "js";
      
      files.push({
        path: "input/code_" + i + "." + ext,
        content: block.code,
        language: lang
      });
      
      if (i > 0) {
        combinedCode += "\n\n// ===================================\n\n";
      }
      combinedCode += "// File: code_" + i + "." + ext + "\n";
      combinedCode += block.code;
    }
    
    
    
    var result;
    
    try {
      if (this._bridge && this._bridge.build) {
        result = await this._bridge.build(files, { projectName: projectName });
      } else if (this._factory && this._factory.handleCommand) {
        result = await this._factory.handleCommand({
          intent: "BUILD",
          files: files,
          metadata: { projectName: projectName }
        });
      } else if (this._factory && this._factory.build) {
        result = await this._factory.build({
          files: files,
          metadata: { projectName: projectName }
        });
      } else {
        return createSkillResult(false, {
          output: "Factory ei tue build-komentoa"
        });
      }
    } catch (err) {
      console.error("[BuildSkill] Build error:", err);
      return createSkillResult(false, {
        output: "Build virhe: " + err.message
      });
    }
    
    if (result && result.ok) {
      await this._saveToMemory(result, projectName, files, combinedCode, codeBlocks, ctx);
      
      var langDisplay = codeBlocks[0].language || "js";
      
      return createSkillResult(true, {
        output: "Build valmis!\n" +
          "Projekti: " + projectName + "\n" +
          "Kieli: " + langDisplay + "\n" +
          "Build ID: " + (result.buildId || "-") + "\n" +
          "Kesto: " + (result.durationMs || 0) + "ms\n" +
          "Tiedostoja: " + files.length + "\n" +
          "Koodia: " + combinedCode.length + " merkkia\n" +
          "Katso Preview Roomista",
        metadata: result
      });
    }
    
    var errorMsg = result && result.error ? result.error : "Tuntematon virhe";
    
    return createSkillResult(false, {
      output: "Build epaonnistui: " + errorMsg,
      metadata: result
    });
  }

  async _saveToMemory(result, projectName, files, combinedCode, codeBlocks, ctx) {
    
    
    var writer = null;
    
    if (this._alx && typeof this._alx.commitCore === "function") {
      var alx = this._alx;
      writer = function(entry) {
        return alx.commitCore(entry);
      };
    }
    
    if (!writer && ctx && typeof ctx.coreWriter === "function") {
      writer = ctx.coreWriter;
    }
    
    if (!writer) {
      console.error("[BuildSkill] No writer available!");
      return { ok: false, error: "No writer" };
    }
    
    var primaryLanguage = "javascript";
    if (codeBlocks.length > 0 && codeBlocks[0].language) {
      primaryLanguage = codeBlocks[0].language;
    }
    
    var artifactId = result.buildId || ("artifact_" + Date.now());
    
    var artifact = {
      id: artifactId,
      name: projectName,
      projectName: projectName,
      type: "BUILD",
      seedType: "CALM",
      phase: "COMPLETED",
      owner: ctx.userId || "anonymous",
      creator: ctx.userId || "anonymous",
      createdAt: new Date().toISOString(),
      durationMs: result.durationMs || 0,
      fileCount: files.length,
      size: combinedCode.length,
      hash: artifactId,
      language: primaryLanguage,
      code: combinedCode,
      content: combinedCode,
      files: files,
      mp4Uri: null,
      posterUri: null,
      energy: 50,
      resonance: 0,
      chaos: 0
    };
    
    
    
    try {
      var writeResult = await writer({
        store: "episodic",
        content: {
          event: "FACTORY:BUILD:PUBLISHED",
          artifact: artifact,
          buildId: artifactId,
          projectName: projectName,
          code: combinedCode,
          language: primaryLanguage,
          files: files
        },
        tags: ["factory", "publish", "artifact", "build", "preview"],
        metadata: {
          buildId: artifactId,
          projectName: projectName,
          language: primaryLanguage,
          fileCount: files.length,
          codeSize: combinedCode.length
        }
      });
      
      
      return { ok: true, artifactId: artifactId };
      
    } catch (err) {
      console.error("[BuildSkill] Write error:", err);
      return { ok: false, error: err.message };
    }
  }

  help() {
    return "Rakenna projekti Factory-pipelinen lapi. Syota build ja koodi suoraan peraan.";
  }
}

export function createBuildSkill(options) {
  return new BuildSkill(options);
}

export default BuildSkill;