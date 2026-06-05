// t3/Factory/workers/security-scanner-worker.js
// Security Scanner Worker - Turvallisuustarkistukset

import { BaseWorker } from "./base-worker.js";

export class SecurityScannerWorker extends BaseWorker {
  constructor(options = {}) {
    super({ ...options, name: "SecurityScanner" });
    this._patterns = this._defaultPatterns();
  }

  _defaultPatterns() {
    return [
      { id: "xss-innerHTML", pattern: /innerHTML\s*=/, severity: "high", message: "Potential XSS via innerHTML" },
      { id: "xss-dangerously", pattern: /dangerouslySetInnerHTML/, severity: "medium", message: "dangerouslySetInnerHTML usage" },
      { id: "sql-injection", pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/i, severity: "high", message: "Potential SQL injection" },
      { id: "hardcoded-secret", pattern: /(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]+['"]/i, severity: "critical", message: "Hardcoded secret detected" },
      { id: "unsafe-eval", pattern: /eval\s*\(|new\s+Function\s*\(/, severity: "high", message: "Unsafe eval/Function usage" },
      { id: "http-link", pattern: /http:\/\/(?!localhost)/, severity: "low", message: "Non-HTTPS URL found" }
    ];
  }

  async scan(files) {
    return await this._runTask("scan", async () => {
      const findings = [];
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;

      for (const file of files) {
        const content = file.content || "";
        
        for (const pattern of this._patterns) {
          if (new RegExp(pattern.pattern).test(content)) {
            findings.push({
              file: file.path,
              rule: pattern.id,
              severity: pattern.severity,
              message: pattern.message
            });

            switch (pattern.severity) {
              case "critical": criticalCount++; break;
              case "high": highCount++; break;
              case "medium": mediumCount++; break;
              case "low": lowCount++; break;
            }
          }
        }
      }

      const passed = criticalCount === 0 && highCount === 0;

      return {
        ok: true,
        passed,
        findings,
        summary: {
          total: findings.length,
          critical: criticalCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount
        }
      };
    });
  }
}

export function createSecurityScannerWorker(options) {
  return new SecurityScannerWorker(options);
}

export default SecurityScannerWorker;