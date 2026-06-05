// k1/alx/skills/code/CodeAnalyzeSkill.js
// Code Analyze Skill - Comprehensive code analysis

import { SKILL_CATEGORY, createSkillResult } from "../../core/types.js";
import { extractCodeBlocks } from "../../utils/text.js";
import { calculateComplexity, calculateRisk, calculateQuality } from "../../utils/scoring.js";

export class CodeAnalyzeSkill {
  constructor(options) {
    this.name = "code-analyze";
    this.description = "Analyze code structure, complexity and risks";
    this.category = SKILL_CATEGORY.CODE;
    this.aliases = ["analyze", "analysoi"];
  }

  async execute(ctx) {
    var input = ctx.input || "";
    
    
     // !== -1);
    
    var codeBlocks = extractCodeBlocks(input);
    
    
    
    if (codeBlocks.length === 0) {
      // Ei löytynyt koodilohkoja - ehkä käyttäjä antoi suoraan koodia?
      var trimmed = input.trim();
      
      // Tarkista näyttääkö koodi koodilta
      if (this._looksLikeCode(trimmed)) {
        codeBlocks = [{
          language: this._detectLanguage(trimmed),
          code: trimmed
        }];
        
      } else {
        return createSkillResult(false, {
          output: "Anna koodi analysoitavaksi.\n\nKäyttö:\n```javascript\nfunction example() {\n  return 42;\n}\n```\n\nTai liitä koodi suoraan (ilman ```merkkejä)."
        });
      }
    }
    
    var results = [];
    
    for (var i = 0; i < codeBlocks.length; i++) {
      var block = codeBlocks[i];
      
      
      var analysis = this._analyzeCode(block.code, block.language);
      results.push(analysis);
    }
    
    var lang = "fi";
    if (ctx.intent && ctx.intent.params && ctx.intent.params.language) {
      lang = ctx.intent.params.language;
    }
    
    var summary = this._formatSummary(results, lang);
    
    return createSkillResult(true, {
      output: summary,
      metadata: { analyses: results, blockCount: codeBlocks.length }
    });
  }

