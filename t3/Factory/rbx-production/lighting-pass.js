// t3/Factory/rbx-production/lighting-pass.js
// AF51-RBX | T3 Layer — LightingPass
// Role  : Sets atmospheric Lighting service settings and seeds PointLights on
//         tagged parts (start / finish / zone). Deterministic.

// v63 — Per-target Lighting service properties. Technology=Future enables the
// PBR + dynamic GI pipeline (this is the single biggest visual lift over
// stock Voxel lighting). EnvironmentDiffuseScale + EnvironmentSpecularScale
// let MeshParts / metallic surfaces reflect the skybox properly.
const _LIGHTING_BASE = {
  Technology:               "Enum.Technology.Future",
  EnvironmentDiffuseScale:  1,
  EnvironmentSpecularScale: 1,
  GlobalShadows:            true,
  ShadowSoftness:           0.5,
  ExposureCompensation:     0,
};

const ATMOSPHERE_BY_TYPE = {
  obby: {
    ..._LIGHTING_BASE,
    Ambient:               "Color3.fromRGB(70, 90, 120)",
    OutdoorAmbient:        "Color3.fromRGB(120, 150, 180)",
    Brightness:            2,
    ClockTime:             14,
    FogColor:              "Color3.fromRGB(180, 200, 220)",
    FogStart:              0,
    FogEnd:                500,
  },
  tycoon: {
    ..._LIGHTING_BASE,
    Ambient:               "Color3.fromRGB(80, 80, 90)",
    OutdoorAmbient:        "Color3.fromRGB(150, 150, 160)",
    Brightness:            2.5,
    ClockTime:             10,
    FogColor:              "Color3.fromRGB(200, 200, 200)",
    FogStart:              0,
    FogEnd:                800,
  },
  simulator: {
    ..._LIGHTING_BASE,
    Ambient:               "Color3.fromRGB(60, 60, 70)",
    OutdoorAmbient:        "Color3.fromRGB(140, 140, 160)",
    Brightness:            2,
    ClockTime:             12,
    FogColor:              "Color3.fromRGB(210, 215, 225)",
    FogStart:              0,
    FogEnd:                600,
  },
  fps: {
    ..._LIGHTING_BASE,
    Ambient:               "Color3.fromRGB(40, 40, 50)",
    OutdoorAmbient:        "Color3.fromRGB(90, 90, 110)",
    Brightness:            1.5,
    ClockTime:             18,
    FogColor:              "Color3.fromRGB(80, 90, 100)",
    FogStart:              0,
    FogEnd:                300,
  },
  rpg: {
    ..._LIGHTING_BASE,
    Ambient:               "Color3.fromRGB(90, 80, 70)",
    OutdoorAmbient:        "Color3.fromRGB(170, 150, 130)",
    Brightness:            2,
    ClockTime:             16,
    FogColor:              "Color3.fromRGB(200, 180, 160)",
    FogStart:              0,
    FogEnd:                450,
  },
};

// v63 — Per-target Sky child. The Sky instance enables the Future-tech
// envmap pipeline. SkyboxXx properties left blank → Roblox's default
// procedural sky textures are used (deterministic across versions, no
// AssetId hunt). SunAngularSize / MoonAngularSize / StarCount differ per
// target so the sky reads as authored, not as a stock template.
const SKY_BY_TYPE = {
  obby:      { SunAngularSize: 11, MoonAngularSize: 11, StarCount: 3000, CelestialBodiesShown: true },
  tycoon:    { SunAngularSize:  7, MoonAngularSize:  7, StarCount:    0, CelestialBodiesShown: true },
  simulator: { SunAngularSize: 21, MoonAngularSize: 11, StarCount: 1500, CelestialBodiesShown: true },
  fps:       { SunAngularSize: 11, MoonAngularSize: 21, StarCount: 4500, CelestialBodiesShown: true },
  rpg:       { SunAngularSize: 17, MoonAngularSize: 17, StarCount: 2200, CelestialBodiesShown: true },
};

// Tags that get a baseline PointLight pinned on the part.
const LIT_TAGS = ["start", "finish", "zone", "building"];

