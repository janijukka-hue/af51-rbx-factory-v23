# 🚀 RBX Factory v65/v66 — Roadmap

**v65 COMPLETE ✅ — Parser Enhancements**
**v66 NEXT — Production-Grade Intent Routing & Content Validation**

---

## ✅ **v65 ACHIEVEMENTS (COMPLETE):**

### **Parser & Preview Enhancements:**
✅ Factory Function Expansion (`makePart(...)`)
✅ Parent Variable Resolution (`gui.Parent = sign` → `"BIG_SIGN"`)
✅ SurfaceGui Text Overlay (metadata for 3D rendering)
✅ UI Layer Accurate Descriptions (SurfaceGui/BillboardGui/ScreenGui)
✅ Design Report Script Counter (source files vs gameplay scripts)
✅ Parser Diagnostics (direct/factory/surfaceGui/parentResolved)

**Test Coverage:** 8/8 automated tests passing
**Documentation:** `PARSER_ENHANCEMENTS_V65.md` (440+ lines)
**Backward Compatibility:** 100%

---

## ✅ **v64 ACHIEVEMENTS:**

### **Core Invariant Established:**
> **INVALID SOURCE MUST NEVER PRODUCE A ZIP**

### **Architecture Shift Complete:**
```text
BEFORE (v63): Template-Driven Factory
  Input (anything) → Template Builder → ZIP (always)

NOW (v64): Source-Driven Factory
  Input → VALIDATE → Code-Aware/Template → ZIP (only valid)
```

### **What Works:**
✅ Garbage input → `BUILD_REJECTED_INVALID_SOURCE`  
✅ Lua code → Code-driven build  
✅ Template prompt → Template build  
✅ Input validation gate (Phase 0)  
✅ Code analysis & feature detection  

### **What's Missing:**
⚠️ Intent Router (prompts route to wrong builders)  
⚠️ Content Validator (valid Lua ≠ buildable Roblox)  

---

## 🎯 **v66 PRIORITIES:**

**v65 was parser/preview enhancements. v66 is production routing.**

### **1. Intent Router** (HIGH PRIORITY)

**Problem:**
```text
Input: "Create one NPC guard"
Current: → RPG Template (302 nodes) ❌
Expected: → NPC/Character Builder (minimal) ✅
```

**Solution:**
Implement **Intent Analysis Layer** before builder selection.

#### **Intent Categories:**

| Input Pattern | Intent | Route |
|---------------|--------|-------|
| "Create an RPG village" | `RPG_TEMPLATE` | RPG Builder (full template) |
| "Create an obby" | `OBBY_TEMPLATE` | OBBY Builder (full template) |
| "Create one NPC" | `CHARACTER` | Character Builder (minimal) |
| "Create a Humanoid" | `CHARACTER` | Character Builder (minimal) |
| Lua with `Instance.new("Part")` | `CODE_MINIMAL` | Code-driven (minimal) |
| Lua with full Humanoid rig | `CODE_COMPLETE` | Code-driven (skip template) |
| "print('hello')" | `NO_CONTENT` | REJECT |
| "asdfghjkl" | `INVALID` | REJECT |

#### **Implementation:**

**File:** `m2/roblox/intent-router.js` (NEW)

```javascript
export function routeIntent(userInput, detection, validation) {
  // If garbage/invalid
  if (!validation.valid) {
    return { route: 'REJECT', reason: validation.reason };
  }

  // If Lua code
  if (detection.isLua) {
    const features = analyzeCodeFeatures(userInput);
    
    // Complete code (no template needed)
    if (features.targetHint === 'code-driven') {
      return { route: 'CODE_COMPLETE', builder: 'CodeDrivenBuilder' };
    }
    
    // Partial code (needs support)
    return { route: 'CODE_MINIMAL', builder: 'CodeAwareBuilder', support: features.supportNeeds };
  }

  // If prompt
  if (validation.intent === 'prompt') {
    // Match intent keywords
    if (/\b(RPG|village|town|quest)\b/i.test(userInput)) {
      return { route: 'RPG_TEMPLATE', builder: 'RPGBuilder' };
    }
    if (/\b(obby|parkour|checkpoint)\b/i.test(userInput)) {
      return { route: 'OBBY_TEMPLATE', builder: 'OBBYBuilder' };
    }
    if (/\b(NPC|character|humanoid|guard|villager)\b/i.test(userInput)) {
      return { route: 'CHARACTER', builder: 'CharacterBuilder' };
    }
    if (/\b(simulator|clicker|click)\b/i.test(userInput)) {
      return { route: 'SIMULATOR_TEMPLATE', builder: 'SimulatorBuilder' };
    }
    
    // Generic/unclear prompt
    return { route: 'GENERIC_PROMPT', builder: 'RPGBuilder', warning: 'unclear_intent' };
  }

  // Fallback
  return { route: 'UNKNOWN', reason: 'no_clear_intent' };
}
```

---

### **2. Content Validator** (HIGH PRIORITY)

