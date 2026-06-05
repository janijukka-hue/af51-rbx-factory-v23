// k1/alx/index.js
// ALX Module Entry Point
// Named exports only - no default export

// ===== CORE =====
export { ALX, createALX } from "./core/ALX.js";
export {
  ALX_STATE,
  SKILL_CATEGORY,
  INTENT_CONFIDENCE,
  createSkillContext,
  createSkillResult,
  createIntent
} from "./core/types.js";

export { SkillRegistry, createSkillRegistry } from "./core/SkillRegistry.js";
export { IntentMatcher, createIntentMatcher } from "./core/IntentMatcher.js";
export {
  Memory as ALXMemory,
  createMemory as createALXMemory,
  MEMORY_TYPE
} from "./core/Memory.js";
export { SessionManager, createSessionManager } from "./core/SessionManager.js";
export { HybridRouter, createHybridRouter, ROUTE, SMART_TRIGGERS, FAST_INTENTS } from "./core/HybridRouter.js";

// ===== UTILS =====
export { fnv1a32, fnv1a64, simpleHash256 } from "./utils/hash.js";
export {
  tokenize,
  tokenizeClean,
  stem,
  ngrams,
  similarity
} from "./utils/tokenizer.js";

export {
  matchPattern,
  matchAny,
  extractParams,
  createMatcher
} from "./utils/patterns.js";

export {
  calculateComplexity,
  calculateRisk,
  calculateQuality
} from "./utils/scoring.js";

export {
  FrequencyTracker,
  TimingTracker,
  SequenceDetector,
  AnomalyDetector
} from "./utils/heuristics.js";

export {
  extractCodeBlocks,
  hasCodeBlock,
  normalize,
  truncate
} from "./utils/text.js";

// ===== SKILLS: CORE =====
export { HelpSkill, createHelpSkill } from "./skills/core/HelpSkill.js";
export { StatusSkill, createStatusSkill } from "./skills/core/StatusSkill.js";
export { EchoSkill, createEchoSkill } from "./skills/core/EchoSkill.js";
export { TimeSkill, createTimeSkill } from "./skills/core/TimeSkill.js";

// ===== SKILLS: LANGUAGE =====
export { TokenizeSkill, createTokenizeSkill } from "./skills/language/TokenizeSkill.js";
export { VocabularySkill, createVocabularySkill } from "./skills/language/VocabularySkill.js";
export { IntentSkill, createIntentSkill } from "./skills/language/IntentSkill.js";
export { TemplateSkill, createTemplateSkill } from "./skills/language/TemplateSkill.js";

// ===== SKILLS: CODE =====
export { CodeAnalyzeSkill, createCodeAnalyzeSkill } from "./skills/code/CodeAnalyzeSkill.js";
export { CodeStructureSkill, createCodeStructureSkill } from "./skills/code/CodeStructureSkill.js";
export { CodeRiskSkill, createCodeRiskSkill } from "./skills/code/CodeRiskSkill.js";
export { DiffSkill, createDiffSkill } from "./skills/code/DiffSkill.js";
export { DependencySkill, createDependencySkill } from "./skills/code/DependencySkill.js";

// ===== SKILLS: FACTORY =====
export { BuildSkill, createBuildSkill } from "./skills/factory/BuildSkill.js";
export { PipelineSkill, createPipelineSkill } from "./skills/factory/PipelineSkill.js";
export { SessionSkill, createSessionSkill } from "./skills/factory/SessionSkill.js";
export { CacheSkill, createCacheSkill } from "./skills/factory/CacheSkill.js";

// ===== SKILLS: SECURITY =====
export { GuardSkill, createGuardSkill } from "./skills/security/GuardSkill.js";
export { AuditSkill, createAuditSkill } from "./skills/security/AuditSkill.js";
export { PermissionSkill, createPermissionSkill } from "./skills/security/PermissionSkill.js";
export { LockdownSkill, createLockdownSkill } from "./skills/security/LockdownSkill.js";

// ===== SKILLS: MEMORY =====
export { MemoryQuerySkill, createMemoryQuerySkill } from "./skills/memory/MemoryQuerySkill.js";
export { MemoryStatsSkill, createMemoryStatsSkill } from "./skills/memory/MemoryStatsSkill.js";
export { MemoryExportSkill, createMemoryExportSkill } from "./skills/memory/MemoryExportSkill.js";

// ===== SKILLS: ADAPTIVE =====
export { PatternLearner, createPatternLearner } from "./skills/adaptive/PatternLearner.js";
export { BehaviorLearner, createBehaviorLearner } from "./skills/adaptive/BehaviorLearner.js";
export { ProfileBuilder, createProfileBuilder } from "./skills/adaptive/ProfileBuilder.js";