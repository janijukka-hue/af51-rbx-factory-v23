// k1/alx/config/skills.config.js
// Skills Configuration

export var SKILL_DEFINITIONS = {
  CORE: [
    { name: "help", class: "HelpSkill", description: "Show available commands" },
    { name: "status", class: "StatusSkill", description: "Show system status" },
    { name: "echo", class: "EchoSkill", description: "Echo input" },
    { name: "time", class: "TimeSkill", description: "Show current time" }
  ],
  LANGUAGE: [
    { name: "tokenize", class: "TokenizeSkill", description: "Tokenize input" },
    { name: "vocabulary", class: "VocabularySkill", description: "Vocabulary lookup" },
    { name: "intent", class: "IntentSkill", description: "Parse intent" },
    { name: "template", class: "TemplateSkill", description: "Template responses" }
  ],
  CODE: [
    { name: "code-analyze", class: "CodeAnalyzeSkill", description: "Analyze code" },
    { name: "code-structure", class: "CodeStructureSkill", description: "Parse code structure" },
    { name: "code-risk", class: "CodeRiskSkill", description: "Assess code risk" },
    { name: "diff", class: "DiffSkill", description: "Compare code" },
    { name: "dependency", class: "DependencySkill", description: "Analyze dependencies" }
  ],
  FACTORY: [
    { name: "build", class: "BuildSkill", description: "Build project" },
    { name: "pipeline", class: "PipelineSkill", description: "Manage pipeline" },
    { name: "session", class: "SessionSkill", description: "Manage sessions" },
    { name: "cache", class: "CacheSkill", description: "Manage build cache" }
  ],
  SECURITY: [
    { name: "guard", class: "GuardSkill", description: "Input validation" },
    { name: "audit", class: "AuditSkill", description: "Audit log" },
    { name: "permission", class: "PermissionSkill", description: "Permission check" },
    { name: "lockdown", class: "LockdownSkill", description: "Emergency lockdown" }
  ],
  MEMORY: [
    { name: "memory-query", class: "MemoryQuerySkill", description: "Query memory" },
    { name: "memory-stats", class: "MemoryStatsSkill", description: "Memory statistics" },
    { name: "memory-export", class: "MemoryExportSkill", description: "Export memory" }
  ],
  ADAPTIVE: [
    { name: "pattern-learn", class: "PatternLearner", description: "Learn patterns" },
    { name: "behavior-learn", class: "BehaviorLearner", description: "Learn behavior" },
    { name: "profile-build", class: "ProfileBuilder", description: "Build user profile" }
  ]
};

export var INTENT_TO_SKILL = {
  HELP: "help",
  STATUS: "status",
  GREETING: "echo",
  TIME: "time",
  BUILD: "build",
  PUBLISH: "build",
  PIPELINE: "pipeline",
  ANALYZE_CODE: "code-analyze",
  CODE_BLOCK: "code-analyze",
  TEST: "build",
  CLEAR: "session",
  MEMORY_QUERY: "memory-query",
  AUDIT: "audit",
  SHOW: "status",
  CHAT: "echo",
  EMPTY: "help",
  UNKNOWN: "help"
};

export var SKILL_PERMISSIONS = {
  PUBLIC: ["help", "status", "echo", "time", "tokenize"],
  USER: ["code-analyze", "code-structure", "code-risk", "build", "memory-query"],
  ADMIN: ["lockdown", "audit", "permission", "memory-export"],
  SYSTEM: ["pattern-learn", "behavior-learn", "anomaly-detect"]
};

export default {
  SKILL_DEFINITIONS: SKILL_DEFINITIONS,
  INTENT_TO_SKILL: INTENT_TO_SKILL,
  SKILL_PERMISSIONS: SKILL_PERMISSIONS
};