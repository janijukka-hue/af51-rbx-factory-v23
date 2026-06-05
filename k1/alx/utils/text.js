// k1/alx/utils/text.js
// Text Utilities - Deterministic

export function normalize(text) {
  if (!text) return "";
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export function truncate(text, maxLength) {
  if (!maxLength) maxLength = 100;
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function extractCodeBlocks(text) {
  if (!text || typeof text !== "string") {
    return [];
  }
  
  var blocks = [];
  
  // Pattern: ```language\ncode\n``` or ```code```
  var pattern = /```(\w*)\n?([\s\S]*?)```/g;
  var match;
  
  while ((match = pattern.exec(text)) !== null) {
    var language = match[1] || "javascript";
    var code = match[2];
    
    if (code && code.trim().length > 0) {
      blocks.push({
        language: language,
        code: code.trim(),
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }
  
  return blocks;
}

export function hasCodeBlock(text) {
  if (!text || typeof text !== "string") {
    return false;
  }
  return text.indexOf("```") !== -1;
}

export function stripCodeBlocks(text) {
  if (!text) return "";
  return text.replace(/```[\s\S]*?```/g, "[CODE]").trim();
}

export function countLines(text) {
  if (!text) return 0;
  return text.split("\n").length;
}

export function countWords(text) {
  if (!text) return 0;
  var words = text.trim().split(/\s+/).filter(function(w) { return w.length > 0; });
  return words.length;
}

export function extractNumbers(text) {
  if (!text) return [];
  var matches = text.match(/-?\d+\.?\d*/g);
  return matches ? matches.map(Number) : [];
}

export function extractUrls(text) {
  if (!text) return [];
  var pattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  return text.match(pattern) || [];
}

export function extractFilePaths(text) {
  if (!text) return [];
  var pattern = /(?:\/[\w.-]+)+\.\w+|[\w.-]+\.(?:js|ts|jsx|tsx|json|css|html|md|txt)/g;
  return text.match(pattern) || [];
}

export function levenshtein(a, b) {
  if (!a || a.length === 0) return b ? b.length : 0;
  if (!b || b.length === 0) return a.length;
  
  var matrix = [];
  var i, j;
  
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

export function fuzzyMatch(query, target, threshold) {
  if (threshold === undefined) threshold = 0.6;
  
  var q = normalize(query);
  var t = normalize(target);
  
  if (t.indexOf(q) !== -1) return { matched: true, score: 1 };
  if (q.indexOf(t) !== -1) return { matched: true, score: 0.9 };
  
  var maxLen = Math.max(q.length, t.length);
  var distance = levenshtein(q, t);
  var score = 1 - (distance / maxLen);
  
  return { matched: score >= threshold, score: score };
}

export default {
  normalize: normalize,
  truncate: truncate,
  extractCodeBlocks: extractCodeBlocks,
  hasCodeBlock: hasCodeBlock,
  stripCodeBlocks: stripCodeBlocks,
  countLines: countLines,
  countWords: countWords,
  extractNumbers: extractNumbers,
  extractUrls: extractUrls,
  extractFilePaths: extractFilePaths,
  levenshtein: levenshtein,
  fuzzyMatch: fuzzyMatch
};