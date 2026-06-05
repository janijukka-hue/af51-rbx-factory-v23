// k1/alx/utils/scoring.js
// Scoring Utilities - Deterministic Metrics

export function calculateComplexity(code) {
  if (!code) return { score: 0, level: "NONE" };
  
  let complexity = 1;
  
  const patterns = [
    { regex: /if\s*\(/g, weight: 1 },
    { regex: /else\s+if\s*\(/g, weight: 1 },
    { regex: /else\s*{/g, weight: 1 },
    { regex: /for\s*\(/g, weight: 1 },
    { regex: /while\s*\(/g, weight: 1 },
    { regex: /switch\s*\(/g, weight: 1 },
    { regex: /case\s+/g, weight: 1 },
    { regex: /\?\s*[^:]+:/g, weight: 1 },
    { regex: /&&/g, weight: 1 },
    { regex: /\|\|/g, weight: 1 },
    { regex: /catch\s*\(/g, weight: 1 },
    { regex: /try\s*{/g, weight: 1 }
  ];
  
  for (const pattern of patterns) {
    const matches = code.match(pattern.regex);
    if (matches) {
      complexity += matches.length * pattern.weight;
    }
  }
  
  let level;
  if (complexity <= 5) level = "LOW";
  else if (complexity <= 10) level = "MEDIUM";
  else if (complexity <= 20) level = "HIGH";
  else level = "VERY_HIGH";
  
  return { score: complexity, level };
}

export function calculateRisk(code) {
  if (!code) return { score: 0, level: "NONE", findings: [] };
  
  const findings = [];
  let score = 0;
  
  const risks = [
    { pattern: /eval\s*\(/g, severity: 10, name: "EVAL_USAGE" },
    { pattern: /new\s+Function\s*\(/g, severity: 10, name: "FUNCTION_CONSTRUCTOR" },
    { pattern: /innerHTML\s*=/g, severity: 7, name: "INNERHTML_ASSIGNMENT" },
    { pattern: /dangerouslySetInnerHTML/g, severity: 6, name: "DANGEROUS_HTML" },
    { pattern: /document\.write\s*\(/g, severity: 5, name: "DOCUMENT_WRITE" },
    { pattern: /(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]+['"]/gi, severity: 9, name: "HARDCODED_SECRET" },
    { pattern: /http:\/\/(?!localhost)/g, severity: 3, name: "INSECURE_HTTP" },
    { pattern: /console\.(log|debug|info)\s*\(/g, severity: 1, name: "CONSOLE_STATEMENT" },
    { pattern: /debugger\s*;?/g, severity: 4, name: "DEBUGGER_STATEMENT" },
    { pattern: /TODO|FIXME|HACK|XXX/g, severity: 1, name: "TODO_COMMENT" }
  ];
  
  for (const risk of risks) {
    const matches = code.match(risk.pattern);
    if (matches) {
      score += matches.length * risk.severity;
      findings.push({
        name: risk.name,
        count: matches.length,
        severity: risk.severity
      });
    }
  }
  
  let level;
  if (score === 0) level = "NONE";
  else if (score <= 5) level = "LOW";
  else if (score <= 15) level = "MEDIUM";
  else if (score <= 30) level = "HIGH";
  else level = "CRITICAL";
  
  return { score, level, findings };
}

export function calculateCoverage(source, tests) {
  const sourceFunctions = (source.match(/function\s+\w+/g) || []).length;
  const sourceClasses = (source.match(/class\s+\w+/g) || []).length;
  
  const testFunctions = (tests.match(/test\s*\(|it\s*\(|describe\s*\(/g) || []).length;
  const assertions = (tests.match(/expect\s*\(|assert\s*\./g) || []).length;
  
  const totalUnits = sourceFunctions + sourceClasses;
  const coverage = totalUnits > 0 ? Math.min(1, testFunctions / totalUnits) : 0;
  
  return {
    sourceFunctions,
    sourceClasses,
    testFunctions,
    assertions,
    coverage: Math.round(coverage * 100)
  };
}

export function calculateQuality(metrics) {
  const weights = {
    complexity: 0.3,
    risk: 0.3,
    coverage: 0.2,
    structure: 0.2
  };
  
  let score = 100;
  
  if (metrics.complexity) {
    const penalty = Math.min(30, metrics.complexity.score * 1.5);
    score -= penalty * weights.complexity;
  }
  
  if (metrics.risk) {
    const penalty = Math.min(30, metrics.risk.score);
    score -= penalty * weights.risk;
  }
  
  if (metrics.coverage !== undefined) {
    const bonus = (metrics.coverage / 100) * 20;
    score += bonus * weights.coverage;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default {
  calculateComplexity,
  calculateRisk,
  calculateCoverage,
  calculateQuality
};