  _looksLikeCode(text) {
    if (!text || text.length < 10) return false;
    
    var codePatterns = [
      /function\s+\w+/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /class\s+\w+/,
      /import\s+.*from/,
      /export\s+(default\s+)?/,
      /if\s*\(.+\)\s*{/,
      /for\s*\(.+\)\s*{/,
      /while\s*\(.+\)\s*{/,
      /=>\s*{/,
      /return\s+/,
      /console\.\w+\(/,
      /<\w+[^>]*>/,
      /\{\s*\w+:\s*/
    ];
    
    for (var i = 0; i < codePatterns.length; i++) {
      if (codePatterns[i].test(text)) {
        return true;
      }
    }
    
    // Tarkista onko paljon erikoismerkkejä
    var specialChars = (text.match(/[{}\[\]();=<>]/g) || []).length;
    var ratio = specialChars / text.length;
    
    return ratio > 0.05;
  }

  _detectLanguage(code) {
    if (/<[a-zA-Z][^>]*>/.test(code)) {
      if (/className=/.test(code) || /onClick=/.test(code)) {
        return "jsx";
      }
      return "html";
    }
    
    if (/:\s*(string|number|boolean|any)\s*[;=,)]/.test(code)) {
      return "typescript";
    }
    
    if (/import\s+.*from\s+['"]/.test(code) || /export\s+/.test(code)) {
      return "javascript";
    }
    
    if (/function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+/.test(code)) {
      return "javascript";
    }
    
    return "text";
  }

  _analyzeCode(code, language) {
    var structure = this._analyzeStructure(code);
    var complexity = calculateComplexity(code);
    var risk = calculateRisk(code);
    var quality = calculateQuality({ complexity: complexity, risk: risk });
    
    return {
      language: language,
      structure: structure,
      complexity: complexity,
      risk: risk,
      quality: quality
    };
  }

  _analyzeStructure(code) {
    var lines = code.split("\n");
    var nonEmpty = lines.filter(function(l) { return l.trim().length > 0; });
    var comments = lines.filter(function(l) { 
      var trimmed = l.trim();
      return trimmed.indexOf("//") === 0 || trimmed.indexOf("/*") === 0; 
    });
    
    var funcMatches = code.match(/function\s+\w+|=>\s*\{|\w+\s*\([^)]*\)\s*\{/g);
    var functions = funcMatches ? funcMatches.length : 0;
    
    var classMatches = code.match(/class\s+\w+/g);
    var classes = classMatches ? classMatches.length : 0;
    
    var importMatches = code.match(/import\s+/g);
    var imports = importMatches ? importMatches.length : 0;
    
    var exportMatches = code.match(/export\s+/g);
    var exports = exportMatches ? exportMatches.length : 0;
    
    return {
      totalLines: lines.length,
      codeLines: nonEmpty.length - comments.length,
      commentLines: comments.length,
      blankLines: lines.length - nonEmpty.length,
      functions: functions,
      classes: classes,
      imports: imports,
      exports: exports
    };
  }

  _formatSummary(results, lang) {
    if (results.length === 0) {
      return "Ei analysoitavaa koodia.";
    }
    
    var r = results[0];
    var output;
    
    if (lang === "fi") {
      output = "📊 KOODIANALYYSI\n";
      output += "═══════════════════════════════════\n\n";
      
      output += "📁 RAKENNE:\n";
      output += "   Rivejä: " + r.structure.totalLines + " (koodi: " + r.structure.codeLines + ", kommentit: " + r.structure.commentLines + ")\n";
      output += "   Funktiot: " + r.structure.functions + "\n";
      output += "   Luokat: " + r.structure.classes + "\n";
      output += "   Importit: " + r.structure.imports + "\n";
      output += "   Exportit: " + r.structure.exports + "\n\n";
      
      output += "🔄 KOMPLEKSISUUS:\n";
      output += "   Pisteet: " + r.complexity.score + "\n";
      output += "   Taso: " + this._getLevelEmoji(r.complexity.level) + " " + r.complexity.level + "\n\n";
      
      output += "⚠️ RISKIT:\n";
      output += "   Pisteet: " + r.risk.score + "\n";
      output += "   Taso: " + this._getRiskEmoji(r.risk.level) + " " + r.risk.level + "\n";
      
      if (r.risk.findings.length > 0) {
        output += "   Löydökset:\n";
        for (var i = 0; i < r.risk.findings.length; i++) {
          var f = r.risk.findings[i];
          output += "   • " + f.name + " (×" + f.count + ")\n";
        }
      } else {
        output += "   ✓ Ei löydöksiä\n";
      }
      
      output += "\n═══════════════════════════════════\n";
      output += "⭐ LAATU: " + r.quality + "/100";
      
    } else {
      output = "📊 CODE ANALYSIS\n";
      output += "═══════════════════════════════════\n\n";
      
      output += "📁 STRUCTURE:\n";
      output += "   Lines: " + r.structure.totalLines + " (code: " + r.structure.codeLines + ", comments: " + r.structure.commentLines + ")\n";
      output += "   Functions: " + r.structure.functions + "\n";
      output += "   Classes: " + r.structure.classes + "\n";
      output += "   Imports: " + r.structure.imports + "\n";
      output += "   Exports: " + r.structure.exports + "\n\n";
      
      output += "🔄 COMPLEXITY:\n";
      output += "   Score: " + r.complexity.score + "\n";
      output += "   Level: " + this._getLevelEmoji(r.complexity.level) + " " + r.complexity.level + "\n\n";
      
      output += "⚠️ RISKS:\n";
      output += "   Score: " + r.risk.score + "\n";
      output += "   Level: " + this._getRiskEmoji(r.risk.level) + " " + r.risk.level + "\n";
      
      if (r.risk.findings.length > 0) {
        output += "   Findings:\n";
        for (var j = 0; j < r.risk.findings.length; j++) {
          var finding = r.risk.findings[j];
          output += "   • " + finding.name + " (×" + finding.count + ")\n";
        }
      } else {
        output += "   ✓ No findings\n";
      }
      
      output += "\n═══════════════════════════════════\n";
      output += "⭐ QUALITY: " + r.quality + "/100";
    }
    
    return output;
  }

  _getLevelEmoji(level) {
    if (level === "LOW") return "🟢";
    if (level === "MEDIUM") return "🟡";
    if (level === "HIGH") return "🟠";
    if (level === "VERY_HIGH") return "🔴";
    return "⚪";
  }

  _getRiskEmoji(level) {
    if (level === "NONE") return "✅";
    if (level === "LOW") return "🟢";
    if (level === "MEDIUM") return "🟡";
    if (level === "HIGH") return "🟠";
    if (level === "CRITICAL") return "🔴";
    return "⚪";
  }

  help() {
    return "Analysoi koodin rakenteen, kompleksisuuden ja riskit.\n\nKäyttö:\n```javascript\nkoodi tähän\n```";
  }
}

export function createCodeAnalyzeSkill(options) {
  return new CodeAnalyzeSkill(options);
}

export default CodeAnalyzeSkill;