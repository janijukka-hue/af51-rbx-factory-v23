// ui/MasterRoomUI.js
// AF51 Product Edition — public production interface + clean admin cockpit
// Scope: UI shell only. Factory pipeline, vault, publish and backend routes are left intact.

import React, { useState, useCallback, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Linking,
  Modal
} from "react-native";
import LiveRenderView from "../s4/screens/Preview/LiveRenderView.js";
import RbxPreviewCanvas from "./preview/RbxPreviewCanvas.js";
import RbxHierarchyPanel from "./preview/RbxHierarchyPanel.js";
import RbxInspectorPanel from "./preview/RbxInspectorPanel.js";
import RbxDesignReportPanel from "./preview/RbxDesignReportPanel.js";
import { normalizeStructures, structuresFromPreviewData } from "./preview/rbxPreviewUtils.js";
import { useAppActions } from "../s4/state/AppContext.js";
import { normalizeLuaBuild } from "../s4/state/latestBuild.js";

var SERVER = "http://localhost:3000";
var AF51_BG = require("../assets/af51-nordic-intelligence.jpg");

function MasterRoomUI(props) {
  var orchestrator = props.orchestrator;
  var masterRoom = props.masterRoom;
  var alx = props.alx;
  // Shared build state: a lua-build RUN here also publishes to latestBuild so
  // the Cockpit shows it. Read-only to the production line.
  var appActions = useAppActions();
  var onNavigateToPreview = props.onNavigateToPreview;
  var sharedPreviewCode = props.sharedPreviewCode || null;

  var messagesState = useState([]);
  var messages = messagesState[0];
  var setMessages = messagesState[1];

  var inputState = useState("");
  var inputText = inputState[0];
  var setInputText = inputState[1];

  var loadingState = useState(false);
  var isLoading = loadingState[0];
  var setIsLoading = loadingState[1];

  var previewSrcState = useState(null);
  var previewSource = previewSrcState[0];
  var setPreviewSource = previewSrcState[1];

  var actionState = useState(null);
  var activeAction = actionState[0];
  var setActiveAction = actionState[1];

  var wsState = useState({ projectId: null, label: null, savedAt: null, snapCount: 0, lastReleaseId: null, lastZipUrl: null, rbxBuildId: null, rbxTargetId: null, rbxZipName: null, rbxDurationMs: null, rbxGhostId: null, rbxArtifactHash: null });
  var ws = wsState[0];
  var setWs = wsState[1];

  var bannerState = useState(null);
  var banner = bannerState[0];
  var setBanner = bannerState[1];

  var activeViewState = useState("builder");
  var activeView = activeViewState[0];
  var setActiveView = activeViewState[1];

  var scrollViewRef = useRef(null);
  var bannerTimer = useRef(null);
  // Build sequence guard — every new build bumps this; stale async responses
  // from an older build (slow fetch + user clicked Build again) are discarded.
  var buildSeqRef = useRef(0);


  var buildPhaseState = useState("idle");
  var buildPhase = buildPhaseState[0];
  var setBuildPhase = buildPhaseState[1];

  // RBX preview state — stores targetId after successful build
  var rbxPreviewTargetState = useState(null);
  var rbxPreviewTarget = rbxPreviewTargetState[0];
  var setRbxPreviewTarget = rbxPreviewTargetState[1];
  // Preview data — v63: production-scenegraph.json from /rbx/build (preferred);
  // generatedPreview.json fallback. Single source of truth = ZIP artifact.
  var rbxPreviewDataState = useState(null);
  var rbxPreviewData = rbxPreviewDataState[0];
  var setRbxPreviewData = rbxPreviewDataState[1];
  // v63: Masterpiece quality report (production-quality-report.json) for HUD.
  var rbxQualityReportState = useState(null);
  var rbxQualityReport = rbxQualityReportState[0];
  var setRbxQualityReport = rbxQualityReportState[1];

  // Dual Preview Intelligence — Creative Director design report (read-only).
  var rbxDesignReportState = useState(null);
  var rbxDesignReport = rbxDesignReportState[0];
  var setRbxDesignReport = rbxDesignReportState[1];

  // Studio Director (readiness) + Cinematic Director (shots).
  var rbxStudioReportState = useState(null);
  var rbxStudioReport = rbxStudioReportState[0];
  var setRbxStudioReport = rbxStudioReportState[1];
  var rbxShotsState = useState(null);
  var rbxShots = rbxShotsState[0];
  var setRbxShots = rbxShotsState[1];
  // v65: Parser diagnostics (factory expansion, parent resolution, etc.)
  var rbxDiagnosticsState = useState(null);
  var rbxDiagnostics = rbxDiagnosticsState[0];
  var setRbxDiagnostics = rbxDiagnosticsState[1];

  // Reset every RBX-build-derived UI surface back to empty. Used at the start
  // of each new build (so stale ZIP / preview / quality report disappear
  // immediately, not when the new response arrives) and from CLEAR. Preserves
  // non-RBX session fields (projectId/label/savedAt/snapCount/lastRelease*)
  // because those belong to the React save-flow, not the RBX build slot.
  var resetRbxBuildState = useCallback(function() {
    setWs(function(prev) {
      return Object.assign({}, prev, {
        rbxBuildId:      null,
        rbxTargetId:     null,
        rbxZipName:      null,
        rbxDurationMs:   null,
        rbxZipSizeBytes: null,
        rbxPhaseCount:   null,
        rbxGhostId:      null,
        rbxArtifactHash: null,
      });
    });
    setRbxPreviewTarget(null);
    setRbxPreviewData(null);
    setRbxQualityReport(null);
    setRbxDesignReport(null);
    setRbxStudioReport(null);
    setRbxShots(null);
    setRbxDiagnostics(null);
  }, []);

  var selectedIdState = useState(null);
  var selectedId = selectedIdState[0];
  var setSelectedId = selectedIdState[1];

  var fullscreenState = useState(false);
  var isFullscreen = fullscreenState[0];
  var setIsFullscreen = fullscreenState[1];

  React.useEffect(function() {
    // HARD GUARD: only load shared preview code for non-RBX flows
    if (sharedPreviewCode && sharedPreviewCode.trim().length > 10 && !looksLikeLuau(sharedPreviewCode)) {
      updatePreviewSource(sharedPreviewCode);
      addMessage("system", "📂 WORK LOADED — ready for preview, save and publish.", {});
    }
  }, [sharedPreviewCode]);

  function showBanner(type, msg) {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ type: type, msg: msg });
    bannerTimer.current = setTimeout(function() { setBanner(null); }, type === "error" ? 4500 : 2600);
  }

  var addMessage = useCallback(function(role, content, metadata) {
    setMessages(function(prev) {
      return prev.concat([{
        id: Date.now().toString() + "_" + Math.random().toString(16).slice(2),
        role: role,
        content: content,
        metadata: metadata || {},
        timestamp: new Date().toISOString()
      }]);
    });

    setTimeout(function() {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 80);
  }, [setMessages]);

  function normalizeSourceText(text) {
    return String(text || "")
      .replace(/\u00A0/g, " ")
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
      .replace(/[\u2028\u2029]/g, "\n")
      // Defensive: strip placeholder text if it ever leaks into the value
      .replace(/describe what you want to build,?\s*or paste source instructions\.{0,3}/gi, "")
      .replace(/^describ\b/i, "");
  }

  function looksLikeBuildStatus(text) {
    var s = normalizeSourceText(text).trim();
    return (
      s.startsWith("Build valmis!") ||
      s.includes("Katso Preview Roomista") ||
      s.includes("Build ID:") ||
      s.includes("Koodia:")
    );
  }

  function sanitizeReactSource(text) {
    var s = normalizeSourceText(text).trim();
    s = s.replace(/^\s*build\s+(?=import\s+)/i, "");
    s = s.replace(/^\s*build\s+(?=function\s+App\s*\()/i, "");
    s = s.replace(/^\s*build\s+(?=export\s+default\s+function\s+App\s*\()/i, "");
    return s.trim();
  }

  function looksLikeReactApp(text) {
    var s = sanitizeReactSource(text);
    if (!s) return false;
    if (looksLikeBuildStatus(s)) return false;
    return (
      s.includes("function App(") ||
      s.includes("function App()") ||
      s.includes("export default function App")
    );
  }

  // ── RBX / Luau detection ────────────────────────────────────────────────
  function looksLikeLuau(text) {
    var s = normalizeSourceText(text || "").trim();
    if (!s) return false;
    return (
      s.includes("--!strict") ||
      s.includes("local function") ||
      s.includes("task.spawn") ||
      s.includes("game:GetService") ||
      s.includes("RunService") ||
      s.includes("Instance.new") ||
      s.includes("Vector3.new") ||
      s.includes("CFrame.new") ||
      s.includes("Color3.") ||
      (s.includes("local ") && s.includes("= require(")) ||
      /^--\s*AF51/m.test(s)
    );
  }

  // Detect RAW object-creation Lua (vs runtime/module Lua)
  function looksLikeRawLua(text) {
    var s = normalizeSourceText(text || "").trim();
    if (!s) return false;
    // Roblox/Luau API signals — any one of these means it's code, not a prompt.
    var signals = [
      "Instance.new", "Vector3.new", "CFrame.new", "CFrame.Angles",
      "Color3.", "UDim2.new", "Enum.", "game:GetService", "game.",
      "workspace", "script.Parent", "script.Name", ":Connect(",
      "RunService", "CollectionService"
    ];
    for (var i = 0; i < signals.length; i++) {
      if (s.indexOf(signals[i]) !== -1) return true;
    }
    // Structural fallback: several Lua keywords across multiple lines.
    var kw = (s.match(/\b(local|function|end|then|return|elseif|pairs|ipairs)\b/g) || []).length;
    var lines = s.split(/\n/).length;
    return kw >= 2 && lines >= 2;
  }

  function extractRbxTargetFromInput(text) {
    var s = normalizeSourceText(text || "").toLowerCase();
    if (s.includes("obby"))      return "obby";
    if (s.includes("tycoon"))    return "tycoon";
    if (s.includes("simulator") || s.includes("sim")) return "simulator";
    if (s.includes("rpg"))       return "rpg";
    if (s.includes("fps"))       return "fps";
    if (/checkpoint|obstacle|killbrick|killpart|lavabrick/.test(s)) return "obby";
    if (/dropper|conveyor|cash|coin|money|buyport/.test(s))         return "tycoon";
    if (/zone(bronze|silver|gold)|tierreward|leaderstats/.test(s))  return "simulator";
    if (/weapon|gun|ammo|shoot|spawnenemy|cover|arena/.test(s))     return "fps";
    if (/sword|quest|npc|dialog|kingdom|tavern/.test(s))            return "rpg";
    return null;
  }

  function extractCodeBlock(text) {
    var s = normalizeSourceText(text);
    var match = s.match(/```(?:jsx|js|javascript|react)?\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
  }

  function validateSourceForSave(src) {
    var s = sanitizeReactSource(src);
    if (!s) return { ok: false, error: "Source missing. Paste or build first." };
    if (looksLikeBuildStatus(s)) return { ok: false, error: "Source is build status, not code." };
    // Accept both React apps AND Luau/Roblox scripts
    if (looksLikeReactApp(s) || looksLikeLuau(s)) {
      if (s.length < 50) return { ok: false, error: "Source too short." };
      return { ok: true };
    }
    return { ok: false, error: "Source missing. Paste React or Luau code first." };
  }

  function updatePreviewSource(code) {
    // HARD GUARD: never update React preview source in RBX mode
    // Check ws state indirectly via previewSource pattern — ws not accessible here
    // Primary guard is at call sites (isRbxCommand check)
    if (looksLikeReactApp(code)) {
      setPreviewSource(sanitizeReactSource(code));
    }
  }

  function getLastSource() {
    if (looksLikeReactApp(previewSource)) return sanitizeReactSource(previewSource);

    for (var i = messages.length - 1; i >= 0; i--) {
      var m = messages[i];
      if (!m || !m.content) continue;

      var block = extractCodeBlock(m.content);
      if (looksLikeReactApp(block)) return sanitizeReactSource(block);
      if (looksLikeReactApp(m.content)) return sanitizeReactSource(m.content);
    }

    return null;
  }

  function openPreviewWithSource(src) {
    var validation = validateSourceForSave(src);
    if (!validation.ok) {
      showBanner("error", validation.error);
      addMessage("system", "⚠ PREVIEW — " + validation.error, {});
      return;
    }

    var cleanSource = sanitizeReactSource(src);
    setPreviewSource(cleanSource);
    showBanner("success", "Preview source locked");

    if (typeof onNavigateToPreview === "function") {
      onNavigateToPreview(cleanSource);
    }
  }

  function commandWithBuildPrefix(text) {
    var clean = String(text || "").trim();
    if (!clean) return clean;
    if (/^build\b/i.test(clean)) return clean;
    return "build " + clean;
  }

  var handleSend = useCallback(async function() {
    if (!inputText.trim() || isLoading) return;

    // ── CRITICAL: capture raw input BEFORE setInputText("") clears state ──
    var rawInput    = normalizeSourceText(inputText).trim();
    var userCommand = commandWithBuildPrefix(inputText);
    setInputText("");
    // Clear every RBX surface from the previous build BEFORE going into the
    // "building" phase, so the old ZIP name / preview / quality report don't
    // hang on screen while the new fetch is in flight. Also bump the build
    // sequence so a late-arriving response from the previous build is dropped.
    resetRbxBuildState();
    var mySeq = ++buildSeqRef.current;
    setIsLoading(true);
    setBuildPhase("building");
    addMessage("user", userCommand, { pipeline: "Input" });

    try {
      var result;

      // ── RBX route (v63 — PRODUCTION GRADE): every input flows through the
      // v62 Masterpiece pipeline at /rbx/build. The legacy /rbx/lua-build
      // debug path was a routing trap — raw Lua (Instance.new / Vector3.new)
      // bypassed the orchestrator and produced a bare lua-parse echo with
      // no materials, lighting, mesh, decals, or terrain. v63 closes that
      // loophole: pasted Lua is carried as a seed payload (`source`) so the
      // orchestrator can preserve it in the zip, while the world the user
      // sees on screen is always the production-grade output.
      // ── RBX routing (CORRECTED) ───────────────────────────────────────
      // The factory is a PRODUCTION LINE, not a template dispenser. If the
      // Build Input contains Roblox/Luau code, the user's source IS the
      // material to be produced — route it to /rbx/lua-build (parse → project
      // → preview → ZIP). Only a bare target command (no code) goes to the
      // template line at /rbx/build. We do NOT fall back to a template world
      // when a Lua build fails — a failure shows the error, never a fake world.
      var isRbxCommand = true;

      if (isRbxCommand) {
        var isLuaInput = looksLikeRawLua(rawInput);

        if (isLuaInput) {
          // ── PRODUCTION LINE: build the user's code into a ZIP ───────────
          addMessage("system",
            "⬡ RBX PRODUCTION LINE — building from your source (parse → project → ZIP)", {});
          try {
            var luaRes = await fetch(SERVER + "/rbx/lua-build", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ source: rawInput })
            });
            var luaData = await luaRes.json();
            if (mySeq !== buildSeqRef.current) { return; }

            if (luaData.ok) {
              var luaZip = luaData.zipName || (luaData.downloadUrl ? luaData.downloadUrl.split(/[\\/]/).pop() : null);
              var luaSig = luaData.signature || {};
              setWs(function(prev) {
                return Object.assign({}, prev, {
                  rbxBuildId:      luaData.buildId || null,
                  rbxTargetId:     "source",          // produced from code, not a template
                  rbxZipName:      luaZip,
                  rbxDurationMs:   luaData.durationMs || 0,
                  rbxZipSizeBytes: luaData.zipSizeBytes || 0,
                  rbxPhaseCount:   luaData.fileCount || 0,
                  // signature is an OBJECT { factory, buildId, fingerprint, masterHash, fileCount }
                  rbxGhostId:      luaSig.buildId || luaData.buildId || null,
                  rbxArtifactHash: luaSig.fingerprint || (luaSig.masterHash ? String(luaSig.masterHash).slice(0, 8) : null),
                });
              });
              setBuildPhase("success");

              // Preview/hierarchy come from the USER'S code, not a template.
              setRbxPreviewTarget("source");
              if (luaData.previewData) {
                setRbxPreviewData(luaData.previewData);
              }
              setRbxQualityReport(luaData.quality || null);
              setRbxDesignReport(luaData.design || null);
              setRbxStudioReport(luaData.studio || null);
              setRbxShots(luaData.shots || null);
              setRbxDiagnostics(luaData.diagnostics || null);
              // Publish to shared state so the Cockpit reflects this build too.
              appActions.setLatestBuild(normalizeLuaBuild(rawInput, luaData));

              result = {
                ok: true,
                output: "✓ RBX BUILD OK (from source)\n" +
                  "Build:     " + (luaData.buildId || "—") + "\n" +
                  "ZIP:       " + (luaZip || "—") + "\n" +
                  "Instances: " + (luaData.instanceCount != null ? luaData.instanceCount : "—") + "\n" +
                  "Files:     " + (luaData.fileCount != null ? luaData.fileCount : "—") + "\n" +
                  (luaSig.fingerprint ? ("Signature: " + luaSig.fingerprint + "\n") : "") +
                  "\nZIP ready for download.",
                intent: "RBX_LUA_BUILD",
                durationMs: luaData.durationMs || 0,
              };
            } else {
              // No template fallback — show the real error.
              setBuildPhase("failed");
              result = {
                ok: false,
                output: "✗ RBX SOURCE BUILD FAILED\n" + (luaData.error || "Unknown error"),
                intent: "RBX_LUA_BUILD",
              };
            }
          } catch (luaErr) {
            if (mySeq !== buildSeqRef.current) { return; }
            setBuildPhase("failed");
            var _luaHint = (luaErr.message || "").includes("Failed to fetch") || (luaErr.message || "").includes("NetworkError")
              ? "\n\n⚠ Server not reachable at " + SERVER + "\nStart it first:  npm run server"
              : "";
            result = {
              ok: false,
              output: "✗ RBX SOURCE BUILD ERROR\n" + (luaErr.message || String(luaErr)) + _luaHint,
              intent: "RBX_LUA_BUILD",
            };
          }

        } else {
          // ── TEMPLATE LINE: bare target command, no code in input ────────
          var rbxTarget = extractRbxTargetFromInput(rawInput) || "rpg";
          addMessage("system",
            "⬡ RBX TEMPLATE LINE — target build: " + rbxTarget.toUpperCase(), {});
          try {
            var rbxRes = await fetch(SERVER + "/rbx/build", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetId: rbxTarget, profileId: "development", source: rawInput })
            });
            var rbxData = await rbxRes.json();
          // ── STALE-RESPONSE GUARD ──────────────────────────────────────
          // If the user already started a newer build while this one was
          // in flight, drop this response on the floor — the newer build
          // owns the UI now.
          if (mySeq !== buildSeqRef.current) {
            return;
          }
          if (rbxData.ok) {
            // Use zipName from server (explicit field) or derive from zipPath
            // Windows-safe basename: split on BOTH / and \\ then take last segment
            var zipName = rbxData.zipName || (rbxData.zipPath ? rbxData.zipPath.split(/[\\/]/).pop() : null);
            // dlUrl intentionally not stored in ws state — download triggered explicitly by user
            // Store in workspace state so SAVE + EXPORT ZIP can use it
            setWs(function(prev) {
              return Object.assign({}, prev, {
                rbxBuildId:      rbxData.buildId      || null,
                rbxTargetId:     rbxTarget,
                rbxZipName:      zipName,
                rbxDurationMs:   rbxData.durationMs   || 0,
                rbxZipSizeBytes: rbxData.zipSizeBytes  || 0,
                rbxPhaseCount:   rbxData.phases        || 13,
                rbxGhostId:      rbxData.ghostId      || null,
                rbxArtifactHash: rbxData.artifactHash || null,
              });
            });
            setBuildPhase("success");

            // ── PREVIEW: set from build response immediately ──────────
            // previewData + qualityReport come inline with /rbx/build response — no second fetch
            setRbxPreviewTarget(rbxTarget);
            if (rbxData.previewData) {
              setRbxPreviewData(rbxData.previewData);
            }
            setRbxQualityReport(rbxData.qualityReport || null);

            result = {
              ok: true,
              output: "✓ RBX BUILD OK\n" +
                "Target:  " + rbxTarget.toUpperCase() + "\n" +
                "Build:   " + (rbxData.buildId || "—") + "\n" +
                "ZIP:     " + (zipName || "—") + "\n" +
                "Phases:  " + (rbxData.phases || 13) + "/" + (rbxData.phases || 13) + " ✓\n" +
                "Time:    " + (rbxData.durationMs || 0) + "ms\n" +
                (rbxData.ghostId
                  ? ("Ghost:   " + rbxData.ghostId + "\n" +
                     "Hash:    " + (rbxData.artifactHash || "—") + "\n")
                  : "") +
                "\nZIP ready for download.",
              intent: "RBX_BUILD",
              durationMs: rbxData.durationMs || 0,
            };
          } else {
            setBuildPhase("failed");
            result = {
              ok: false,
              output: "✗ RBX BUILD FAILED\n" + (rbxData.error || "Unknown error") +
                "\n\nErrors:\n" + (rbxData.errors || []).slice(0, 5).join("\n"),
              intent: "RBX_BUILD",
            };
          }
        } catch (rbxErr) {
          if (mySeq !== buildSeqRef.current) {
            return; // newer build already taken over — discard
          }
          setBuildPhase("failed");  // CRITICAL: reset so UI doesn't hang in "building"
          var _hint = (rbxErr.message || "").includes("Failed to fetch") || (rbxErr.message || "").includes("NetworkError")
            ? "\n\n⚠ Server not reachable at " + SERVER + "\nStart it first:  npm run server"
            : "";
          result = { ok: false, output: "✗ RBX SERVER ERROR\n" + rbxErr.message + _hint, intent: "RBX_BUILD" };
        }
        } // end template-line else
      } else if (masterRoom) {
        result = await masterRoom.execute(userCommand, {});
      } else if (orchestrator) {
        result = await orchestrator.execute(userCommand, {});
      } else if (alx) {
        result = await alx.execute(userCommand, {});
      } else {
        result = { ok: false, output: "No execution engine available" };
      }

      var responseText = result.output || result.error || "No response";
      addMessage("factory", responseText, {
        intent: result.intent,
        skill: result.skill,
        durationMs: result.durationMs,
        ok: result.ok,
        pipeline: isRbxCommand ? "RBX Build" : (result.ok === false ? "Rejected" : "Build")
      });

      // ── HARD ISOLATION: RBX commands NEVER touch legacy preview renderer ──
      if (!isRbxCommand) {
        var block = extractCodeBlock(responseText);
        if (looksLikeReactApp(block)) updatePreviewSource(block);
        else if (looksLikeReactApp(responseText)) updatePreviewSource(responseText);
      }

      showBanner(result.ok === false ? "error" : "success", result.ok === false ? "Build failed" : "Build completed");
    } catch (err) {
      addMessage("system", "❌ EXECUTION ERROR\n" + err.message, { ok: false });
      showBanner("error", err.message || "Execution failed");
    } finally {
      setIsLoading(false);
      // Safety net: if build somehow left phase in "building", reset to idle
      setBuildPhase(function(prev) { return prev === "building" ? "idle" : prev; });
    }
  }, [inputText, isLoading, masterRoom, orchestrator, alx, addMessage, resetRbxBuildState]);

  var handleWorkspaceAction = useCallback(async function(action) {
    if (activeAction) return;
    setActiveAction(action);

    try {
      if (action === "save") {
        // ── RBX build path — local save only, no server round-trip ────────
        // /workspace/save injects Vite/React pipeline. RBX metadata stays local.
        if (ws.rbxBuildId || buildPhase === "success") {
          var savedAt = Date.now();
          setWs(function(prev) { return Object.assign({}, prev, {
            savedAt:   savedAt,
            projectId: prev.rbxBuildId || prev.projectId,  // show build id in WORKSPACE panel
            label:     "RBX " + (prev.rbxTargetId || "").toUpperCase(),
          }); });
          addMessage("system",
            "✅ BUILD LOCKED\n" +
            "Target:  " + (ws.rbxTargetId || "").toUpperCase() + "\n" +
            "Build:   " + ws.rbxBuildId + "\n" +
            "ZIP:     " + ws.rbxZipName + "\n\n" +
            "→ EXPORT ZIP to download", {});
          showBanner("success", "✓ " + (ws.rbxTargetId||"").toUpperCase() + " build locked");
          return;
        }

        // ── React/web build path ──────────────────────────────────────────
        var src = getLastSource();
        var validation = validateSourceForSave(src);
        if (!validation.ok) {
          showBanner("error", validation.error);
          addMessage("system", "⚠ SAVE — " + validation.error + "\n\nRun BUILD first (type: build obby / build tycoon / etc.)", {});
          return;
        }

        var isLuauSrc = looksLikeLuau(src);
        if (!isLuauSrc) src = sanitizeReactSource(src);
        var savePayload = {
          source: src,
          files: isLuauSrc
            ? [{ path: "src/main.lua", content: src }]
            : [{ path: "src/App.jsx", content: src }],
          projectId: ws.projectId || null,
          label: "AF51 Product Build " + new Date().toLocaleString("fi-FI")
        };

        var r = await fetch(SERVER + "/workspace/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(savePayload)
        });
        var d = await r.json();

        if (d.ok) {
          setWs(function(prev) { return Object.assign({}, prev, { projectId: d.projectId, label: d.meta && d.meta.label, savedAt: Date.now() }); });
          addMessage("system", "✅ SAVED\nproject: " + d.projectId + "\nhash: " + (d.meta && d.meta.sourceHash ? d.meta.sourceHash.slice(0, 12) : "—"), {});
          showBanner("success", "Saved — " + (d.projectId || "ok"));
        } else {
          showBanner("error", d.error || "Save failed");
          addMessage("system", "❌ SAVE FAILED\n" + (d.error || "unknown"), {});
        }
      }

      if (action === "snapshot") {
        if (!ws.projectId) {
          showBanner("error", "Save first");
          addMessage("system", "⚠ SNAPSHOT — run a build first.", {});
          return;
        }

        var rs = await fetch(SERVER + "/workspace/" + ws.projectId + "/snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "Snap " + new Date().toLocaleString("fi-FI") })
        });
        var ds = await rs.json();

        if (ds.ok) {
          setWs(Object.assign({}, ws, { snapCount: (ws.snapCount || 0) + 1 }));
          addMessage("system", "📸 SNAPSHOT OK\nid: " + ds.snapId + "\nproject: " + ds.projectId, {});
          showBanner("success", "Snapshot created");
        } else {
          showBanner("error", ds.error || "Snapshot failed");
          addMessage("system", "❌ SNAPSHOT FAILED\n" + (ds.error || "unknown"), {});
        }
      }

      if (action === "vault") {
        var rv = await fetch(SERVER + "/vault/builds");
        var dv = await rv.json();
        if (dv.ok) {
          var builds = dv.builds || [];
          if (builds.length === 0) {
            addMessage("system", "📦 VAULT — empty. Save and build first.", {});
          } else {
            var lines = ["📦 VAULT — " + builds.length + " builds"];
            builds.slice(0, 6).forEach(function(b, i) {
              var date = b.savedAt ? new Date(b.savedAt).toLocaleString("fi-FI") : "—";
              lines.push("[" + (i + 1) + "] " + (b.buildId || "?").slice(0, 18) + " · " + date);
            });
            addMessage("system", lines.join("\n"), {});
          }
          showBanner("success", "VARASTO — Vault loaded (tyhjä jos ei buildeja)");
        } else {
          showBanner("error", dv.error || "Vault unavailable");
          addMessage("system", "❌ VAULT ERROR\n" + (dv.error || "server unavailable"), {});
        }
      }

      if (action === "publish" || action === "zip") {
        // ── RBX path: FORCED BLOB DOWNLOAD — no redirect, no HTML page ──
        if (ws.rbxZipName) {
          var dlUrl    = SERVER + "/rbx/download/" + ws.rbxZipName;
          var fileName = ws.rbxZipName;

          addMessage("system",
            "⬡ RBX EXPORT ZIP\n" +
            "Build:  " + (ws.rbxBuildId || "?") + "\n" +
            "Target: " + (ws.rbxTargetId || "?").toUpperCase() + "\n" +
            "File:   " + fileName + "\n" +
            "Downloading...", {});

          try {
            // SPEC-REQUIRED: fetch → blob → forced browser download
            // Never: Linking.openURL, window.location, navigate(), HTML page
            fetch(dlUrl)
              .then(function(res) {
                if (!res.ok) throw new Error("Server returned " + res.status);
                return res.blob();
              })
              .then(function(blob) {
                var objectUrl = window.URL.createObjectURL(blob);
                var link = document.createElement("a");
                link.href     = objectUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(objectUrl);
                showBanner("success", "✓ " + fileName + " downloaded");
                addMessage("system",
                  "✓ ZIP DOWNLOADED\n" +
                  "\nNext steps:\n" +
                  "1. Unzip: " + fileName + "\n" +
                  "2. cd into folder\n" +
                  "3. rojo serve\n" +
                  "4. Roblox Studio → Plugins → Rojo → Connect", {});
              })
              .catch(function(err) {
                var errMsg = err.message || "Download failed";
                // Check if server might not be running
                if (errMsg.includes('NetworkError') || errMsg.includes('Failed to fetch')) {
                  errMsg = "Server offline? Start server with: npm run server";
                }
                showBanner("error", errMsg);
                addMessage("system", "✗ DOWNLOAD FAILED\n" + errMsg + "\n\nCheck: is server running?", { ok: false });
              })
              .finally(function() { setActiveAction(null); });
          } catch (e) {
            setActiveAction(null);
            showBanner("error", "Download error: " + e.message);
          }
          return;
        }

        // ── No RBX build done yet ────────────────────────────────────────
        // Legacy /publish route REMOVED — only Roblox ZIP delivery allowed
        showBanner("error", "Run BUILD first");
        addMessage("system",
          "⬡ RBX BUILD REQUIRED\n\n" +
          "Type one of:\n" +
          "  build tycoon\n" +
          "  build obby\n" +
          "  build simulator\n" +
          "  build rpg\n" +
          "  build fps\n\n" +
          "Then EXPORT ZIP will download your Roblox project.", {});
      }

      if (action === "abort") {
        // Bump the sequence so any in-flight build's response is discarded
        // when it arrives. resetRbxBuildState clears the RBX surfaces; the
        // session-level fields (projectId/label/...) are wiped here too
        // because CLEAR is a broader "fresh slate" than start-of-build.
        buildSeqRef.current++;
        setWs({ projectId: null, label: null, savedAt: null, snapCount: 0, lastReleaseId: null, lastZipUrl: null, rbxBuildId: null, rbxTargetId: null, rbxZipName: null, rbxDurationMs: null, rbxZipSizeBytes: null, rbxPhaseCount: null, rbxGhostId: null, rbxArtifactHash: null });
        setPreviewSource(null);
        resetRbxBuildState();
        setInputText("");
        setBuildPhase("idle");
        setIsLoading(false);
        addMessage("system", "⛔ SESSION CLEARED — Artifaktit säilyvät vaultissa.", {});
        showBanner("success", "Session cleared");
      }
    } catch (err) {
      addMessage("system", "❌ NETWORK ERROR\n" + err.message + "\nIs the backend running? npm run server", {});
      showBanner("error", err.message || "Network error");
    } finally {
      setActiveAction(null);
    }
  }, [messages, ws, activeAction, addMessage, previewSource, resetRbxBuildState]);

  function StatusPill(props) {
    return (
      <View style={[styles.statusPill, props.hot && styles.statusPillHot]}>
        <Text style={styles.statusDot}>●</Text>
        <Text style={styles.statusPillText}>{props.label}</Text>
      </View>
    );
  }

  function NavButton(props) {
    var selected = activeView === props.id;
    return (
      <Pressable style={[styles.navBtn, selected && styles.navBtnActive]} onPress={function() { setActiveView(props.id); }}>
        <Text style={[styles.navBtnText, selected && styles.navBtnTextActive]}>{props.label}</Text>
      </Pressable>
    );
  }

  function ActionButton(props) {
    var isDisabled = props.disabled || !!activeAction;
    var isGlowing  = props.glow && !isDisabled;
    return (
      <Pressable
        style={[
          styles.actionButton,
          props.primary  && styles.actionButtonPrimary,
          props.cyan     && styles.actionButtonCyan,
          props.purple   && styles.actionButtonPurple,
          props.warn     && styles.actionButtonWarn,
          props.danger   && styles.actionButtonDanger,
          isGlowing      && props.cyan   && styles.actionButtonCyanGlow,
          isGlowing      && props.primary && styles.actionButtonPrimaryGlow,
          activeAction === props.action && styles.actionButtonBusy,
          isDisabled     && !activeAction && styles.actionButtonDimmed,
        ]}
        onPress={function() { if(!isDisabled) handleWorkspaceAction(props.action); }}
        disabled={isDisabled}
      >
        <Text style={[
          styles.actionButtonText,
          props.primary  && styles.actionButtonTextPrimary,
          props.cyan     && styles.actionButtonTextCyan,
          props.purple   && styles.actionButtonTextPurple,
          props.warn     && styles.actionButtonTextWarn,
          props.danger   && styles.actionButtonTextDanger,
          isDisabled && !activeAction && styles.actionButtonTextDimmed,
        ]}>
          {activeAction === props.action ? "..." : props.label}
        </Text>
      </Pressable>
    );
  }

  function MetricCard(props) {
    return (
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{props.label}</Text>
        <Text style={styles.metricValue}>{props.value}</Text>
        <Text style={styles.metricHint}>{props.hint}</Text>
      </View>
    );
  }

  function renderPreviewPanel() {
    // ── HARD ISOLATION: In RBX mode, legacy source is never used ──────
    var hasRbxPreview  = !!rbxPreviewTarget;
    var _inRbxMode     = !!ws.rbxTargetId || buildPhase === "success" || buildPhase === "building";
    // Only check legacy source if NOT in RBX mode
    var src            = _inRbxMode ? null : getLastSource();
    var hasReactSource = !_inRbxMode && !!src;
    var cleanSource    = hasReactSource ? sanitizeReactSource(src) : null;

    function PreviewContent(props) {
      var fs = props.fullscreen;
      return (
        <View style={fs ? styles.previewFrameFull : styles.previewFrame}>
          <View style={styles.previewTopBar}>
            <Text style={styles.previewDot}>⬡ ● ●</Text>
            <Text style={styles.previewUrl}>
              {hasRbxPreview
                ? "AF51-RBX · " + (ws.rbxTargetId||"").toUpperCase() + " · live preview"
                : "AF51-RBX · awaiting build"}
            </Text>
            <Pressable style={styles.fsBtn} onPress={function() { setIsFullscreen(!fs); }}>
              <Text style={styles.fsBtnText}>{fs ? "⊠" : "⛶"}</Text>
            </Pressable>
          </View>

          {(hasRbxPreview || buildPhase === "success") ? (
            // ── v58: Hierarchy + Viewport + Inspector + Artifact ──────────
            <View style={[styles.liveRenderWrap, {backgroundColor:"#06080D"}]}>
              <View style={{ flex: 1, flexDirection: "row" }}>
                <RbxHierarchyPanel
                  structures={normalizeStructures(structuresFromPreviewData(rbxPreviewData))}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  routeFile={ws.rbxZipName ? "Main.server.lua" : null}
                />
                <View style={{ flex: 1 }}>
                  <RbxPreviewCanvas
                    targetId={rbxPreviewTarget || ws.rbxTargetId || "lua"}
                    buildId={ws.rbxBuildId || ""}
                    previewData={rbxPreviewData}
                    qualityReport={rbxQualityReport}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    zipSizeBytes={ws.rbxZipSizeBytes || 0}
                    durationMs={ws.rbxDurationMs || 0}
                    phaseCount={ws.rbxPhaseCount || 13}
                  />
                  <View style={styles.artifactBar}>
                    <Text style={styles.artifactText} numberOfLines={1}>
                      {"⬡ " + (ws.rbxBuildId || "pending") +
                       (rbxQualityReport && typeof rbxQualityReport.qualityScore === "number"
                          ? "  ·  Q=" + Math.round(rbxQualityReport.qualityScore)
                          : "") +
                       "  ·  production-scenegraph  ·  Rojo ✓  ·  runtime: Roblox Studio"}
                    </Text>
                  </View>
                  {ws.rbxGhostId ? (
                    <View style={styles.ghostSealBar}>
                      <Text style={styles.ghostSealLabel}>GHOST SEAL</Text>
                      <Text style={styles.ghostSealId} numberOfLines={1}>{ws.rbxGhostId}</Text>
                      <Text style={styles.ghostSealDot}>·</Text>
                      <Text style={styles.ghostSealHashLabel}>artifactHash</Text>
                      <Text style={styles.ghostSealHash} numberOfLines={1}>{ws.rbxArtifactHash || "—"}</Text>
                      <Text style={styles.ghostSealDot}>·</Text>
                      <Text style={styles.ghostSealFiles}>5 receipts · audit 15φ</Text>
                    </View>
                  ) : null}
                </View>
                <RbxInspectorPanel
                  selected={(function() {
                    var list = normalizeStructures(structuresFromPreviewData(rbxPreviewData));
                    for (var i = 0; i < list.length; i++) { if (list[i].__id === selectedId) return list[i]; }
                    return null;
                  })()}
                />
                {(rbxDesignReport || rbxStudioReport || rbxDiagnostics) ? (
                  <RbxDesignReportPanel
                    report={rbxDesignReport}
                    studio={rbxStudioReport}
                    shots={rbxShots}
                    diagnostics={rbxDiagnostics}
                    style={{ marginTop: 12 }}
                  />
                ) : null}
              </View>
            </View>
          ) : (hasReactSource && !ws.rbxTargetId) ? (
            // HARD GUARD: LiveRenderView ONLY for non-RBX targets
            // ws.rbxTargetId presence means factory is in RBX mode — block legacy
            <View style={styles.liveRenderWrap}>
              <LiveRenderView code={cleanSource} title="Live Preview" />
            </View>
          ) : (
            <View style={styles.previewEmptyWrap}>
              {buildPhase === "building" ? (
                <>
                  <Text style={[styles.previewEmptyTitle, {color:"#A8FF2F"}]}>⬡ MANUFACTURING...</Text>
                  <Text style={styles.previewEmpty}>Running 11-phase RBX pipeline</Text>
                  <Text style={[styles.previewEmpty, {marginTop:8,fontSize:10,color:"#334455"}]}>
                    hierarchy → runtime → luau → remotes → sign → ZIP
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.previewEmptyTitle}>AF51 ROBLOX CODE RUNNER</Text>
                  <Text style={styles.previewEmpty}>
                    {"Type: build obby\nbuild tycoon\nbuild simulator\nbuild rpg\nbuild fps\n\nPreview explodes alive after BUILD."}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.previewPanel}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.panelKicker}>
              {hasRbxPreview ? "⬡ RBX PREVIEW" : "PREVIEW"}
            </Text>
            <Text style={styles.panelTitle}>
              {hasRbxPreview
                ? (ws.rbxTargetId||"").toUpperCase() + " · Generated World"
                : "Runtime View"}
            </Text>
          </View>
          <StatusPill
            label={hasRbxPreview ? "LIVE" : buildPhase === "building" ? "BUILDING" : "WAITING"}
            hot={hasRbxPreview || buildPhase === "building"}
          />
        </View>

        <PreviewContent fullscreen={false} />

        <Modal
          visible={isFullscreen}
          animationType="fade"
          transparent={false}
          onRequestClose={function() { setIsFullscreen(false); }}
          statusBarTranslucent={true}
        >
          <View style={styles.modalContainer}>
            <PreviewContent fullscreen={true} />
          </View>
        </Modal>
      </View>
    );
  }

  function renderBuilder() {
    return (
      <View style={styles.builderGrid}>
        <View style={styles.leftColumn}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>AF51 · ROBLOX FACTORY</Text>
            <Text style={styles.heroTitle}>AF51 Roblox Code Runner</Text>
            <Text style={styles.heroText}>One-click Roblox project ZIP manufacturing. k1 governed. Deterministic. Rojo-compatible. Zero-LLM build pipeline.</Text>
            <View style={styles.stepper}>
              <Text style={styles.step}>Sterility</Text><Text style={styles.stepSep}>→</Text>
              <Text style={styles.step}>Hierarchy</Text><Text style={styles.stepSep}>→</Text>
              <Text style={styles.step}>Runtime</Text><Text style={styles.stepSep}>→</Text>
              <Text style={styles.step}>Luau Gen</Text><Text style={styles.stepSep}>→</Text>
              <Text style={styles.step}>Remotes</Text><Text style={styles.stepSep}>→</Text>
              <Text style={styles.step}>Rojo</Text><Text style={styles.stepSep}>→</Text>
              <Text style={styles.step}>Sign</Text><Text style={styles.stepSep}>→</Text>
              <Text style={styles.stepRbx}>ZIP ⬡</Text>
            </View>
            <View style={styles.rbxTargetRow}>
              <Text style={styles.rbxTargetLabel}>RBX TARGETS:</Text>
              <Text style={styles.rbxTarget} onPress={function(){}}>🏃 OBBY</Text>
              <Text style={styles.rbxTarget} onPress={function(){}}>🏭 TYCOON</Text>
              <Text style={styles.rbxTargetSim} onPress={function(){}}>⚡ SIM</Text>
              <Text style={styles.rbxTargetRpg} onPress={function(){}}>⚔ RPG</Text>
              <Text style={styles.rbxTargetFps} onPress={function(){}}>🎯 FPS</Text>
            </View>
          </View>

          <View style={styles.chatPanel}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelKicker}>COMMAND LINE</Text>
                <Text style={styles.panelTitle}>Build Input</Text>
              </View>
              <StatusPill label={isLoading ? "BUILDING" : "READY"} hot={isLoading} />
            </View>

            <View style={styles.inputShell}>
              <View style={styles.buildPrefix}><Text style={styles.buildPrefixText}>BUILD</Text></View>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="describe what you want to build, or paste source instructions..."
                placeholderTextColor="#728474"
                returnKeyType="send"
                onSubmitEditing={handleSend}
                editable={!isLoading}
                multiline={true}
              />
              <Pressable style={[styles.sendButton, isLoading && styles.sendButtonDisabled]} onPress={handleSend} disabled={isLoading}>
                <Text style={styles.sendButtonText}>{isLoading ? "..." : "RUN"}</Text>
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              {/* SAVE — always visible, saves current build artifact */}
              <ActionButton
                action="save"
                label={buildPhase === "success" ? "✓ SAVE BUILD" : "SAVE"}
                primary={buildPhase === "success"}
                glow={buildPhase === "success"}
                disabled={false}
              />

              {/* ZIP — locked until build passes */}
              <View style={[styles.lockableBtn, buildPhase !== "success" && styles.lockableBtnLocked]}>
                <ActionButton
                  action="zip"
                  label={buildPhase === "success" ? "⬇ EXPORT ZIP" : "⬡ ZIP"}
                  cyan={buildPhase === "success"}
                  disabled={buildPhase !== "success"}
                  glow={buildPhase === "success"}
                />
                {buildPhase !== "success" && (
                  <Text style={styles.lockIcon}>🔒</Text>
                )}
              </View>

              {/* PUBLISH — locked until build passes */}
              <View style={[styles.lockableBtn, buildPhase !== "success" && styles.lockableBtnLocked]}>
                <ActionButton
                  action="publish"
                  label={buildPhase === "success" ? "🚀 PUBLISH" : "⬡ PUBLISH"}
                  primary={buildPhase === "success"}
                  disabled={buildPhase !== "success"}
                  glow={buildPhase === "success"}
                />
                {buildPhase !== "success" && (
                  <Text style={styles.lockIcon}>🔒</Text>
                )}
              </View>

              <ActionButton action="snapshot" label="SNAPSHOT" purple />
              <ActionButton action="vault" label="VAULT" />
              <ActionButton action="abort" label="CLEAR" danger />
            </View>

            {/* BUILD SUCCESS PANEL */}
            {buildPhase === "success" && ws.rbxTargetId && (
              <View style={styles.successPanel}>
                <View style={styles.successRow}>
                  <Text style={styles.successCheck}>✔</Text>
                  <Text style={styles.successText}>BUILD PASSED — {(ws.rbxTargetId||"").toUpperCase()}</Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successCheck}>✔</Text>
                  <Text style={styles.successText}>PREVIEW GENERATED</Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successCheck}>✔</Text>
                  <Text style={styles.successText}>PACKAGE SIGNED</Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successCheckCyan}>✔</Text>
                  <Text style={styles.successTextCyan}>ZIP READY → {ws.rbxZipName || "..."}</Text>
                </View>
                <View style={styles.successRow}>
                  <Text style={styles.successCheckPurple}>✔</Text>
                  <Text style={styles.successTextPurple}>PUBLISH READY — {ws.rbxDurationMs}ms</Text>
                </View>
              </View>
            )}

            {/* BUILDING indicator */}
            {buildPhase === "building" && (
              <View style={styles.buildingPanel}>
                <Text style={styles.buildingText}>⬡ FACTORY RUNNING... 11 PHASES</Text>
                <Text style={styles.buildingHint}>hierarchy → runtime → luau → remotes → sign → ZIP</Text>
              </View>
            )}

            {banner ? (
              <View style={[styles.banner, banner.type === "success" ? styles.bannerSuccess : banner.type === "error" ? styles.bannerError : styles.bannerInfo]}>
                <Text style={styles.bannerText}>{banner.type === "success" ? "✅ " : banner.type === "error" ? "❌ " : "ℹ "}{banner.msg}</Text>
              </View>
            ) : null}

            <ScrollView ref={scrollViewRef} style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
              {messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>AF51 ROBLOX CODE RUNNER</Text>
                  <Text style={styles.emptyText}>Type a target: "build obby", "build tycoon", "build fps" — or paste Luau code directly. The RBX pipeline handles everything.</Text>
                </View>
              ) : null}

              {messages.map(function(msg) {
                var isUser = msg.role === "user";
                var isSystem = msg.role === "system";
                return (
                  <View key={msg.id} style={[styles.messageRow, isUser && styles.messageRowUser]}>
                    <View style={[styles.messageBubble, isUser ? styles.userBubble : isSystem ? styles.systemBubble : styles.factoryBubble]}>
                      <Text style={styles.messageRole}>{isUser ? "COMMAND" : isSystem ? "SYSTEM" : "FACTORY"}</Text>
                      <Text style={[styles.messageText, isUser && styles.userText]}>{msg.content}</Text>
                      {msg.metadata && (msg.metadata.intent || msg.metadata.pipeline || msg.metadata.durationMs) ? (
                        <Text style={styles.metadataText}>{msg.metadata.pipeline || "Pipeline"} · {msg.metadata.intent || "—"} · {msg.metadata.durationMs || 0}ms</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={styles.rightColumn}>
          {renderPreviewPanel()}
          <View style={styles.statusPanel}>
            <View style={styles.panelHeaderRow}>
              <View>
                <Text style={styles.panelKicker}>RBX BUILD STATUS</Text>
                <Text style={styles.panelTitle}>Build Pipeline</Text>
              </View>
              <StatusPill label={orchestrator && orchestrator.webMode ? "WEB MODE · RBX API READY" : "FACTORY ONLINE"} />
            </View>
            <View style={styles.metricsGrid}>
              <MetricCard label="Runtime" value="ONLINE" hint="server:3000" />
              <MetricCard label="Pipeline" value={isLoading ? "ACTIVE" : "READY"} hint="validate → build" />
              <MetricCard label="Workspace" value={ws.savedAt ? (ws.rbxTargetId ? ("RBX " + ws.rbxTargetId.toUpperCase()) : (ws.projectId ? ws.projectId.slice(0,10) : "SAVED")) : "NONE"} hint={ws.savedAt ? "saved ✓" : "not saved"} />
              <MetricCard label="ZIP" value={ws.rbxZipName || (ws.lastReleaseId ? "READY" : "—")} hint={ws.rbxTargetId ? ("RBX " + ws.rbxTargetId.toUpperCase()) : (ws.lastReleaseId || "build first")} />
            </View>
            {ws.lastZipUrl && !ws.rbxTargetId ? (
              <Pressable style={styles.zipDownload} onPress={function() {
                // FORCED BLOB DOWNLOAD — never Linking.openURL
                var _fn = ws.rbxZipName || (ws.lastZipUrl ? ws.lastZipUrl.split(/[\\/]/).pop() : null);
                var _url = ws.rbxZipName ? (SERVER + "/rbx/download/" + ws.rbxZipName) : ws.lastZipUrl;
                if (!_url) return;
                fetch(_url).then(function(r){ return r.blob(); }).then(function(b){
                  var ou = window.URL.createObjectURL(b);
                  var a = document.createElement("a"); a.href=ou; a.download=_fn||"roblox-project.zip";
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  window.URL.revokeObjectURL(ou);
                }).catch(function(e){ console.error("[ZIP]",e.message); });
              }}>
                <Text style={styles.zipDownloadText}>DOWNLOAD LAST ZIP</Text>
                <Text style={styles.zipUrl} numberOfLines={1}>{ws.lastZipUrl}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  function renderAdmin() {
    return (
      <ScrollView style={styles.adminScroll} contentContainerStyle={styles.adminContent}>
        <View style={styles.adminHeaderCard}>
          <Text style={styles.heroEyebrow}>ADMIN COCKPIT</Text>
          <Text style={styles.heroTitle}>Machine Room</Text>
          <Text style={styles.heroText}>Clean operator view. The core runtime, validation, vault, publishing and governance remain exactly on the machinery side.</Text>
        </View>
        <View style={styles.adminGrid}>
          <MetricCard label="Energy Ring" value="GOVERNED" hint="runtime profile layer" />
          <MetricCard label="Vault" value="READY" hint="build storage" />
          <MetricCard label="Governance" value="ACTIVE" hint="policy / invariant lane" />
          <MetricCard label="Publish" value="AVAILABLE" hint="release packaging" />
          <MetricCard label="Provider" value="EXTERNAL" hint="no visible model lock-in" />
          <MetricCard label="Mode" value="PRODUCT" hint="public builder shell" />
        </View>
        <View style={styles.adminNote}>
          <Text style={styles.adminNoteTitle}>Operator rule</Text>
          <Text style={styles.adminNoteText}>No end-to-end pipeline changes here. This edition replaces the visible cockpit only: branding, navigation, input, preview, save, publish and ZIP handling.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ImageBackground source={AF51_BG} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.keyboardRoot} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
          <View style={styles.topNav}>
            <View style={styles.brandBlock}>
              <View style={styles.logoCircle}><Text style={styles.logoText}>AF<Text style={styles.logoTextGreen}>51</Text></Text></View>
              <View>
                <Text style={styles.brandTitle}>AF51 ROBLOX CODE RUNNER</Text>
                <Text style={styles.brandSub}>Roblox · k1 Governed · Zero-LLM Build</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScroll}>
              <NavButton id="builder" label="Builder" />
              <Pressable style={[styles.navBtn, buildPhase === "success" && styles.navBtnActive]} onPress={function() { if(buildPhase === "success") handleWorkspaceAction("zip"); else addMessage("system","⚠ Run BUILD first — type: build tycoon",{}); }}><Text style={[styles.navBtnText, buildPhase === "success" && styles.navBtnTextActive]}>ZIP</Text></Pressable>
            </ScrollView>
            <View style={styles.topStatus}>
              <StatusPill label="SYSTEM READY" />
            </View>
          </View>

          {renderBuilder()}

          <View style={styles.footerBar}>
            <Text style={styles.footerText}>FACTORY ONLINE</Text>
            <Text style={styles.footerText}>RBX PIPELINE READY</Text>
            <Text style={styles.footerText}>Workspace: {ws.projectId ? ws.projectId.slice(0, 14) : "none"}</Text>
            <Text style={styles.footerText}>k1 GOVERNED · ROJO READY</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

var styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#06080D" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(4,6,10,0.88)" },
  container: { flex: 1 },
  keyboardRoot: { flex: 1 },

  topNav: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(168,255,47,0.18)",
    backgroundColor: "rgba(6,10,16,0.82)",
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 12, minWidth: 260 },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#A8FF2F",
    backgroundColor: "rgba(0,0,0,0.80)",
    justifyContent: "center",
    alignItems: "center"
  },
  logoText: { color: "#F0F4FF", fontSize: 17, fontWeight: "900", letterSpacing: -1 },
  logoTextGreen: { color: "#A8FF2F" },
  brandTitle: { color: "#F0F4FF", fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  brandSub: { color: "#A8FF2F", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 3, textTransform: "uppercase" },
  navScroll: { gap: 8, alignItems: "center" },
  navBtn: { borderWidth: 1, borderColor: "rgba(168,255,47,0.22)", paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "rgba(8,12,20,0.75)", borderRadius: 999 },
  navBtnActive: { borderColor: "#A8FF2F", backgroundColor: "rgba(168,255,47,0.14)" },
  navBtnText: { color: "#7A8BA8", fontSize: 11, fontWeight: "800", letterSpacing: 1.3, textTransform: "uppercase" },
  navBtnTextActive: { color: "#F0F4FF" },
  topStatus: { marginLeft: "auto" },

  builderGrid: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column", padding: 14, gap: 14 },
  leftColumn: { flex: 1.05, gap: 14, minWidth: 0 },
  rightColumn: { flex: 0.95, gap: 14, minWidth: 0 },

  heroCard: { borderWidth: 1, borderColor: "rgba(168,255,47,0.20)", backgroundColor: "rgba(8,12,20,0.80)", borderRadius: 14, padding: 18 },
  heroEyebrow: { color: "#A8FF2F", fontSize: 10, fontWeight: "900", letterSpacing: 3, marginBottom: 8 },
  heroTitle: { color: "#F0F4FF", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  heroText: { color: "#7A8BA8", fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 760 },
  stepper: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 },
  step: { color: "#A8FF2F", fontSize: 9, fontWeight: "900", letterSpacing: 1, borderWidth: 1, borderColor: "rgba(168,255,47,0.25)", paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(168,255,47,0.08)", borderRadius: 999 },
  stepSep: { color: "#445566", fontSize: 12, fontWeight: "900" },

  chatPanel: { flex: 1, borderWidth: 1, borderColor: "rgba(26,37,53,1)", backgroundColor: "rgba(8,12,20,0.90)", borderRadius: 14, padding: 14, minHeight: 420 },
  panelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 },
  panelKicker: { color: "#A8FF2F", fontSize: 9, fontWeight: "900", letterSpacing: 2.5, marginBottom: 3 },
  panelTitle: { color: "#F0F4FF", fontSize: 17, fontWeight: "900", letterSpacing: 0.3 },

  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(168,255,47,0.25)", backgroundColor: "rgba(168,255,47,0.08)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusPillHot: { borderColor: "#FFC83D", backgroundColor: "rgba(255,200,61,0.12)" },
  statusDot: { color: "#A8FF2F", fontSize: 8 },
  statusPillText: { color: "#F0F4FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },

  inputShell: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(168,255,47,0.30)", backgroundColor: "rgba(6,8,13,0.85)", borderRadius: 12, overflow: "hidden" },
  buildPrefix: { alignSelf: "stretch", justifyContent: "center", backgroundColor: "#A8FF2F", paddingHorizontal: 14 },
  buildPrefixText: { color: "#06080D", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  textInput: { flex: 1, color: "#F0F4FF", paddingHorizontal: 14, paddingVertical: 14, minHeight: 48, fontSize: 14 },
  sendButton: { alignSelf: "stretch", justifyContent: "center", backgroundColor: "rgba(37,208,255,0.12)", borderLeftWidth: 1, borderLeftColor: "rgba(37,208,255,0.25)", paddingHorizontal: 18 },
  sendButtonDisabled: { opacity: 0.55 },
  sendButtonText: { color: "#25D0FF", fontSize: 11, fontWeight: "900", letterSpacing: 2 },

  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionButton: { borderWidth: 1, borderColor: "rgba(26,37,53,1)", backgroundColor: "rgba(8,12,20,0.90)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionButtonPrimary: { borderColor: "#A8FF2F", backgroundColor: "rgba(168,255,47,0.14)", shadowColor: "#A8FF2F", shadowOffset: {width:0,height:0}, shadowOpacity: 0.25, shadowRadius: 6 },
  actionButtonWarn: { borderColor: "rgba(255,200,61,0.44)", backgroundColor: "rgba(255,200,61,0.08)" },
  actionButtonBusy: { opacity: 0.6 },
  actionButtonText: { color: "#7A8BA8", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  actionButtonTextPrimary: { color: "#A8FF2F" },
  actionButtonTextWarn: { color: "#FFC83D" },

  banner: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  bannerSuccess: { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.34)" },
  bannerError: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.34)" },
  bannerInfo: { backgroundColor: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.34)" },
  bannerText: { color: "#e8f5e8", fontSize: 12, fontWeight: "700" },

  messagesContainer: { flex: 1, marginTop: 10 },
  messagesContent: { paddingBottom: 20, gap: 10 },
  emptyState: { borderWidth: 1, borderColor: "rgba(26,37,53,1)", backgroundColor: "rgba(255,255,255,0.02)", padding: 18, borderRadius: 10 },
  emptyTitle: { color: "#F0F4FF", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "#7A8BA8", fontSize: 13, lineHeight: 20, marginTop: 6 },
  messageRow: { alignItems: "flex-start" },
  messageRowUser: { alignItems: "flex-end" },
  messageBubble: { maxWidth: "92%", padding: 12, borderRadius: 14, borderWidth: 1 },
  userBubble: { backgroundColor: "rgba(168,255,47,0.10)", borderColor: "rgba(168,255,47,0.30)" },
  factoryBubble: { backgroundColor: "rgba(8,12,20,0.95)", borderColor: "rgba(26,37,53,1)" },
  systemBubble: { backgroundColor: "rgba(10,15,24,0.95)", borderColor: "rgba(37,208,255,0.20)" },
  messageRole: { color: "#A8FF2F", fontSize: 8, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },
  messageText: { color: "#C8D8F0", fontSize: 13, lineHeight: 20 },
  userText: { color: "#F0F4FF", fontWeight: "700" },
  metadataText: { color: "#718371", fontSize: 10, marginTop: 8 },

  previewPanel: { flex: 1, borderWidth: 1, borderColor: "rgba(26,37,53,1)", backgroundColor: "rgba(8,12,20,0.90)", borderRadius: 14, padding: 14, minHeight: 420 },
  openPreviewBtn: { borderWidth: 1, borderColor: "#25D0FF", backgroundColor: "rgba(37,208,255,0.10)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  openPreviewText: { color: "#25D0FF", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  previewFrame: { flex: 1, minHeight: 340, borderWidth: 1, borderColor: "rgba(26,37,53,1)", borderRadius: 10, overflow: "hidden", backgroundColor: "#06080D" },
  previewTopBar: { height: 34, borderBottomWidth: 1, borderBottomColor: "rgba(26,37,53,1)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 12, backgroundColor: "rgba(255,255,255,0.025)" },
  previewDot: { color: "#A8FF2F", fontSize: 9, letterSpacing: 2 },
  previewUrl: { color: "#728474", fontSize: 10, fontWeight: "700" },
  previewBody: { flex: 1 },
  previewBodyInner: { padding: 14 },
  liveRenderWrap: { flex: 1, minHeight: 300, backgroundColor: "#06080D" },
  previewFrameFull: { flex: 1, borderWidth: 0, borderRadius: 0, overflow: "hidden", backgroundColor: "#020604" },
  modalContainer: { flex: 1, backgroundColor: "#06080D" },
  fsBtn: { marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(168,255,47,0.10)", borderWidth: 1, borderColor: "rgba(168,255,47,0.28)" },
  fsBtnText: { color: "#A8FF2F", fontSize: 12, fontWeight: "600" },
  previewEmptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  previewEmptyTitle: { color: "#f4fff4", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  previewCode: { color: "#d9f7d9", fontSize: 11, lineHeight: 17, fontFamily: Platform.OS === "web" ? "Consolas" : "monospace" },
  previewEmpty: { color: "#728474", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 80 },

  statusPanel: { borderWidth: 1, borderColor: "rgba(26,37,53,1)", backgroundColor: "rgba(8,12,20,0.90)", borderRadius: 14, padding: 14 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { flexGrow: 1, minWidth: 130, borderWidth: 1, borderColor: "rgba(26,37,53,1)", backgroundColor: "rgba(255,255,255,0.025)", borderRadius: 10, padding: 12 },
  metricLabel: { color: "#A8FF2F", fontSize: 9, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" },
  metricValue: { color: "#F0F4FF", fontSize: 17, fontWeight: "900", marginTop: 5 },
  metricHint: { color: "#445566", fontSize: 10, marginTop: 4 },
  zipDownload: { marginTop: 12, borderWidth: 1, borderColor: "#25D0FF", backgroundColor: "rgba(37,208,255,0.10)", borderRadius: 10, padding: 12 },
  zipDownloadText: { color: "#25D0FF", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  zipUrl: { color: "#A8FF2F", fontSize: 9, marginTop: 4 },

  adminScroll: { flex: 1 },
  adminContent: { padding: 14, gap: 14 },
  adminHeaderCard: { borderWidth: 1, borderColor: "rgba(168,255,47,0.20)", backgroundColor: "rgba(8,12,20,0.80)", borderRadius: 14, padding: 18 },
  adminGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  adminNote: { borderWidth: 1, borderColor: "rgba(26,37,53,1)", backgroundColor: "rgba(8,12,20,0.90)", borderRadius: 14, padding: 16 },
  adminNoteTitle: { color: "#F0F4FF", fontSize: 16, fontWeight: "900" },
  adminNoteText: { color: "#7A8BA8", fontSize: 13, lineHeight: 20, marginTop: 8 },

  footerBar: { minHeight: 34, borderTopWidth: 1, borderTopColor: "rgba(26,37,53,1)", backgroundColor: "rgba(6,8,13,0.90)", flexDirection: "row", flexWrap: "wrap", alignItems: "center", paddingHorizontal: 14, gap: 14 },
  footerText: { color: "#445566", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  // ── RBX Target row ─────────────────────────────────────────────────────
  rbxTargetRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" },
  rbxTargetLabel: { color: "#445566", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  rbxTarget:    { color: "#A8FF2F", fontSize: 10, fontWeight: "900", borderWidth: 1, borderColor: "rgba(168,255,47,0.30)", backgroundColor: "rgba(168,255,47,0.08)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  rbxTargetSim: { color: "#8C52FF", fontSize: 10, fontWeight: "900", borderWidth: 1, borderColor: "rgba(140,82,255,0.30)", backgroundColor: "rgba(140,82,255,0.08)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  rbxTargetRpg: { color: "#FF2FD1", fontSize: 10, fontWeight: "900", borderWidth: 1, borderColor: "rgba(255,47,209,0.30)", backgroundColor: "rgba(255,47,209,0.08)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  rbxTargetFps: { color: "#FFC83D", fontSize: 10, fontWeight: "900", borderWidth: 1, borderColor: "rgba(255,200,61,0.30)", backgroundColor: "rgba(255,200,61,0.08)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  stepRbx: { color: "#25D0FF", fontSize: 9, fontWeight: "900", borderWidth: 1, borderColor: "rgba(37,208,255,0.35)", backgroundColor: "rgba(37,208,255,0.10)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },

  // ── Button color variants ───────────────────────────────────────────────
  actionButtonCyan:        { borderColor: "#25D0FF", backgroundColor: "rgba(37,208,255,0.10)" },
  actionButtonPurple:      { borderColor: "#8C52FF", backgroundColor: "rgba(140,82,255,0.10)" },
  actionButtonDanger:      { borderColor: "rgba(255,77,109,0.50)", backgroundColor: "rgba(255,77,109,0.08)" },
  actionButtonTextCyan:    { color: "#25D0FF" },
  actionButtonTextPurple:  { color: "#8C52FF" },
  actionButtonTextDanger:  { color: "#FF4D6D" },
  actionButtonDimmed:      { opacity: 0.25, borderColor: "rgba(26,37,53,0.5)" },
  actionButtonTextDimmed:  { color: "#2A3A4A" },
  actionButtonCyanGlow:    { borderColor: "#25D0FF", backgroundColor: "rgba(37,208,255,0.15)", shadowColor: "#25D0FF", shadowOffset: {width:0,height:0}, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  actionButtonPrimaryGlow: { borderColor: "#A8FF2F", backgroundColor: "rgba(168,255,47,0.18)", shadowColor: "#A8FF2F", shadowOffset: {width:0,height:0}, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },

  // ── Lockable button wrapper ──────────────────────────────────────────────
  lockableBtn:       { flexDirection: "row", alignItems: "center", gap: 4 },
  lockableBtnLocked: { opacity: 0.5 },
  lockIcon:          { fontSize: 10, color: "#2A3A4A" },

  // ── Build success panel ──────────────────────────────────────────────────
  successPanel: {
    marginTop: 12, padding: 12,
    backgroundColor: "rgba(168,255,47,0.04)",
    borderWidth: 1, borderColor: "rgba(168,255,47,0.20)",
    borderRadius: 10, gap: 5,
  },
  successRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  successCheck:       { color: "#A8FF2F", fontSize: 11, fontWeight: "900", width: 14 },
  successText:        { color: "#A8FF2F", fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  successCheckCyan:   { color: "#25D0FF", fontSize: 11, fontWeight: "900", width: 14 },
  successTextCyan:    { color: "#25D0FF", fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  successCheckPurple: { color: "#8C52FF", fontSize: 11, fontWeight: "900", width: 14 },
  successTextPurple:  { color: "#8C52FF", fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },

  // ── Building panel ───────────────────────────────────────────────────────
  buildingPanel: {
    marginTop: 10, padding: 10,
    backgroundColor: "rgba(168,255,47,0.03)",
    borderWidth: 1, borderColor: "rgba(168,255,47,0.15)",
    borderRadius: 8,
  },
  buildingText: { color: "#A8FF2F", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  buildingHint: { color: "#445566", fontSize: 9, marginTop: 4, letterSpacing: 0.5 },

  // ── Artifact + Ghost Seal bars under preview ─────────────────────────────
  artifactBar: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "rgba(140,82,255,0.06)",
    borderTopWidth: 1, borderTopColor: "rgba(140,82,255,0.22)",
    flexDirection: "row", alignItems: "center",
  },
  artifactText: { color: "#8C52FF", fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  ghostSealBar: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "rgba(37,208,255,0.05)",
    borderTopWidth: 1, borderTopColor: "rgba(37,208,255,0.20)",
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  ghostSealLabel: { color: "#25D0FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.0 },
  ghostSealId:    { color: "#A8FF2F", fontSize: 9, fontWeight: "700", letterSpacing: 0.5, maxWidth: 220 },
  ghostSealHashLabel: { color: "#556677", fontSize: 8, fontWeight: "600", letterSpacing: 0.4 },
  ghostSealHash:  { color: "#FFFFFF", fontSize: 9, fontWeight: "700", letterSpacing: 0.6, fontFamily: "monospace" },
  ghostSealFiles: { color: "#556677", fontSize: 8, fontWeight: "600", letterSpacing: 0.5 },
  ghostSealDot:   { color: "#334455", fontSize: 9, fontWeight: "900" },
});

export { MasterRoomUI };
export default MasterRoomUI;