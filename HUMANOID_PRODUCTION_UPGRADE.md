# AF51-RBX Humanoid Production Upgrade

**Status:** ✅ COMPLETE — All 45 tests passing  
**Date:** 2026-06-05  
**Scope:** Production-quality humanoid character generation for RPG/FPS/Simulator targets

---

## 🎯 Ongelma

Preview-näkymässä kaikki NPC:t ja hahmot renderöityivät **laatikon muotoisina** (`Box`) yksittäisinä Part-objekteina. Tämä näytti debug-geometrialta eikä pelimäisiltä hahmoilta.

**Ennen:**
- Innkeeper: yksi 2×5×2 studia keltainen laatikko
- Blacksmith: yksi 2×5×2 studia harmaa laatikko
- Merchant: yksi 2×5×2 studia keltainen laatikko
- Priest: yksi 2×5×2 studia valkoinen laatikko

---

## ✨ Ratkaisu

### 1. **HumanoidBuilder** (uusi moduuli)
**Tiedosto:** `t3/Factory/rbx-production/humanoid-builder.js`

Generoi oikeat humanoid-rakenteet R6-tyylillä:
- **Model** container (kuten Roblox character)
- **Head** (2×2×2, `kind: "head"`)
- **Torso** (2×2×1, `kind: "torso"`)
- **LeftArm** + **RightArm** (1×2×1, `kind: "limb"`)
- **LeftLeg** + **RightLeg** (1×2×1, `kind: "limb"`)

```javascript
buildHumanoid(graph, {
  name: "Innkeeper",
  x: 16, y: 1.0, z: 16,
  color: "Pastel brown",
  scale: 0.9,
  tags: ["NPC", "Interactable"],
  attributes: { NpcName: "Innkeeper", Role: "rest" }
});
```

### 2. **MeshPass Enhancement**
**Tiedosto:** `t3/Factory/rbx-production/mesh-pass.js`

Lisättiin `HUMANOID_STRATEGY` ja `_pickHumanoid()`:
- `kind: "head"` → `Shape: Enum.PartType.Ball` + `SpecialMesh(Sphere)`
- `kind: "torso"` → `Shape: Block` + `SpecialMesh(Brick)`
- `kind: "limb"` → `Shape: Enum.PartType.Cylinder` + `SpecialMesh(Cylinder)`

**Prioriteetti:** Humanoid-strategia (**kind**-attribuutti) voittaa tag-pohjaisen strategian.

### 3. **CompositionEngine Integration**
**Tiedosto:** `t3/Factory/rbx-production/composition-engine.js`

RPG-target korvattu käyttämään `buildHumanoid()`:
```javascript
// Ennen:
_part(graph, { name: "Innkeeper", sx: 2, sy: 5, sz: 2, ... });

// Jälkeen:
buildHumanoid(graph, { name: "Innkeeper", x, y, z, color, ... });
```

### 4. **Preview Utils Update**
**Tiedosto:** `ui/preview/rbxPreviewUtils.js`

Lisättiin `kind`-attribuutin välitys structuresiin:
```javascript
{
  id: "n_abc123",
  label: "Head",
  luaClass: "Part",
  shape: "Ball",        // ← MeshPass asettaa
  kind: "head",         // ← uusi kenttä
  x, y, z, w, h, d,
  ...
}
```

### 5. **RbxRealPreviewEngine** (ei muutoksia)
**Tiedosto:** `ui/preview/RbxRealPreviewEngine.js`

Preview-moottori **tuki jo** `kind`-attribuuttia (rivit 90-92):
```javascript
if (kind === "head") return new THREE.SphereGeometry(...);
if (kind === "limb") return new THREE.CapsuleGeometry(...);
if (kind === "torso") return new THREE.BoxGeometry(...);
```

Ei tarvinnut muuttaa — toimii suoraan!

---

## 🧪 Testit

**Tiedosto:** `test-rbx-humanoid-production.mjs`

**45/45 testiä läpäisty:**
- ✅ 4 NPC-mallia (Innkeeper, Blacksmith, Merchant, Priest)
- ✅ Jokainen malli: 1 pää + 1 torso + 4 raajaa = 6 osaa
- ✅ MeshPass käsittelee kaikki 20+ humanoid-osaa
- ✅ Kaikki päät → `Sphere` (pyöreä)
- ✅ Kaikki raajat → `Cylinder` (lieriö)
- ✅ Kaikki torsot → `Box` (luettava vartalo)
- ✅ SpecialMesh lisätty jokaiseen osaan
- ✅ HUMANOID_STRATEGY määritelty
- ✅ _pickHumanoid toimii

