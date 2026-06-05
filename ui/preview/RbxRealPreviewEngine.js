// ui/preview/RbxRealPreviewEngine.js
// AF51-RBX — Real 3D Preview Engine (Three.js).
//
// A real WebGL 3D scene rendered inside a sandboxed iframe (Three.js loaded
// from CDN in that clean browser context — no npm dependency, no expo-gl).
// Replaces the 2D canvas as the PREMIUM preview; the 2D canvas remains the
// fallback (non-web / engine-unavailable). This engine only VISUALIZES the
// parsed scene graph — it never generates, alters, or executes the product.
//
//   sceneGraph structures → 3D world (meshes, lights, materials, camera)
//
// Supports: PerspectiveCamera; orbit/fly/hero/character camera modes; ambient +
// directional + point lights; material mapping (Neon/Metal/Glass/SmoothPlastic);
// shape mapping (Block/Sphere/Cylinder/Wedge); humanoid role mapping
// (Head/Torso/Arm/Leg); soft shadows; selection highlight; fit-to-bounds;
// a part-count guardrail.

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { normalizeStructures, structuresFromPreviewData } from "./rbxPreviewUtils.js";

var THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js";
var MAX_PARTS = 1500; // performance guardrail — beyond this we cap rendered meshes

function buildEngineDoc(structures, meta) {
  // Only 3D structures (UI is overlaid separately by the host component).
  // INCLUSIVE filter: render everything except explicit UI classes.
  var blocks = structures.filter(function (s) {
    // Exclude UI elements by role
    if (s.role === "ui-element") return false;
    // Exclude UI by luaClass (ScreenGui, Frame, TextLabel, etc.)
    if (s.luaClass && /^(ScreenGui|Frame|TextLabel|TextButton|TextBox|ImageLabel|ImageButton|ScrollingFrame|SurfaceGui|BillboardGui|UIListLayout|UIGridLayout|UICorner)$/.test(s.luaClass)) return false;
    // Exclude UI by type (fallback for legacy structures)
    if (s.type === "ui") return false;
    // Include everything else (platforms, buildings, lights, effects, humanoids)
    return true;
  }).slice(0, MAX_PARTS);

  var data = JSON.stringify(blocks);
  var accent = (meta && meta.accent) || "#8EFF66";
  var selectedId = (meta && meta.selectedId) || "";

  // Debug: log filter stats
  if (typeof console !== "undefined" && structures.length > 0) {
    console.log("[RbxPreviewEngine] Structures:", structures.length, "→ Blocks rendered:", blocks.length);
  }

  // The iframe document: loads Three.js as an ES module from CDN and builds
  // the scene from `BLOCKS`. All logic is self-contained; the host only passes
  // data in via this generated HTML (same model as the 2D canvas iframe).
  return [
'<!doctype html><html><head><meta charset="utf-8"><style>',
'html,body{margin:0;height:100%;background:#0a0e16;overflow:hidden;font-family:ui-monospace,Menlo,monospace;}',
'#hud{position:absolute;top:10px;left:12px;color:' + accent + ';font-size:11px;font-weight:700;letter-spacing:1px;text-shadow:0 0 8px ' + accent + 'aa;pointer-events:none;z-index:5;}',
'#cam{position:absolute;top:10px;right:12px;display:flex;gap:4px;z-index:5;}',
'#cam button{background:rgba(12,18,28,0.85);color:#9fb2c8;border:1px solid #2a3a4d;border-radius:4px;font-size:10px;padding:4px 8px;cursor:pointer;font-family:inherit;}',
'#cam button:hover,#cam button.on{border-color:' + accent + ';color:' + accent + ';}',
'#err{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:#7a90a8;font-size:12px;text-align:center;padding:20px;}',
'canvas{display:block;}',
'</style></head><body>',
'<div id="hud">⬡ ' + ((meta && meta.label) || "RBX 3D PREVIEW") + ' · WebGL</div>',
'<div id="cam"><button data-m="orbit" class="on">ORBIT</button><button data-m="fly">FLY</button><button data-m="hero">HERO</button><button data-m="character">CHAR</button><button data-m="stop">■</button></div>',
'<div id="err">3D engine unavailable — falling back.</div>',
'<script type="module">',
'var BLOCKS=' + data + ';',
'var SELECTED=' + JSON.stringify(selectedId) + ';',
'try{',
'var THREE=await import(' + JSON.stringify(THREE_CDN) + ');',

// ── Renderer + scene ──────────────────────────────────────────────
'var renderer=new THREE.WebGLRenderer({antialias:true});',
'renderer.setSize(window.innerWidth,window.innerHeight);',
'renderer.setPixelRatio(Math.min(devicePixelRatio,2));',
'renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;',
'document.body.appendChild(renderer.domElement);',
'var scene=new THREE.Scene();scene.background=new THREE.Color("#0a0e16");',
'scene.fog=new THREE.Fog("#0a0e16",80,320);',

// ── Camera ────────────────────────────────────────────────────────
'var camera=new THREE.PerspectiveCamera(55,window.innerWidth/window.innerHeight,0.1,2000);',

// ── Lights: ambient + directional (shadow) + accent point ─────────
'scene.add(new THREE.AmbientLight(0xffffff,0.55));',
'var sun=new THREE.DirectionalLight(0xffffff,1.0);sun.position.set(40,80,30);sun.castShadow=true;',
'sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.near=1;sun.shadow.camera.far=400;',
'sun.shadow.camera.left=-120;sun.shadow.camera.right=120;sun.shadow.camera.top=120;sun.shadow.camera.bottom=-120;',
'scene.add(sun);',
'var rim=new THREE.PointLight(0x66aaff,0.4,300);rim.position.set(-50,40,-40);scene.add(rim);',

// ── Material mapping ──────────────────────────────────────────────
'function mat(b){var col=new THREE.Color(b.color||"#8899aa");var m=String(b.material||"SmoothPlastic");',
'if(m==="Neon")return new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.9,roughness:0.4});',
'if(m==="Metal"||m==="DiamondPlate")return new THREE.MeshStandardMaterial({color:col,metalness:0.85,roughness:0.3});',
'if(m==="Glass"||m==="ForceField")return new THREE.MeshStandardMaterial({color:col,transparent:true,opacity:0.4,roughness:0.1,metalness:0.1});',
'if(m==="Wood")return new THREE.MeshStandardMaterial({color:col,roughness:0.85});',
'if(m==="Grass")return new THREE.MeshStandardMaterial({color:col,roughness:0.95});',
'return new THREE.MeshStandardMaterial({color:col,roughness:0.65,metalness:0.05});}',

// ── Shape + humanoid-role geometry mapping ────────────────────────
'function geom(b){var w=Math.max(0.1,+b.w||2),h=Math.max(0.1,+b.h||2),d=Math.max(0.1,+b.d||2);',
'var kind=b.kind||"";var shape=b.shape||"Block";',
// humanoid roles refine geometry beyond raw shape
'if(kind==="head")return new THREE.SphereGeometry(Math.max(w,h)/2,24,18);',
'if(kind==="limb"){var r=Math.max(0.1,Math.min(w,d)/2);var ch=Math.max(0.1,h-2*r);return new THREE.CapsuleGeometry(r,ch,6,12);}',
'if(kind==="torso")return new THREE.BoxGeometry(w,h,d);',
'if(shape==="Ball"||shape==="Sphere")return new THREE.SphereGeometry(Math.max(w,h,d)/2,24,18);',
'if(shape==="Cylinder")return new THREE.CylinderGeometry(Math.min(w,d)/2,Math.min(w,d)/2,h,20);',
'if(shape==="Wedge"){var g=new THREE.BufferGeometry();var hw=w/2,hh=h/2,hd=d/2;',
'var v=new Float32Array([-hw,-hh,hd, hw,-hh,hd, hw,-hh,-hd, -hw,-hh,-hd, -hw,hh,-hd, hw,hh,-hd]);',
'g.setAttribute("position",new THREE.BufferAttribute(v,3));',
'g.setIndex([0,1,2, 0,2,3, 3,2,5, 3,5,4, 0,3,4, 1,2,5, 0,4,5,0,5,1]);g.computeVertexNormals();return g;}',
'return new THREE.BoxGeometry(w,h,d);}',

// ── Build meshes + track bounds ───────────────────────────────────
'var group=new THREE.Group();var box=new THREE.Box3();var meshById={};',
'BLOCKS.forEach(function(b){var mesh=new THREE.Mesh(geom(b),mat(b));',
'mesh.position.set(+b.x||0,+b.y||0,+b.z||0);mesh.castShadow=true;mesh.receiveShadow=true;',
'mesh.userData.id=b.__id||b.id;group.add(mesh);if(b.__id)meshById[b.__id]=mesh;',
'box.expandByObject(mesh);});',
'scene.add(group);',

// ── Ground plane under the scene ──────────────────────────────────
'var gsize=200;var ground=new THREE.Mesh(new THREE.PlaneGeometry(gsize,gsize),new THREE.MeshStandardMaterial({color:"#10161f",roughness:1}));',
'ground.rotation.x=-Math.PI/2;ground.position.y=(box.min.y||0)-0.05;ground.receiveShadow=true;scene.add(ground);',
'var grid=new THREE.GridHelper(gsize,40,0x223044,0x162030);grid.position.y=(box.min.y||0);scene.add(grid);',

// ── Selection highlight ───────────────────────────────────────────
'var hl=null;function highlight(id){if(hl){hl.material.emissive&&hl.material.emissive.setHex(hl.userData.e||0);}',
'var m=meshById[id];if(m){m.userData.e=m.material.emissive?m.material.emissive.getHex():0;if(m.material.emissive)m.material.emissive.setHex(0x00ff8c);hl=m;}}',
'if(SELECTED)highlight(SELECTED);',

// ── Camera fit to bounds ──────────────────────────────────────────
'var center=box.getCenter(new THREE.Vector3());var sphere=box.getBoundingSphere(new THREE.Sphere());',
'var R=Math.max(sphere.radius,6);var dist=R*2.6;',
'function look(){camera.lookAt(center);}',

// ── Camera modes (orbit/fly/hero/character) ───────────────────────
'var mode="orbit";var t=0;var manual=false;var yaw=0.7,pitch=0.5,zoom=dist;',
'function place(){var cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);',
'camera.position.set(center.x+zoom*cp*sy,center.y+zoom*sp+R*0.3,center.z+zoom*cp*cy);look();}',
'function setMode(m){mode=m;t=0;manual=false;document.querySelectorAll("#cam button").forEach(function(b){b.classList.remove("on");});',
'var btn=document.querySelector("[data-m="+JSON.stringify(m)+"]");if(btn)btn.classList.add("on");}',
'document.querySelectorAll("#cam button").forEach(function(btn){btn.addEventListener("click",function(){var m=btn.getAttribute("data-m");if(m==="stop"){manual=true;document.querySelectorAll("#cam button").forEach(function(b){b.classList.remove("on");});return;}setMode(m);});});',

// orbit drag + wheel zoom (manual control overrides the active shot)
'var drag=false,lx=0,ly=0;renderer.domElement.addEventListener("mousedown",function(e){drag=true;manual=true;lx=e.clientX;ly=e.clientY;});',
'window.addEventListener("mouseup",function(){drag=false;});',
'window.addEventListener("mousemove",function(e){if(!drag)return;yaw+=(e.clientX-lx)*0.01;pitch=Math.max(0.05,Math.min(1.4,pitch+(e.clientY-ly)*0.008));lx=e.clientX;ly=e.clientY;place();});',
'renderer.domElement.addEventListener("wheel",function(e){e.preventDefault();zoom=Math.max(R*1.1,Math.min(R*8,zoom*(e.deltaY<0?0.9:1.12)));place();},{passive:false});',

// ── Animation loop ────────────────────────────────────────────────
'function frame(){t+=0.016;if(!manual){',
'if(mode==="orbit"){yaw+=0.004;pitch=0.5+Math.sin(t*0.3)*0.1;zoom=dist;place();}',
'else if(mode==="fly"){yaw+=0.002;zoom=dist*(1.3+Math.sin(t*0.4)*0.4);pitch=0.35+Math.sin(t*0.25)*0.08;place();}',
'else if(mode==="hero"){yaw+=0.008;pitch=0.45;zoom=dist*0.8;place();}',
'else if(mode==="character"){yaw+=0.006;pitch=0.55;zoom=Math.max(R*1.4,dist*0.6);place();}}',
'renderer.render(scene,camera);requestAnimationFrame(frame);}',
'place();setMode("orbit");frame();',

// resize
'window.addEventListener("resize",function(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});',

'}catch(e){document.getElementById("err").style.display="flex";document.getElementById("err").textContent="3D engine error: "+(e&&e.message||e);}',
'</script></body></html>',
  ].join("");
}

