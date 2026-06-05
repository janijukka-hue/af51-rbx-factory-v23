// t3/Factory/pipeline/phases/security-phase.js
// KERROS: T3 – Tuotanto
// Pipeline-vaihe: npm audit + secret scan + blacklist.
// Lisää raportin context.addReport() → artifact.reports[] (ProjectArtifact 2.0)

import { BasePhase } from "../base-phase.js";

var SECURITY_PHASE_NAME = "SECURITY";

var SECRET_PATTERNS = [
  { name: "AWS Access Key",    pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "GitHub Token",      pattern: /ghp_[A-Za-z0-9]{36}/g },
  { name: "Stripe Secret Key", pattern: /sk_live_[A-Za-z0-9]{24,}/g },
  { name: "Private Key",       pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
  { name: "Password in code",  pattern: /password\s*[:=]\s*["'][^"']{6,}/gi },
  { name: "Generic API Key",   pattern: /api[_\-]?key\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}/gi },
  { name: "Firebase Key",      pattern: /AIza[A-Za-z0-9_\-]{35}/g }
];

var BLOCKED_PACKAGES = ["event-stream", "flatmap-stream", "crossenv", "babelcli"];

export class SecurityPhase extends BasePhase {

  constructor(options) {
    var opts = options || {};
    super(SECURITY_PHASE_NAME, opts);
    this._workspace       = opts.workspace       || null;
    this._runner          = opts.runner          || null;
    this._blockOnCritical = opts.blockOnCritical !== false;
    this._skipAudit       = opts.skipAudit       || false;
    this._skipSecrets     = opts.skipSecrets     || false;
  }

  canSkip() { return false; }

  async execute(context) {
    if (!this._workspace) throw new Error("SecurityPhase: workspace ei ole asetettu");

    var report = { ok: true, riskLevel: "LOW", audit: null, secrets: null, blocklist: null, failures: [] };

    // 1. npm audit
    if (!this._skipAudit && this._runner) {
      report.audit = this._runNpmAudit();
      if (report.audit.critical > 0) {
        report.ok = false; report.riskLevel = "CRITICAL";
        report.failures.push("npm audit löysi " + report.audit.critical + " kriittistä haavoittuvuutta");
      } else if (report.audit.high > 0) {
        report.riskLevel = "HIGH";
        report.failures.push("npm audit löysi " + report.audit.high + " korkean tason haavoittuvuutta");
      } else if (report.audit.moderate > 0) {
        report.riskLevel = "MEDIUM";
      }
    }

    // 2. Secret scan
    if (!this._skipSecrets) {
      report.secrets = this._scanSecrets();
      if (report.secrets.found.length > 0) {
        report.ok = false; report.riskLevel = "CRITICAL";
        report.failures.push("Secret scan löysi " + report.secrets.found.length + " mahdollista salaisuutta: " +
          report.secrets.found.map(function(f) { return f.name; }).join(", "));
      }
    }

    // 3. Blacklist
    report.blocklist = this._checkBlocklist();
    if (report.blocklist.found.length > 0) {
      report.ok = false; report.riskLevel = "CRITICAL";
      report.failures.push("Kiellettyjä paketteja löydetty: " + report.blocklist.found.join(", "));
    }

    // 4. Tallenna phaseResult + lisää context-raporttiin (ProjectArtifact 2.0)
    context.setPhaseResult(SECURITY_PHASE_NAME, report);
    context.addReport({
      phase:    SECURITY_PHASE_NAME,
      type:     "security",
      ok:       report.ok,
      data:     report,
      auditRef: null
    });

    this._emit("SECURITY:SCAN_COMPLETE", {
      ok: report.ok, riskLevel: report.riskLevel, failures: report.failures.length
    });

    // 5. Fail-fast kriittisissä löydöksissä
    if (!report.ok && this._blockOnCritical && report.riskLevel === "CRITICAL") {
      throw new Error("SecurityPhase: KRIITTISIÄ LÖYDÖKSIÄ — pipeline pysäytetty.\n" + report.failures.join("\n"));
    }

    return report;
  }

  // ── npm audit ────────────────────────────────────────────

  _runNpmAudit() {
    var cwd    = this._workspace.getRootDir();
    var result = this._runner.run("npm", ["audit", "--json", "--audit-level=none"], { cwd: cwd, label: "npm audit", timeout: 60000 });
    var out    = { ok: true, critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0, advisories: [] };
    try {
      var json = JSON.parse(result.stdout || "{}");
      if (json.metadata && json.metadata.vulnerabilities) {
        var v = json.metadata.vulnerabilities;
        out.critical = v.critical || 0;
        out.high     = v.high     || 0;
        out.moderate = v.moderate || 0;
        out.low      = v.low      || 0;
        out.info     = v.info     || 0;
        out.total    = v.total    || 0;
      }
      if (json.vulnerabilities) {
        Object.keys(json.vulnerabilities).forEach(function(name) {
          var vuln = json.vulnerabilities[name];
          out.advisories.push({ name: name, severity: vuln.severity });
        });
      }
    } catch (e) {
      out.parseError = true;
    }
    return out;
  }

  // ── Secret scan ─────────────────────────────────────────

  _scanSecrets() {
    var found   = [];
    var scanned = 0;
    var tree    = this._workspace.listTree("src");
    var exts    = { ".js": true, ".jsx": true, ".ts": true, ".tsx": true, ".json": true, ".env": true };
    var files   = tree.files || [];

    for (var i = 0; i < files.length; i++) {
      var f   = files[i];
      var dot = f.path.lastIndexOf(".");
      var ext = dot !== -1 ? f.path.slice(dot) : "";
      if (!exts[ext]) continue;
      if (f.path.indexOf("node_modules") !== -1) continue;

      var readResult = this._workspace.readFile(f.path);
      if (!readResult.ok) continue;
      scanned++;

      var content = readResult.content;
      for (var j = 0; j < SECRET_PATTERNS.length; j++) {
        var sp = SECRET_PATTERNS[j];
        sp.pattern.lastIndex = 0;
        if (sp.pattern.test(content)) {
          found.push({ name: sp.name, file: f.path });
          this._emit("SECURITY:SECRET_FOUND", { name: sp.name, file: f.path });
        }
      }
    }
    return { found: found, scanned: scanned };
  }

  // ── Blacklist ─────────────────────────────────────────────

  _checkBlocklist() {
    var found = [];
    var pkgR  = this._workspace.readFile("package.json");
    if (!pkgR.ok) return { found: found };
    var pkg;
    try { pkg = JSON.parse(pkgR.content); } catch (e) { return { found: found }; }
    var allDeps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
    Object.keys(allDeps).forEach(function(name) {
      if (BLOCKED_PACKAGES.indexOf(name) !== -1) found.push(name);
    });
    return { found: found };
  }
}

export function createSecurityPhase(options) {
  return new SecurityPhase(options || {});
}

export { SECURITY_PHASE_NAME, SECRET_PATTERNS, BLOCKED_PACKAGES };
export default SecurityPhase;