**Problem:**
```text
Input: print("hello world")
Current: Passes validation (valid Lua) → Template build ❌
Expected: REJECT (no buildable Roblox content) ✅
```

**Core Rule:**
> **VALID LUA ≠ BUILDABLE ROBLOX PRODUCT**

#### **Buildable Content Patterns:**

| Pattern | Buildable? | Reason |
|---------|-----------|--------|
| `Instance.new("Part")` | ✅ YES | Creates Part |
| `Instance.new("Model")` | ✅ YES | Creates Model |
| `Instance.new("Humanoid")` | ✅ YES | Creates Character |
| `print("hello")` | ❌ NO | No structures |
| `local x = 5` | ❌ NO | No structures |
| `game:GetService("Players")` | ⚠️ MAYBE | Logic only (no geometry) |

#### **Implementation:**

**File:** `m2/roblox/rbx-content-validator.js` (NEW)

```javascript
export function validateBuildableContent(luaCode) {
  // Check for Instance.new(...) creating buildable types
  const buildableTypes = [
    'Part', 'Model', 'Humanoid', 'MeshPart', 'UnionOperation',
    'SpawnLocation', 'Folder', 'Configuration',
  ];
  
  const hasInstances = buildableTypes.some(type => {
    const pattern = new RegExp(`Instance\\.new\\("${type}"\\)`, 'i');
    return pattern.test(luaCode);
  });

  if (hasInstances) {
    return { buildable: true, reason: 'contains_buildable_instances' };
  }

  // Check for game structure modifications
  const hasWorkspaceModification = /workspace\.\w+\s*=|\.Parent\s*=\s*workspace/.test(luaCode);
  
  if (hasWorkspaceModification) {
    return { buildable: true, reason: 'modifies_workspace' };
  }

  // Pure script logic (no buildable content)
  return {
    buildable: false,
    reason: 'NO_BUILDABLE_ROBLOX_CONTENT',
    suggestion: 'Add Instance.new() calls to create Parts, Models, or other Roblox objects'
  };
}
```

**Integration:**

Add to `roblox-build-manager.js` Phase 0 (after basic validation):

```javascript
// Phase 0: INPUT_VALIDATION
const validation = validateBuildInput(userSource, detection);
if (!validation.valid) return REJECT;

// NEW: Content validation for Lua code
if (detection.isLua) {
  const contentValidation = validateBuildableContent(userSource);
  if (!contentValidation.buildable) {
    return { error: 'NO_BUILDABLE_ROBLOX_CONTENT', reason: contentValidation.reason };
  }
}
```

---

## 🧪 **v66 ACCEPTANCE TESTS:**

### **Test 1: Intent Routing**

```javascript
Input: "Create one NPC guard using Humanoid"
Expected:
  Route: CHARACTER
  Builder: CharacterBuilder
  Nodes: < 50 (minimal)
Forbidden:
  Route: RPG_TEMPLATE
  Nodes: > 300
```

### **Test 2: Content Validation**

```javascript
Input: print("hello world")
Expected:
  Error: NO_BUILDABLE_ROBLOX_CONTENT
  ZIP: none
Forbidden:
  Template build
  ZIP generated
```

### **Test 3: Full Pipeline**

```javascript
Input: "Create an RPG village with NPCs"
Expected:
  Route: RPG_TEMPLATE
  Builder: RPGBuilder
  Nodes: > 300
```

---

## 📊 **v66 SUCCESS CRITERIA:**

✅ **Intent Router** distinguishes:
- Template requests ("Create RPG") → Full template
- Character requests ("Create NPC") → Minimal NPC
- Code-driven ("Instance.new...") → Code-aware build

✅ **Content Validator** rejects:
- `print("hello")` → NO_BUILDABLE_ROBLOX_CONTENT
- Pure logic scripts → NO_BUILDABLE_ROBLOX_CONTENT

✅ **Full Pipeline**:
```text
Input
  ↓
VALIDATE (garbage?)
  ↓
ANALYZE (code or prompt?)
  ↓
ROUTE (which builder?)
  ↓
BUILD (code-driven or template?)
  ↓
GATE (quality check)
  ↓
ARTIFACT (ZIP)
```

---

## 🏭 **v66 = Production-Ready Factory**

When v66 is complete, RBX Factory will:

✅ Reject garbage input  
✅ Reject non-buildable Lua  
✅ Route prompts correctly  
✅ Build code-driven products  
✅ Build template products  
✅ Never produce artifacts from invalid input  

**v66 will achieve the original AF51 vision:**

> "Tehdas lukee käyttäjän koodin ja build valmistaa. Eihän se muuten mikää tehdas ole."

---

## 🎯 **CURRENT STATUS (2026-06-06):**

**v65 ✅ COMPLETE**
- Parser & Preview enhancements shipped
- 8/8 tests passing
- Full documentation published

**v66 🚧 PLANNED**
- Intent Router (not started)
- Content Validator (not started)
- Production routing logic (not started)

**Next Step:** Begin v66 Intent Router implementation

🚀🏭✨
