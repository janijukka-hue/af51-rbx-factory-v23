// k1/alx/utils/patterns.js
// Pattern Matching Utilities - Deterministic

export function matchPattern(tokens, pattern) {
  if (!tokens || !pattern) return { matched: false, score: 0 };
  
  const patternTokens = Array.isArray(pattern) ? pattern : pattern.split(" ");
  
  let matchCount = 0;
  let orderScore = 0;
  let lastIndex = -1;
  
  for (const pt of patternTokens) {
    const index = tokens.indexOf(pt.toLowerCase());
    if (index !== -1) {
      matchCount++;
      if (index > lastIndex) {
        orderScore++;
      }
      lastIndex = index;
    }
  }
  
  if (matchCount === 0) return { matched: false, score: 0 };
  
  const coverage = matchCount / patternTokens.length;
  const order = orderScore / patternTokens.length;
  const score = (coverage * 0.7) + (order * 0.3);
  
  return {
    matched: coverage >= 0.5,
    score,
    matchCount,
    coverage,
    order
  };
}

export function matchAny(tokens, patterns) {
  let best = { matched: false, score: 0, pattern: null };
  
  for (const pattern of patterns) {
    const result = matchPattern(tokens, pattern);
    if (result.score > best.score) {
      best = { ...result, pattern };
    }
  }
  
  return best;
}

export function matchAll(tokens, patterns) {
  return patterns.map(pattern => ({
    pattern,
    ...matchPattern(tokens, pattern)
  }));
}

export function extractParams(tokens, template) {
  const params = {};
  const templateTokens = template.split(" ");
  
  for (let i = 0; i < templateTokens.length; i++) {
    const tt = templateTokens[i];
    
    if (tt.startsWith("{") && tt.endsWith("}")) {
      const paramName = tt.slice(1, -1);
      
      if (i < tokens.length) {
        params[paramName] = tokens[i];
      }
    }
  }
  
  const remaining = tokens.filter(t => !templateTokens.includes(t));
  if (remaining.length > 0) {
    params._remaining = remaining;
  }
  
  return params;
}

export function createMatcher(patterns) {
  const compiled = patterns.map(p => ({
    pattern: p.pattern,
    tokens: p.pattern.toLowerCase().split(" "),
    intent: p.intent,
    priority: p.priority || 0
  }));
  
  compiled.sort((a, b) => b.priority - a.priority);
  
  return function match(tokens) {
    for (const entry of compiled) {
      const result = matchPattern(tokens, entry.tokens);
      if (result.matched && result.score >= 0.6) {
        return {
          intent: entry.intent,
          confidence: result.score,
          params: extractParams(tokens, entry.pattern)
        };
      }
    }
    return null;
  };
}

export default {
  matchPattern,
  matchAny,
  matchAll,
  extractParams,
  createMatcher
};