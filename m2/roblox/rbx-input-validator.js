// m2/roblox/rbx-input-validator.js — ESM
// AF51 RBX FACTORY — Input Validation Gate
//
// MISSION: Prevent meaningless/garbage input from reaching the builder.
//
// RULES:
// 1. If user provides Lua code → ALLOW (code is intent)
// 2. If user provides meaningful prompt → ALLOW (analyze intent)
// 3. If user provides garbage/empty → REJECT (no build intent)
//
// This gate runs BEFORE any template builder (OBBY/RPG/Simulator/etc).

/**
 * Validate user input before allowing build to proceed.
 * 
 * @param {string|null} userInput - User's input (prompt or code)
 * @param {object} detection - Result from lua-input-detector
 * @returns {{
 *   valid: boolean,
 *   reason: string,
 *   intent: "code" | "prompt" | "invalid",
 *   confidence: number,
 *   suggestion: string | null
 * }}
 */
export function validateBuildInput(userInput, detection) {
  // Empty/null input
  if (!userInput || typeof userInput !== "string") {
    return {
      valid: false,
      reason: "No input provided",
      intent: "invalid",
      confidence: 0,
      suggestion: "Provide Roblox Lua code or a build description"
    };
  }

  const trimmed = userInput.trim();
  
  // Too short to be meaningful
  if (trimmed.length < 10) {
    return {
      valid: false,
      reason: "Input too short to determine intent",
      intent: "invalid",
      confidence: 0,
      suggestion: "Provide at least a brief description or Lua code snippet"
    };
  }

  // If Lua code detected → ALWAYS VALID
  if (detection && detection.isLua) {
    return {
      valid: true,
      reason: "Valid Lua code detected",
      intent: "code",
      confidence: detection.score || 1.0,
      suggestion: null
    };
  }

  // Check for meaningful English/Finnish prompt
  const meaningfulPatterns = [
    // Roblox-specific
    /\b(roblox|luau|lua|game|place|world|experience)\b/i,
    /\b(obby|tycoon|simulator|rpg|fps|platformer|adventure)\b/i,
    /\b(character|npc|player|humanoid|avatar)\b/i,
    /\b(checkpoint|spawn|teleport|gui|ui|menu)\b/i,
    /\b(part|model|brick|mesh|terrain)\b/i,
    
    // Action verbs
    /\b(create|build|make|generate|spawn|add)\b/i,
    /\b(design|construct|implement|setup)\b/i,
    
    // Intent phrases
    /\b(i want|i need|can you|please|help me)\b/i,
    /\b(käytä|luo|tee|rakenna|lisää)\b/i,  // Finnish
  ];

  const hasIntent = meaningfulPatterns.some(pattern => pattern.test(trimmed));

  if (hasIntent) {
    return {
      valid: true,
      reason: "Meaningful build intent detected",
      intent: "prompt",
      confidence: 0.7,
      suggestion: null
    };
  }

  // Check for gibberish/random characters
  const gibberishScore = _detectGibberish(trimmed);
  
  if (gibberishScore > 0.6) {
    return {
      valid: false,
      reason: "Input appears to be gibberish or random characters",
      intent: "invalid",
      confidence: 0,
      suggestion: "Provide a clear description like 'Create an RPG with NPCs' or Roblox Lua code"
    };
  }

  // Generic text without Roblox context
  if (trimmed.length > 30 && !hasIntent) {
    return {
      valid: false,
      reason: "No Roblox build intent detected in input",
      intent: "invalid",
      confidence: 0,
      suggestion: "Describe what Roblox game/feature you want to build"
    };
  }

  // Fallback: short text without clear intent
  return {
    valid: false,
    reason: "Unclear build intent",
    intent: "invalid",
    confidence: 0,
    suggestion: "Be more specific about what you want to build"
  };
}

/**
 * Detect if text is gibberish (random characters, no meaningful words).
 * Returns 0.0 (clearly valid) to 1.0 (clearly gibberish).
 */
function _detectGibberish(text) {
  // Very long consecutive consonants
  const longConsonants = (text.match(/[bcdfghjklmnpqrstvwxyz]{6,}/gi) || []).length;
  if (longConsonants > 0) return 0.9;

  // No vowels at all
  const vowels = (text.match(/[aeiouyäö]/gi) || []).length;
  const consonants = (text.match(/[bcdfghjklmnpqrstvwxz]/gi) || []).length;
  if (consonants > 10 && vowels === 0) return 0.95;

  // Very low vowel ratio
  const vowelRatio = vowels / (vowels + consonants || 1);
  if (vowelRatio < 0.15 && text.length > 20) return 0.8;

  // Repeated character patterns (aaaa, jjjj)
  const repeats = (text.match(/(.)\1{4,}/g) || []).length;
  if (repeats > 2) return 0.85;

  // No spaces and long (likely keyboard mash)
  if (text.length > 30 && !text.includes(" ")) return 0.7;

  return 0.0;  // Looks valid
}

/**
 * Create a standardized rejection response.
 */
export function createRejectionResponse(validation) {
  return {
    ok: false,
    error: "BUILD_REJECTED_INVALID_SOURCE",
    reason: validation.reason,
    suggestion: validation.suggestion,
    validation,
  };
}

export default { validateBuildInput, createRejectionResponse };