// Per-target identity colors: { key, accent, rim }. Key = warm focal,
// accent = saturated brand, rim = cool counter-light. Drives the
// SpotLight trio added on every "landmark" part to make the focal
// point read at a distance.
const IDENTITY_BY_TYPE = {
  obby:      { key: "Color3.fromRGB(255, 230, 170)", accent: "Color3.fromRGB(120, 220, 255)", rim: "Color3.fromRGB(160, 180, 255)" },
  tycoon:    { key: "Color3.fromRGB(255, 240, 200)", accent: "Color3.fromRGB(140, 220, 255)", rim: "Color3.fromRGB(180, 200, 255)" },
  simulator: { key: "Color3.fromRGB(245, 245, 255)", accent: "Color3.fromRGB(220, 180, 255)", rim: "Color3.fromRGB(140, 200, 255)" },
  fps:       { key: "Color3.fromRGB(255, 180, 140)", accent: "Color3.fromRGB(255, 90, 90)",   rim: "Color3.fromRGB(120, 160, 200)" },
  rpg:       { key: "Color3.fromRGB(255, 200, 140)", accent: "Color3.fromRGB(255, 170, 90)",  rim: "Color3.fromRGB(140, 160, 220)" },
};

// Per-target post-process tuning. Each effect is created as a child of the
// Lighting service. Same target → same effect tree.
const EFFECTS_BY_TYPE = {
  obby: {
    Atmosphere:            { Density: 0.30, Offset: 0.25, Color: "Color3.fromRGB(199, 222, 240)", Decay: "Color3.fromRGB(106, 112, 125)", Glare: 0.20, Haze: 1.00 },
    BloomEffect:           { Intensity: 0.55, Size: 22, Threshold: 0.95 },
    ColorCorrectionEffect: { Brightness: 0.02, Contrast: 0.10, Saturation: 0.15, TintColor: "Color3.fromRGB(255, 250, 240)" },
    SunRaysEffect:         { Intensity: 0.10, Spread: 0.80 },
    DepthOfFieldEffect:    { FarIntensity: 0.05, FocusDistance: 35, InFocusRadius: 24, NearIntensity: 0.00 },
  },
  tycoon: {
    Atmosphere:            { Density: 0.20, Offset: 0.10, Color: "Color3.fromRGB(220, 220, 220)", Decay: "Color3.fromRGB(100, 100, 100)", Glare: 0.10, Haze: 0.50 },
    BloomEffect:           { Intensity: 0.40, Size: 18, Threshold: 0.97 },
    ColorCorrectionEffect: { Brightness: 0.00, Contrast: 0.05, Saturation: 0.05, TintColor: "Color3.fromRGB(255, 255, 255)" },
    SunRaysEffect:         { Intensity: 0.08, Spread: 0.70 },
    DepthOfFieldEffect:    { FarIntensity: 0.00, FocusDistance: 30, InFocusRadius: 30, NearIntensity: 0.00 },
  },
  simulator: {
    Atmosphere:            { Density: 0.25, Offset: 0.20, Color: "Color3.fromRGB(210, 215, 225)", Decay: "Color3.fromRGB(90, 95, 110)", Glare: 0.25, Haze: 0.80 },
    BloomEffect:           { Intensity: 0.70, Size: 24, Threshold: 0.90 },
    ColorCorrectionEffect: { Brightness: 0.03, Contrast: 0.12, Saturation: 0.30, TintColor: "Color3.fromRGB(245, 250, 255)" },
    SunRaysEffect:         { Intensity: 0.15, Spread: 0.85 },
    DepthOfFieldEffect:    { FarIntensity: 0.10, FocusDistance: 40, InFocusRadius: 20, NearIntensity: 0.05 },
  },
  fps: {
    Atmosphere:            { Density: 0.45, Offset: 0.40, Color: "Color3.fromRGB(80, 90, 100)", Decay: "Color3.fromRGB(40, 50, 60)", Glare: 0.05, Haze: 2.00 },
    BloomEffect:           { Intensity: 0.30, Size: 20, Threshold: 0.92 },
    ColorCorrectionEffect: { Brightness: -0.05, Contrast: 0.20, Saturation: -0.20, TintColor: "Color3.fromRGB(220, 225, 235)" },
    SunRaysEffect:         { Intensity: 0.04, Spread: 0.60 },
    DepthOfFieldEffect:    { FarIntensity: 0.20, FocusDistance: 25, InFocusRadius: 12, NearIntensity: 0.10 },
  },
  rpg: {
    Atmosphere:            { Density: 0.35, Offset: 0.30, Color: "Color3.fromRGB(200, 180, 160)", Decay: "Color3.fromRGB(110, 90, 70)", Glare: 0.30, Haze: 1.50 },
    BloomEffect:           { Intensity: 0.60, Size: 22, Threshold: 0.94 },
    ColorCorrectionEffect: { Brightness: 0.02, Contrast: 0.15, Saturation: 0.20, TintColor: "Color3.fromRGB(255, 240, 215)" },
    SunRaysEffect:         { Intensity: 0.18, Spread: 0.90 },
    DepthOfFieldEffect:    { FarIntensity: 0.08, FocusDistance: 32, InFocusRadius: 22, NearIntensity: 0.02 },
  },
};