**Aja testit:**
```bash
node test-rbx-humanoid-production.mjs
```

---

## 📊 Tulokset

### Ennen vs. Jälkeen

| Aspekti | Ennen | Jälkeen |
|---------|-------|---------|
| **NPC geometria** | 1 Part (2×5×2 Box) | 6 Parts (Head, Torso, 4 Limbs) |
| **Pää** | Box | **Sphere** ●  |
| **Raajat** | - | **Cylinder** ◯ (4 kpl) |
| **Torso** | Box | **Box** (refined Brick mesh) |
| **Preview** | Lattikkko | **Pelimäinen hahmo** |
| **Recognizability** | Debug geometry | **60s RPG NPC** |

### Preview Render (Three.js)

**Innkeeper:**
```
     ●        ← Spherical head (Sand yellow)
    ╱│╲       
   │ █ │      ← Box torso
   │   │      
  │ │ │ │     ← Cylindrical limbs (arms + legs)
```

---

## 🚀 Laajennettavuus

### Lisää hahmoja muihin targeteihin:

**FPS:** Guards/Soldiers
```javascript
buildHumanoid(graph, {
  name: "BlueGuard",
  x: -40, y: 1, z: 0,
  color: "Bright blue",
  tags: ["Guard", "team:blue"],
  attributes: { Team: "Blue", Role: "defender" }
});
```

**Simulator:** Shopkeepers/Pets
```javascript
buildHumanoid(graph, {
  name: "PetShopOwner",
  x: 20, y: 1, z: 10,
  color: "Bright yellow",
  scale: 0.8,
  tags: ["NPC", "Shop"],
  attributes: { ShopType: "pets" }
});
```

**Tycoon:** Workers/Managers
```javascript
buildHumanoid(graph, {
  name: "FactoryManager",
  x: 0, y: 2, z: -30,
  color: "Dark stone grey",
  tags: ["NPC", "Manager"],
  attributes: { Role: "manager" }
});
```

### Custom hahmot:
```javascript
// Hero character (larger)
buildHumanoid(graph, {
  name: "Hero",
  x: 0, y: 1, z: 0,
  color: "Bright red",
  scale: 1.2,  // 20% suurempi
  tags: ["hero", "player-spawn"]
});

// Pet/Companion (smaller)
buildHumanoid(graph, {
  name: "Companion",
  x: 2, y: 1, z: 0,
  color: "Bright yellow",
  scale: 0.5,  // 50% pienempi
  tags: ["pet", "companion"]
});
```

---

## 📝 Muutetut tiedostot

1. ✅ `t3/Factory/rbx-production/humanoid-builder.js` (uusi)
2. ✅ `t3/Factory/rbx-production/mesh-pass.js` (+HUMANOID_STRATEGY)
3. ✅ `t3/Factory/rbx-production/composition-engine.js` (RPG NPCs)
4. ✅ `ui/preview/rbxPreviewUtils.js` (+kind field)
5. ✅ `test-rbx-humanoid-production.mjs` (uusi)

---

## ✅ Hyväksymiskriteerit

- [x] NPC:t eivät näytä debug-laatikoilta
- [x] Päät ovat pyöreitä (Sphere)
- [x] Raajat ovat lieriömäisiä (Cylinder)
- [x] Torso on luettava (Box)
- [x] Preview renderöi hahmot Three.js:llä oikein
- [x] Tuotantolinja pysyy deterministisenä
- [x] Kaikki 45 testiä läpäistävät
- [x] Quality-gate requirements täyttyvät

---

## 🎮 Pelitestaus

**60 sekunnin testi:**  
Pelaaja liittyy RPG-buildiin. Näkee heti:
1. ✅ 4 NPC-hahmoa (ei laatikkoja)
2. ✅ Jokainen hahmo erottuu (pää, vartalo, raajat)
3. ✅ "Tämä on RPG-peli" (ei "debug-moodi")

**→ Hyväksymiskriteerit täyttyvät!**
