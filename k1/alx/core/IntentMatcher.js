// k1/alx/core/IntentMatcher.js
// Intent Matcher - Deterministic intent parsing
// Version: 2.1.0 - BUILD priority fix

import { createIntent, INTENT_CONFIDENCE } from "./types.js";
import { INTENT_PATTERNS, SYNONYMS, detectLanguage } from "../config/language.config.js";
import { matchPattern, extractParams } from "../utils/patterns.js";
import { hasCodeBlock } from "../utils/text.js";

var BUILD_TRIGGERS = ["build", "rakenna", "buildaa", "compile", "käännä"];
var ANALYZE_TRIGGERS = ["analyze", "analysoi", "tarkista", "check", "review"];

export class IntentMatcher {
  constructor(options) {
    if (!options) {
      options = {};
    }
    this._clock = options.clock;
    this._patterns = INTENT_PATTERNS.slice();
    this._synonyms = {};
    
    for (var key in SYNONYMS) {
      if (SYNONYMS.hasOwnProperty(key)) {
        this._synonyms[key] = SYNONYMS[key];
      }
    }
    
    this._customPatterns = [];
  }

  match(tokens, originalInput) {
    if (!tokens || tokens.length === 0) {
      return createIntent("EMPTY", 0);
    }
    
    var lowerInput = originalInput ? originalInput.toLowerCase() : "";
    var hasCode = originalInput && hasCodeBlock(originalInput);
    var language = detectLanguage(tokens);
    
    // 1. EXPLICIT BUILD CHECK - korkein prioriteetti
    if (this._hasBuildTrigger(tokens, lowerInput)) {
      
      return createIntent("BUILD", INTENT_CONFIDENCE.HIGH, {
        language: language,
        originalTokens: tokens,
        hasCode: hasCode
      });
    }
    
    // 2. EXPLICIT ANALYZE CHECK (koodi ilman build-sanaa)
    if (hasCode && this._hasAnalyzeTrigger(tokens, lowerInput)) {
      
      return createIntent("ANALYZE_CODE", INTENT_CONFIDENCE.HIGH, {
        language: language,
        originalTokens: tokens,
        hasCode: true
      });
    }
    
    // 3. Pelkkä koodilohko ilman komentoa → CODE_BLOCK
    if (hasCode) {
      
      return createIntent("CODE_BLOCK", INTENT_CONFIDENCE.MEDIUM, {
        language: language,
        originalTokens: tokens,
        hasCode: true
      });
    }
    
    // 4. Raaka koodi ilman backtickejä
    if (originalInput && this._looksLikeRawCode(originalInput)) {
      
      return createIntent("CODE_BLOCK", INTENT_CONFIDENCE.MEDIUM, {
        language: language,
        originalTokens: tokens,
        hasCode: true,
        rawCode: true
      });
    }
    
    // 5. Pattern matching muille intenteille
    var expanded = this._expandSynonyms(tokens);
    
    var bestMatch = null;
    var bestScore = 0;
    
    var allPatterns = this._patterns.concat(this._customPatterns);
    allPatterns.sort(function(a, b) {
      return (b.priority || 0) - (a.priority || 0);
    });
    
    for (var i = 0; i < allPatterns.length; i++) {
      var pattern = allPatterns[i];
      var result = matchPattern(expanded, pattern.pattern);
      
      if (result.matched) {
        var adjustedScore = result.score * (1 + (pattern.priority || 0) / 20);
        
        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestMatch = {
            intent: pattern.intent,
            pattern: pattern.pattern,
            params: extractParams(tokens, pattern.pattern)
          };
        }
      }
    }
    
    if (bestMatch && bestScore >= 0.5) {
      var confidence = this._scoreToConfidence(bestScore);
      
      return createIntent(bestMatch.intent, confidence, {
        pattern: bestMatch.pattern,
        params: bestMatch.params,
        language: language,
        originalTokens: tokens
      });
    }
    
    
    return createIntent("UNKNOWN", INTENT_CONFIDENCE.LOW, {
      language: language,
      originalTokens: tokens
    });
  }

  _hasBuildTrigger(tokens, lowerInput) {
    for (var i = 0; i < BUILD_TRIGGERS.length; i++) {
      var trigger = BUILD_TRIGGERS[i];
      
      if (tokens.indexOf(trigger) !== -1) {
        return true;
      }
      
      if (lowerInput.indexOf(trigger) !== -1) {
        return true;
      }
    }
    return false;
  }

  _hasAnalyzeTrigger(tokens, lowerInput) {
    for (var i = 0; i < ANALYZE_TRIGGERS.length; i++) {
      var trigger = ANALYZE_TRIGGERS[i];
      
      if (tokens.indexOf(trigger) !== -1) {
        return true;
      }
      
      if (lowerInput.indexOf(trigger) !== -1) {
        return true;
      }
    }
    return false;
  }

  _looksLikeRawCode(text) {
    if (!text || text.length < 20) return false;
    
    var codeIndicators = [
      /^(const|let|var|function|class|import|export)\s+/m,
      /=>\s*\{/,
      /\{\s*\n/,
      /;\s*\n/,
      /\)\s*\{/
    ];
    
    var matches = 0;
    for (var i = 0; i < codeIndicators.length; i++) {
      if (codeIndicators[i].test(text)) {
        matches++;
      }
    }
    
    return matches >= 2;
  }

  addPattern(pattern, intent, priority) {
    if (priority === undefined) {
      priority = 5;
    }
    this._customPatterns.push({ pattern: pattern, intent: intent, priority: priority });
  }

  removePattern(pattern) {
    this._customPatterns = this._customPatterns.filter(function(p) {
      return p.pattern !== pattern;
    });
  }

  addSynonym(word, synonyms) {
    if (!this._synonyms[word]) {
      this._synonyms[word] = [];
    }
    for (var i = 0; i < synonyms.length; i++) {
      this._synonyms[word].push(synonyms[i]);
    }
  }

  _expandSynonyms(tokens) {
    var expanded = {};
    var i;
    
    for (i = 0; i < tokens.length; i++) {
      expanded[tokens[i]] = true;
    }
    
    for (i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      
      for (var canonical in this._synonyms) {
        if (this._synonyms.hasOwnProperty(canonical)) {
          var syns = this._synonyms[canonical];
          
          if (syns.indexOf(token) !== -1) {
            expanded[canonical] = true;
          }
          
          if (token === canonical) {
            for (var j = 0; j < syns.length; j++) {
              expanded[syns[j]] = true;
            }
          }
        }
      }
    }
    
    return Object.keys(expanded);
  }

  _scoreToConfidence(score) {
    if (score >= 0.9) {
      return INTENT_CONFIDENCE.HIGH;
    }
    if (score >= 0.7) {
      return INTENT_CONFIDENCE.MEDIUM;
    }
    if (score >= 0.5) {
      return INTENT_CONFIDENCE.LOW;
    }
    return INTENT_CONFIDENCE.NONE;
  }

  getStats() {
    return {
      builtInPatterns: this._patterns.length,
      customPatterns: this._customPatterns.length,
      synonymGroups: Object.keys(this._synonyms).length
    };
  }
}

export function createIntentMatcher(options) {
  return new IntentMatcher(options);
}

export default IntentMatcher;