export const LightingPass = {
  apply({ graph, target }) {
    const type = String(target.type || target.id || "").toLowerCase();
    const atm  = ATMOSPHERE_BY_TYPE[type] || ATMOSPHERE_BY_TYPE.obby;
    graph.setService("Lighting", atm);

    let lightsAdded = 0;
    const litParts = graph.nodes.filter(
      (n) => n.className === "Part" && n.tags.some((t) => LIT_TAGS.includes(t)),
    );

    for (let i = 0; i < litParts.length; i++) {
      const part = litParts[i];
      graph.add({
        className: "PointLight",
        name:      "Light_" + part.name,
        parent:    "Workspace/AF51Scene/" + part.name,
        properties: {
          Brightness: 2,
          Range:      18,
          Color:      part.properties.Color || "Color3.fromRGB(255, 255, 255)",
          Shadows:    true,
        },
        tags: ["scene-light"],
      });
      lightsAdded++;
    }

    // Identity lighting — key/accent/rim on every "landmark" part so the
    // focal object reads from across the map regardless of atmosphere.
    const ident       = IDENTITY_BY_TYPE[type] || IDENTITY_BY_TYPE.obby;
    const landmarks   = graph.nodes.filter(
      (n) => n.className === "Part" && n.tags.includes("landmark"),
    );
    let identityLights = 0;
    for (const lm of landmarks) {
      const parentPath = "Workspace/AF51Scene/" + lm.name;
      graph.add({
        className: "PointLight", name: "Key_" + lm.name, parent: parentPath,
        properties: { Brightness: 4,  Range: 28, Color: ident.key,    Shadows: true  },
        tags: ["identity-light", "key"],
      });
      graph.add({
        className: "PointLight", name: "Accent_" + lm.name, parent: parentPath,
        properties: { Brightness: 3,  Range: 20, Color: ident.accent, Shadows: false },
        tags: ["identity-light", "accent"],
      });
      graph.add({
        className: "PointLight", name: "Rim_" + lm.name, parent: parentPath,
        properties: { Brightness: 1.5, Range: 24, Color: ident.rim,   Shadows: false },
        tags: ["identity-light", "rim"],
      });
      identityLights += 3;
    }

    // Beacon lights — every "beacon"-tagged Part already uses Neon; pin a
    // bright PointLight on it so it pulses in the dark.
    const beacons = graph.nodes.filter(
      (n) => n.className === "Part" && n.tags.includes("beacon"),
    );
    let beaconLights = 0;
    for (const b of beacons) {
      graph.add({
        className: "PointLight", name: "BeaconLight_" + b.name,
        parent: "Workspace/AF51Scene/" + b.name,
        properties: {
          Brightness: 5, Range: 32,
          Color: b.properties.Color || ident.accent,
          Shadows: false,
        },
        tags: ["beacon-light"],
      });
      beaconLights++;
    }

    // Post-process effects parented directly under the Lighting service.
    // RobloxEmitter recognizes parent="Lighting" and emits them in the
    // atmosphere script (which already holds a Lighting service reference).
    const effects = EFFECTS_BY_TYPE[type] || EFFECTS_BY_TYPE.obby;
    let effectsAdded = 0;
    const orderedNames = Object.keys(effects).sort();
    for (const className of orderedNames) {
      graph.add({
        className,
        name:       "AF51" + className,
        parent:     "Lighting",
        properties: effects[className],
        tags:       ["lighting-effect"],
      });
      effectsAdded++;
    }

    // v63 — Sky child. With Technology=Future the engine pulls envmap data
    // from the Sky for PBR reflections on metallic surfaces.
    const skyProps = SKY_BY_TYPE[type] || SKY_BY_TYPE.obby;
    graph.add({
      className:  "Sky",
      name:       "AF51Sky",
      parent:     "Lighting",
      properties: skyProps,
      tags:       ["lighting-effect", "sky"],
    });
    effectsAdded++;

    return {
      ok: true, atmosphereType: type,
      lightsAdded, identityLights, beaconLights, effectsAdded,
    };
  },
};

export default LightingPass;
