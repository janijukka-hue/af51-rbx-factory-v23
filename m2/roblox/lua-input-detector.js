// m2/roblox/lua-input-detector.js — ESM
// AF51 ROBLOX — Lua-input detector.
//
// Detects whether a freeform input string is Roblox Lua source code (so the
// build router preserves it as AF51UserSeed.server.lua) vs a target-prompt
// keyword (so the router runs the canonical CompositionEngine pipeline).
//
// The detector is intentionally conservative: a string with even one
// Roblox-specific identifier (Instance.new, Vector3.new, CFrame.new,
// game:GetService, workspace.*) counts as Lua. Plain English prompts and
// short tokens like "obby" / "tycoon" do not match any of these patterns
// and route to the normal target pipeline.
//
// Returns:
//   { isLua, score, signals: string[], summary }
//
// `score` is an integer count of distinct Lua signals matched, useful for
// surfacing confidence in the build response.

const LUA_SIGNALS = [
  { re: /\bInstance\.new\b/,            label: "Instance.new"      },
  { re: /\bVector3\.new\b/,             label: "Vector3.new"       },
  { re: /\bCFrame\.new\b/,              label: "CFrame.new"        },
  { re: /\bCFrame\.Angles\b/,           label: "CFrame.Angles"     },
  { re: /\bColor3\.(new|fromRGB)\b/,    label: "Color3.*"          },
  { re: /\bgame:GetService\b/,          label: "game:GetService"   },
  { re: /\bworkspace\.[A-Z]/,           label: "workspace.*"       },
  { re: /\bscript\.(Parent|Name)\b/,    label: "script.*"          },
  { re: /\bRunService\.\w+/,            label: "RunService.*"      },
  { re: /\bCollectionService\.\w+/,     label: "CollectionService.*"},
  { re: /\bplayer\.Character/,          label: "player.Character"  },
  { re: /\blocal\s+\w+\s*=\s*Instance/, label: "local x = Instance"},
  { re: /\b:Connect\(/,                 label: ":Connect(...)"     },
  { re: /\bEnum\.[A-Z]\w+\.[A-Z]\w+/,   label: "Enum.X.Y"          },
];

// A Lua source is also indicated by the presence of multiple structural
// keywords in close proximity: "local", "function", "end", "then", "return".
// Plain prose has these scattered or absent.
function _structuralScore(s) {
  const keywords = ["local", "function", "end", "then", "return", "elseif", "pairs", "ipairs"];
  let n = 0;
  for (const k of keywords) {
    const re = new RegExp("\\b" + k + "\\b", "g");
    const m  = s.match(re);
    if (m && m.length > 0) n++;
  }
  return n;
}

/**
 * Detect whether `input` is Roblox Lua source code.
 *
 * @param {string|null|undefined} input
 * @returns {{isLua: boolean, score: number, signals: string[], summary: string}}
 */
export function detectLuaInput(input) {
  if (typeof input !== "string" || input.length === 0) {
    return { isLua: false, score: 0, signals: [], summary: "empty input" };
  }

  const signals = [];
  for (const sig of LUA_SIGNALS) {
    if (sig.re.test(input)) signals.push(sig.label);
  }
  const structural = _structuralScore(input);

  // Conservative rule: any single Roblox-specific signal OR (2+ Lua
  // structural keywords AND input length >= 60). The length floor prevents
  // a stray "local function" in a prompt from being misclassified.
  const isLua =
    signals.length > 0 ||
    (structural >= 2 && input.length >= 60);

  const score = signals.length + (structural >= 2 ? 1 : 0);
  const summary = isLua
    ? `Lua detected (signals=${signals.length}, structural=${structural}, bytes=${input.length})`
    : `not Lua (signals=${signals.length}, structural=${structural}, bytes=${input.length})`;

  return { isLua, score, signals, summary };
}

/**
 * Route an input to one of two build paths:
 *   - "LUA_IMPORT_BUILD": the input is Lua source; preserve verbatim.
 *   - "TARGET_BUILD":      the input is a target prompt / id.
 *
 * `targetId` is always honored for the geometry pipeline — Lua input is
 * an ADDITIVE seed, never a replacement for the target template (the
 * production world still gets the AF51 SceneBuilder, the user seed runs
 * alongside it). The route name controls the response shape only.
 *
 * @param {{ source?: string|null, targetId?: string|null }} request
 * @returns {{ route: "LUA_IMPORT_BUILD"|"TARGET_BUILD",
 *             userSource: string|null,
 *             detection: ReturnType<typeof detectLuaInput> }}
 */
export function routeBuildRequest(request) {
  const src = (request && request.source) || null;
  const det = detectLuaInput(src);
  if (det.isLua) {
    return { route: "LUA_IMPORT_BUILD", userSource: src, detection: det };
  }
  return { route: "TARGET_BUILD", userSource: null, detection: det };
}

export default { detectLuaInput, routeBuildRequest };