function RbxRealPreviewEngine(props) {
  var preview = props.previewData;
  var structures = useMemo(function () {
    return preview ? normalizeStructures(structuresFromPreviewData(preview)) : [];
  }, [preview]);

  var meta = {
    label: props.label || "RBX 3D PREVIEW",
    accent: props.accent || "#8EFF66",
    selectedId: props.selectedId || "",
  };

  var doc = useMemo(function () {
    return buildEngineDoc(structures, meta);
  }, [structures, meta.selectedId, meta.label, meta.accent]);

  // Non-web (native mobile): no iframe/WebGL here — host should fall back to
  // the 2D canvas. We render a clear note rather than a broken view.
  if (Platform.OS !== "web") {
    return (
      <View style={styles.fallback}>
        <Text style={styles.ft}>⬡ {meta.label}</Text>
        <Text style={styles.fsub}>{structures.length} objects · 3D engine requires web</Text>
      </View>
    );
  }

  if (!preview || structures.length === 0) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fsub}>Run a build to see the live 3D preview.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <iframe
        key={(props.buildId || "") + ":" + structures.length + ":" + meta.selectedId}
        srcDoc={doc}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        sandbox="allow-scripts"
        title={"RBX 3D Preview: " + meta.label}
      />
    </View>
  );
}

var styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0a0e16", borderRadius: 8, overflow: "hidden", minHeight: 280 },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0e16", minHeight: 280, borderRadius: 8 },
  ft: { color: "#8EFF66", fontSize: 13, fontWeight: "700" },
  fsub: { color: "#56697d", fontSize: 12, marginTop: 4 },
});

export { RbxRealPreviewEngine };
export default RbxRealPreviewEngine;
