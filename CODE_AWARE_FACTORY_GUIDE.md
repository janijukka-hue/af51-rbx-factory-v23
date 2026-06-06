# 🏭 CODE-AWARE FACTORY — Käyttäjän Opas

**AF51-RBX Factory v64 — Tehdas joka lukee koodisi ja rakentaa sen mitä tarvitset**

---

## 🎯 **IDEA:**

**Tehdas ei pakota template-maailmoja (RPG-kylä, OBBY-rata) päälle koodiisi.**  
**Se LUKEE koodisi, analysoi mitä tarvitset, ja rakentaa VAIN sen.**

---

## ✨ **MITEN SE TOIMII:**

### **1. KIRJOITA KOODI**

Kirjoita Roblox Lua -koodia normaalisti:

```lua
-- Luo NPC-hahmo
local npc = Instance.new("Model")
npc.Name = "Guard"

local head = Instance.new("Part")
head.Name = "Head"
head.Shape = Enum.PartType.Ball
head.BrickColor = BrickColor.new("Bright yellow")
head.Parent = npc

local torso = Instance.new("Part")
torso.Name = "Torso"
torso.BrickColor = BrickColor.new("Bright blue")
torso.Parent = npc

local humanoid = Instance.new("Humanoid")
humanoid.Parent = npc

npc.Parent = workspace
```

---

### **2. RAKENNA (BUILD)**

Kirjoita chat-kenttään:

```
build rpg
```

TAI lähetä koodi suoraan `/rbx/build` -endpointtiin:

```javascript
fetch("/rbx/build", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    targetId: "rpg",
    source: yourLuaCode  // ← KOODISI TÄHÄN
  })
})
```

---

### **3. TEHDAS ANALYSOI**

**Code-Aware Analyzer** lukee koodisi ja tunnistaa:

✅ **Humanoid-hahmot** → Lisää R6 rig -tuen  
✅ **Checkpoints** → OBBY-systeemi  
✅ **ClickDetector** → Simulator-logiikka  
✅ **NPCs** → RPG-dialogit  

**Esimerkki:**
```
[INFO] CODE-AWARE: Detected: Humanoid characters, NPCs | Needs: complete R6 rig, Motor6D joints
[INFO] CODE-AWARE mode: minimal rpg-like support
```

---

### **4. BUILD VALMIS**

Tehdas generoi **VAIN** sen mitä koodisi tarvitsee:

- ❌ **EI** täyttä RPG-kylää (jos et sitä kirjoittanut)
- ❌ **EI** OBBY-rataa (jos et sitä kirjoittanut)
- ✅ **VAIN** tukirakenteen koodillesi (esim. Motor6D, Animator)
- ✅ **Koodisi tallennetaan:** `AF51UserSeed.server.lua`

**QualityGate on RELAKSOITU code-driven tilassa:**
- Ei vaadi RPG-elementtejä (NPC, QuestBoard, jne)
- Ei vaadi OBBY-elementtejä (Checkpoint, Killbrick, jne)
- Hyväksyy minimaalisen composition-geometrian

---

### **5. LATAA ZIP**

Painamalla **"EXPORT ZIP"** saat:

```
AF51-RBX-YOURPROJECT-build_rpg_xxxxx.zip
```

**Sisältö:**
- ✅ **AF51.rbxlx** - Avaa suoraan Roblox Studiossa
- ✅ **AF51UserSeed.server.lua** - Koodisi täsmälleen sellaisenaan
- ✅ **AF51SceneBuilder.server.lua** - Tukirakenteen generator
- ✅ **default.project.json** - Rojo-konfiguraatio

---

## 🔧 **ESIMERKKEJÄ:**

### **A) Täydellinen Humanoid-koodi**

Jos kirjoitat **koko R6-rigin** (Head, Torso, Arms, Legs, Motor6D):

```lua
local npc = Instance.new("Model")
-- ... kaikki 6 osaa + Motor6D + Humanoid ...
```

**Tehdas:** "Code-driven mode — ei template-tukea tarvita"  
**Tulos:** Vain koodisi, ei ylimääräistä geometriaa.

---

### **B) Osittainen Humanoid-koodi**

Jos kirjoitat vain **pään ja torson**:

```lua
local head = Instance.new("Part")
head.Name = "Head"
local humanoid = Instance.new("Humanoid")
```

**Tehdas:** "CODE-AWARE: Needs complete R6 rig, Motor6D joints"  
**Tulos:** Koodisi + minimal RPG-support (SpawnLocation, jne)

---

### **C) OBBY Checkpoint -koodi**

```lua
checkpoint.Touched:Connect(function(hit)
  local player = game.Players:GetPlayerFromCharacter(hit.Parent)
  if player then
    leaderstats.Stage.Value = leaderstats.Stage.Value + 1
  end
end)
```

**Tehdas:** "Detected: Checkpoint system"  
**Tulos:** Koodisi + minimal OBBY-support

---

## 📊 **ARKKITEHTUURI:**

```
KÄYTTÄJÄ KIRJOITTAA LUA
         ↓
┌────────────────────────────────┐
│ ALX (lua-input-detector.js)    │
│ • Tunnistaa: "Tämä on Lua"     │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│ CODE ANALYZER (uusi v64!)      │
│ • analyzeCodeFeatures()        │
│ • Tunnistaa: features, needs   │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│ VISUAL DIRECTOR                │
│ • Code-driven: skip template   │
│ • Code-aware: minimal support  │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│ QUALITY GATE (relaksoitu!)     │
│ • Ohittaa template-vaatimukset │
│ • Hyväksyy user code           │
└────────────────────────────────┘
         ↓
    VALMIS ZIP ✅
```

---

## ✅ **MITÄ MUUTTUI v64:**

| Komponentti | Ennen | Nyt |
|-------------|-------|-----|
| **CompositionEngine** | Aina RPG/OBBY template | Code-driven: skip template |
| **QualityGate** | Vaatii ≥70 Parts, ≥3 NPCs | Relaksoitu code-driven tilassa |
| **UserSource** | Saved to ZIP | ✅ Analyzed + Saved |
| **Build Mode** | Template-only | **Code-aware** tai **Template** |

---

## 🚀 **KÄYTTÖÖNOTTO:**

1. **Kirjoita Lua-koodi**
2. **Lähetä `/rbx/build` -endpointtiin** (source-kentässä)
3. **Tehdas analysoi automaattisesti**
4. **Lataa valmis ZIP**

**EI enää template-valintaa! Koodi määrää mitä rakennetaan!** 🏭✨

