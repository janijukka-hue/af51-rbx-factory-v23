# 🏭 AF51-RBX Factory v64 — LATAUS

**Source-Driven Factory — Production-Ready Input Validation & Code-Aware Engine**

---

## 📥 **LATAUSLINKIT:**

### **1. GitHub Repository:**

**Repository:** [https://github.com/janijukka-hue/af51-rbx-factory-v23](https://github.com/janijukka-hue/af51-rbx-factory-v23)

**Suora ZIP-lataus:** [https://github.com/janijukka-hue/af51-rbx-factory-v23/archive/refs/heads/main.zip](https://github.com/janijukka-hue/af51-rbx-factory-v23/archive/refs/heads/main.zip)

---

### **2. Täydellinen Paketti (tar.gz):**

**VFS-lataus (3.8 MB):** [af51-rbx-factory-v64-source-driven.tar.gz](https://app.augmentcode.com/app/vfs/user/af51-rbx-factory-v64-source-driven.tar.gz?view=focus)

**Tiedosto:** `af51-rbx-factory-v64-source-driven.tar.gz` (3.8 MB)

**Sisältö:**
- ✅ Kaikki lähdekoodit
- ✅ Testit (5 kpl)
- ✅ Dokumentaatio (5 tiedostoa)
- ✅ Target-konfiguraatiot (RPG, OBBY, jne)
- ✅ Package Profiles
- ❌ Ei node_modules (aja `npm install`)
- ❌ Ei .git-historiaa

---

## 🚀 **PIKA-ALOITUS:**

### **Vaihtoehto 1: GitHub Clone**
```bash
git clone https://github.com/janijukka-hue/af51-rbx-factory-v23.git
cd af51-rbx-factory-v23
npm install
npm test
```

### **Vaihtoehto 2: ZIP-lataus (GitHub)**
```bash
# Lataa ZIP: https://github.com/janijukka-hue/af51-rbx-factory-v23/archive/refs/heads/main.zip
# Pura selaimen latauskansiosta tai:
wget https://github.com/janijukka-hue/af51-rbx-factory-v23/archive/refs/heads/main.zip
unzip main.zip
cd af51-rbx-factory-v23-main

# Asenna ja testaa
npm install
npm test
```

### **Vaihtoehto 3: tar.gz-paketti (VFS)**
```bash
# Lataa VFS: https://app.augmentcode.com/app/vfs/user/af51-rbx-factory-v64-source-driven.tar.gz?view=focus
# Pura ladattu tiedosto:
tar -xzf af51-rbx-factory-v64-source-driven.tar.gz
cd workspace  # tai mikä kansio tuli

# Asenna ja testaa
npm install
npm test
```

---

## 🧪 **TESTIT:**

### **Aja kaikki testit:**
```bash
npm test
```

### **Yksittäiset testit:**
```bash
# Input validation
node test-input-validator.mjs

# Garbage rejection
node test-garbage-rejection.mjs

# Code analyzer
node test-code-analyzer.mjs

# Code-aware build
node test-code-aware-build.mjs

# Edge cases
node test-edge-cases.mjs

# Demo
node demo-code-aware-factory.mjs
```

---

## 📋 **RAKENNA ROBLOX-PELI:**

### **1. Lua-koodista:**
```bash
# Luo tiedosto: my-game.lua
cat > my-game.lua << 'EOF'
local npc = Instance.new("Model")
npc.Name = "Guard"

local head = Instance.new("Part")
head.Name = "Head"
head.Shape = Enum.PartType.Ball
head.Parent = npc

local humanoid = Instance.new("Humanoid")
humanoid.Parent = npc

npc.Parent = workspace
EOF

# Rakenna
node -e "
import('./m2/roblox/roblox-orchestrator.js').then(async m => {
  const fs = await import('fs');
  const code = fs.readFileSync('my-game.lua', 'utf8');
  const result = await m.RobloxOrchestrator.process(
    { type: m.INTENT.BUILD, targetId: 'rpg', userSource: code },
    { 
      targetsDir: './targets',
      profilesDir: './packageProfiles',
      exportsDir: './exports-rbx',
      auditLedger: { 
        info: m => console.log(m),
        error: m => console.error(m),
        warn: m => console.warn(m)
      }
    }
  );
  console.log('Build:', result.ok ? 'OK' : 'FAILED');
  if (result.zipPath) console.log('ZIP:', result.zipPath);
});
"
```

### **2. Promptista:**
```bash
node -e "
import('./m2/roblox/roblox-orchestrator.js').then(async m => {
  const result = await m.RobloxOrchestrator.process(
    { 
      type: m.INTENT.BUILD, 
      targetId: 'rpg',
      userSource: 'Create an RPG village with NPCs and quests'
    },
    { 
      targetsDir: './targets',
      profilesDir: './packageProfiles',
      exportsDir: './exports-rbx',
      auditLedger: { 
        info: m => console.log(m),
        error: m => console.error(m),
        warn: m => console.warn(m)
      }
    }
  );
  console.log('Build:', result.ok ? 'OK' : 'FAILED');
  if (result.zipPath) console.log('ZIP:', result.zipPath);
});
"
```

---

## 📚 **DOKUMENTAATIO:**

### **Käyttäjille:**
- `CODE_AWARE_FACTORY_GUIDE.md` — Miten tehdas toimii
- `RBX_FACTORY_V64_SUMMARY.md` — Yhteenveto v64:stä

### **Kehittäjille:**
- `CODE_AWARE_IMPLEMENTATION.md` — Tekninen toteutus
- `GARBAGE_INPUT_BUG_FIX.md` — Kriittinen bugikorjaus
- `RBX_FACTORY_V65_ROADMAP.md` — Seuraavat askeleet

---

## ✅ **MITÄ v64 SISÄLTÄÄ:**

### **1. Input Validation Gate** (UUSI)
- Hylkää garbage-inputit ENNEN buildia
- Validoi Roblox-aiheisen sisällön
- Palauttaa `BUILD_REJECTED_INVALID_SOURCE`

### **2. Code-Aware Production Engine** (UUSI)
- Analysoi Lua-koodin sisällön
- Tunnistaa: Humanoid, Checkpoints, ClickDetectors, jne
- Rakentaa vain tarvittavat tukikomponentit

### **3. Quality Gate Relaxation** (MUOKATTU)
- Code-driven tilassa ohittaa template-vaatimukset
- Hyväksyy minimal/empty composition

### **4. Garbage Rejection** (KORJAUS)
- Invariantti: **INVALID SOURCE MUST NEVER PRODUCE A ZIP**
- Empty string → REJECTED
- Keyboard mash → REJECTED
- No Roblox intent → REJECTED

---

## 📊 **TULOKSET:**

| Input | v63 | v64 |
|-------|-----|-----|
| Garbage (`"asdfghjkl"`) | ❌ Builds RPG | ✅ REJECTED |
| Empty (`""`) | ❌ Builds RPG | ✅ REJECTED |
| Full Humanoid code | ❌ Template overlay | ✅ Code-driven |
| "Create RPG village" | ✅ Template | ✅ Template |

---

## 🎉 **v64 = ARKKITEHTUURIKÄÄNNÖS:**

```text
ENNEN (v63):
Template-Driven Factory
  Input (anything) → Template Builder → ZIP (always)

NYT (v64):
Source-Driven Factory
  Input → VALIDATE → Code-Aware/Template → ZIP (only valid)
```

**"Eihän se muuten mikää tehdas ole" — NYT SE ON OIKEA TEHDAS!** 🏭✨

