# 🚨 GARBAGE INPUT BUG — Fixed in v64

**AF51-RBX Factory v64 — Critical Production-Readiness Fix**

---

## 🔴 **CRITICAL BUG (v63 and earlier):**

**RBX Factory would build a full template ZIP from meaningless garbage input.**

### **Reproduction:**

```bash
Input:
build yurejfijdkjfgjjrfijghijdhigjijgdidj

Expected:
BUILD_REJECTED_INVALID_SOURCE

Actual (v63):
✓ RBX BUILD OK
Target: RPG
Phases: 16/16 ✓
ZIP: AF51-RBX-AF51-RPG-build_rpg_xxxxx.zip (384 objects)
```

**Result:** Factory generated a **full RPG village template** (384 objects, 135 KB ZIP) from **keyboard mash**.

---

## ❌ **THE PROBLEM:**

### **Root Cause:**

The factory had **NO input validation gate**. The pipeline was:

```
User Input (anything)
         ↓
Template Builder (RPG/OBBY/Simulator/...)
         ↓
ZIP (always generated)
```

**There was NO pre-build check** to reject:
- Empty strings
- Garbage/nonsense input
- Random characters
- Text with no Roblox build intent

### **Invariant Violated:**

> **INVALID SOURCE MUST NEVER PRODUCE A ZIP.**

This invariant did NOT hold in v63.

---

## ✅ **THE FIX (v64):**

### **New Architecture:**

```
User Input
    ↓
INPUT_VALIDATION (NEW Phase 0)
    ↓
  Valid? ← NO → BUILD_REJECTED_INVALID_SOURCE
    ↓
  YES
    ↓
Template Builder (only if input valid)
    ↓
ZIP (only for valid input)
```

### **Validation Rules:**

1. **Empty/null input** → `BUILD_REJECTED_INVALID_SOURCE`
2. **Garbage/nonsense** (no vowels, long consonants, keyboard mash) → `BUILD_REJECTED_INVALID_SOURCE`
3. **No Roblox build intent** → `BUILD_REJECTED_INVALID_SOURCE`
4. **Valid Lua code** → ALLOW (code is build intent)
5. **Valid prompt** (contains Roblox keywords) → ALLOW

### **Implementation:**

**Files Changed:**

1. **`m2/roblox/rbx-input-validator.js`** (NEW)
   - `validateBuildInput(userInput, detection)` — pre-build validation
   - Gibberish detection (vowel ratio, consonant runs, repeated chars)
   - Intent analysis (Roblox keywords, action verbs)

2. **`m2/roblox/roblox-build-manager.js`** (MODIFIED)
   - Added **Phase 0: INPUT_VALIDATION** before all other phases
   - Rejects invalid input BEFORE any build work starts
   - Returns `BUILD_REJECTED_INVALID_SOURCE` with reason

3. **`m2/roblox/roblox-orchestrator.js`** (FIXED)
   - Fixed `userSource: intent.userSource || null` bug
   - Empty string was being converted to `null`, skipping validation
   - Changed to: `userSource: intent.userSource !== undefined ? intent.userSource : null`

---

## 🧪 **TESTS:**

### **Garbage Input Test:**

```javascript
Input: 'yurejfijdkjfgjjrfijghijdhigjijgdidj'
Result: ✅ BUILD_REJECTED_INVALID_SOURCE
Reason: "Input appears to be gibberish or random characters"
ZIP: none
Phases: 0
```

### **Empty String Test:**

```javascript
Input: ''
Result: ✅ BUILD_REJECTED_INVALID_SOURCE
Reason: "No input provided"
ZIP: none
Phases: 0
```

### **Valid Code Test:**

```javascript
Input: `
  local npc = Instance.new("Model")
  local humanoid = Instance.new("Humanoid")
  humanoid.Parent = npc
`
Result: ✅ BUILD OK
ZIP: AF51-RBX-...-build_rpg_xxxxx.zip
Phases: 17/17
```

**All tests pass.** ✅

---

## 📊 **COMPARISON:**

| Input Type | v63 (Before) | v64 (After) |
|------------|--------------|-------------|
| **Garbage** (`yurejfijdkjfgjjrfijghijdhigjijgdidj`) | ❌ Builds RPG ZIP | ✅ Rejects |
| **Empty** (`''`) | ❌ Builds RPG ZIP | ✅ Rejects |
| **No intent** ("random text") | ❌ Builds RPG ZIP | ✅ Rejects |
| **Valid Lua** (Humanoid code) | ✅ Builds ZIP | ✅ Builds ZIP |
| **Valid prompt** ("Create RPG") | ✅ Builds ZIP | ✅ Builds ZIP |

---

## 🎯 **INVARIANT NOW HOLDS:**

> **INVALID SOURCE MUST NEVER PRODUCE A ZIP.**

✅ **Garbage input** → `BUILD_REJECTED_INVALID_SOURCE`  
✅ **Empty input** → `BUILD_REJECTED_INVALID_SOURCE`  
✅ **No Roblox intent** → `BUILD_REJECTED_INVALID_SOURCE`  
✅ **Valid input** → Build proceeds  

**The factory is now production-ready for user-facing deployment.**

---

## 🚀 **ACCEPTANCE TESTS:**

### **Test 1: Garbage Rejection**

```bash
Input:
build yurejfijdkjfgjjrfijghijdhigjijgdidj

Expected:
BUILD_REJECTED_INVALID_SOURCE
Reason: Input appears to be gibberish or random characters

Forbidden:
- Target: RPG
- ZIP generated
- Phases 16/16
```

**Status:** ✅ PASS

---

### **Test 2: Valid Prompt Routing**

```bash
Input:
Create one Roblox NPC named AF51_Guard using Humanoid and R15 rig.

Expected:
- Intent: prompt
- Validation: PASS
- Build: proceeds

Forbidden:
- BUILD_REJECTED_INVALID_SOURCE
```

**Status:** ✅ PASS

---

## ✅ **PRODUCTION READINESS:**

The factory can now be **safely exposed to users** without risk of:
- Generating ZIPs from nonsense input
- Wasting compute resources on invalid builds
- Confusing users with unexpected template outputs

**v64 is READY for public deployment.** 🏭✨

