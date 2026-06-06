// ui/preview/RbxPreviewCanvas.js
// AF51-RBX — World Viewport (v57 core).
// Static structure viewport of the parsed object graph. NO hardcoded scenes.
// NOT a Roblox runtime — TweenService/Touched/PlayerAdded are NOT simulated;
// shown as metadata. Runtime truth = Roblox Studio.
//
// Pure Canvas 2D (no Three.js). Features: perspective projection, orbit camera
// presets, zoom+fit, shape rendering (cube/sphere/cylinder), materials
// (Neon/Metal/SmoothPlastic), emissive glow, fake lighting/shadows, subtle grid,
// gradient sky, UI overlay dock.

import React, { useMemo, useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { normalizeStructures, structuresFromPreviewData, terrainFromPreviewData } from "./rbxPreviewUtils.js";
import { RbxPreviewDirector } from "../../s4/oliot/rbx-directors/RbxPreviewDirector.js";
import { quickAnalyze } from "../../k1/SkillsRingBootstrap.mjs";

var UI_CLASSES = ["ScreenGui","Frame","TextLabel","TextButton","TextBox","ImageLabel","ImageButton","ScrollingFrame","SurfaceGui","BillboardGui","UIListLayout","UIGridLayout","UICorner"];
function isUiStructure(s) { return s.type === "ui" || UI_CLASSES.indexOf(s.luaClass) !== -1; }

// KORJAUS 4: Accurate UI rendering descriptions based on class
function getUIRenderingNote(uiItems) {
  var hasSurfaceGui = uiItems.some(function(u) { return u.luaClass === "SurfaceGui"; });
  var hasBillboardGui = uiItems.some(function(u) { return u.luaClass === "BillboardGui"; });
  var hasScreenGui = uiItems.some(function(u) { return u.luaClass === "ScreenGui"; });

  if (hasSurfaceGui && !hasBillboardGui && !hasScreenGui) {
    return "renders on parent surface";
  }
  if (hasBillboardGui && !hasSurfaceGui && !hasScreenGui) {
    return "renders above parent object";
  }
  if (hasScreenGui && !hasSurfaceGui && !hasBillboardGui) {
    return "renders in PlayerGui at runtime";
  }
  // Mixed types - show generic message
  return "UI elements (see hierarchy for details)";
}

// v66: Hero-aware bounds calculation
// Director identifies hero objects (vehicles, characters, buildings)
// Camera should focus on those, not on giant baseplates/terrain
function getBounds(structures, enriched) {
  var v = structures.filter(function(s){ return !isUiStructure(s); });
  if (v.length === 0) return { minX:-10,maxX:10,minY:0,maxY:20,minZ:-10,maxZ:10 };

  // If Director found hero objects, focus camera on those
  var heroStructures = v;
  if (enriched && enriched.semantic) {
    var heroIds = [];

    // Collect hero object IDs from Director's analysis
    if (enriched.semantic.vehicles && enriched.semantic.vehicles.length > 0) {
      enriched.semantic.vehicles.forEach(function(vh) {
        if (vh.id) heroIds.push(vh.id);
      });
    }
    if (enriched.semantic.buildings && enriched.semantic.buildings.length > 0) {
      enriched.semantic.buildings.forEach(function(b) {
        if (b.id) heroIds.push(b.id);
      });
    }
    if (enriched.characters && enriched.characters.rigs && enriched.characters.rigs.length > 0) {
      enriched.characters.rigs.forEach(function(rig) {
        if (rig.name) {
          // Find structures matching character name
          v.forEach(function(s) {
            if (s.label && s.label.toLowerCase().indexOf(rig.name.toLowerCase()) >= 0) {
              heroIds.push(s.id);
            }
          });
        }
      });
    }

    // If we found hero objects, use only those for bounds
    if (heroIds.length > 0) {
      heroStructures = v.filter(function(s) {
        return heroIds.indexOf(s.id) >= 0;
      });
      console.log('[Camera] Focusing on', heroStructures.length, 'hero objects (ignoring baseplate/terrain)');
    }
  }

  // Calculate bounds from hero structures (or all if no heroes)
  var b = { minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity };
  heroStructures.forEach(function(s){
    var x=+s.x||0,y=+s.y||0,z=+s.z||0,sx=+s.w||4,sy=+s.h||1,sz=+s.d||4;
    b.minX=Math.min(b.minX,x-sx/2); b.maxX=Math.max(b.maxX,x+sx/2);
    b.minY=Math.min(b.minY,y-sy/2); b.maxY=Math.max(b.maxY,y+sy/2);
    b.minZ=Math.min(b.minZ,z-sz/2); b.maxZ=Math.max(b.maxZ,z+sz/2);
  });
  return b;
}

function buildSrcDoc(structures, meta, selectedId, enriched) {
  var threeD = structures.filter(function(s){ return !isUiStructure(s); });
  var blocks = JSON.stringify(threeD);
  var bounds = JSON.stringify(getBounds(structures, enriched));
  var accent = (meta && meta.accent) || "#25D0FF";
  var label  = (meta && meta.label) || "RBX WORLD";
  var qScore = (meta && typeof meta.qualityScore === "number") ? meta.qualityScore : null;
  var tiers  = (meta && Array.isArray(meta.tierCoverage)) ? meta.tierCoverage.slice().sort() : null;
  var source = (meta && meta.source) || "preview";
  // Score colour: green ≥85, amber 70–84, red <70.
  var qColor = qScore == null ? "#56697d" : (qScore >= 85 ? "#5BE49B" : (qScore >= 70 ? "#F2C94C" : "#FF6B6B"));
  var qBadge = qScore == null ? "" :
    '<div id="qhud"><div class="qrow"><span class="qlbl">QUALITY</span><span class="qval" style="color:'+qColor+';text-shadow:0 0 8px '+qColor+'aa;">'+Math.round(qScore)+'</span></div>'+
    (tiers ? '<div class="qrow"><span class="qlbl">TIERS</span><span class="qtiers">'+tiers.map(function(t){return '<span class="qt">T'+t+'</span>';}).join("")+'</span></div>' : '')+
    '<div class="qrow"><span class="qlbl">SOURCE</span><span class="qsrc">'+source+'</span></div></div>';

  return [
'<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
'html,body{margin:0;padding:0;height:100%;overflow:hidden;font-family:ui-monospace,Menlo,monospace;}',
'#c{display:block;width:100%;height:100%;cursor:grab;}',
'#c:active{cursor:grabbing;}',
'#hud{position:absolute;top:10px;left:12px;color:'+accent+';font-size:11px;font-weight:700;letter-spacing:1px;text-shadow:0 0 8px '+accent+'aa;pointer-events:none;}',
'#qhud{position:absolute;top:34px;left:12px;background:rgba(8,13,20,0.78);border:1px solid #2a3a4d;border-radius:6px;padding:7px 10px;color:#9fb2c8;font-size:10px;letter-spacing:1px;pointer-events:none;min-width:160px;}',
'#qhud .qrow{display:flex;align-items:center;gap:8px;margin:2px 0;}',
'#qhud .qlbl{color:#56697d;font-weight:700;width:54px;}',
'#qhud .qval{font-size:18px;font-weight:900;letter-spacing:0;}',
'#qhud .qtiers{display:flex;gap:3px;}',
'#qhud .qt{background:rgba(37,208,255,0.12);border:1px solid #25506b;color:'+accent+';border-radius:3px;padding:1px 5px;font-size:9px;font-weight:700;}',
'#qhud .qsrc{color:#7a90a8;font-weight:700;}',
'#cam{position:absolute;top:10px;right:12px;display:flex;gap:4px;}',
'#cam button{background:rgba(12,18,28,0.85);color:#9fb2c8;border:1px solid #2a3a4d;border-radius:4px;font-size:10px;padding:4px 7px;cursor:pointer;font-family:inherit;}',
'#cam button:hover{border-color:'+accent+';color:'+accent+';}',
'#cam button.on{border-color:'+accent+';color:'+accent+';}',
'#empty{position:absolute;top:50%;left:0;right:0;text-align:center;transform:translateY(-50%);color:#56697d;font-size:13px;line-height:20px;}',
'#hint{position:absolute;bottom:8px;left:12px;color:#3d4f63;font-size:9px;pointer-events:none;}',
'</style></head><body>',
'<canvas id="c"></canvas>',
'<div id="hud">⬡ '+label+' · '+threeD.length+' parts</div>',
qBadge,
'<div id="cam"><button data-v="iso" class="on">ISO</button><button data-v="front">FRONT</button><button data-v="top">TOP</button><button data-v="side">SIDE</button><button data-v="fit">FIT</button><button data-shot="orbit" class="shotbtn">▶ ORBIT</button><button data-shot="flythrough" class="shotbtn">▶ FLY</button><button data-shot="stop" class="shotbtn">■ STOP</button></div>',
(structures.length===0?'<div id="empty"><b style="color:#7a90a8;font-size:15px">No Roblox world yet</b><br/><br/>Paste Lua that creates Instance.new("Part") objects.<br/>Then press RUN.</div>':''),
'<div id="hint">drag = orbit · scroll = zoom · static structure viewport (runtime = Roblox Studio)</div>',
'<script>(function(){',
'var blocks='+blocks+';var bounds='+bounds+';var selId='+JSON.stringify(selectedId||null)+';' +
'var terrain='+JSON.stringify(meta&&meta.terrain?meta.terrain:null)+';',
'var cv=document.getElementById("c"),ctx=cv.getContext("2d");',
// camera state
'var cam={yaw:0.7,pitch:0.62,zoom:1,view:"iso"};',
'var drag=false,lx=0,ly=0;',
'var midX=(bounds.minX+bounds.maxX)/2,midY=(bounds.minY+bounds.maxY)/2,midZ=(bounds.minZ+bounds.maxZ)/2;',
'function size(){cv.width=cv.clientWidth*2;cv.height=cv.clientHeight*2;ctx.setTransform(2,0,0,2,0,0);}',
'size();window.addEventListener("resize",function(){size();draw();});',
// fit scale from bounds + zoom
'function baseScale(){var w=cv.clientWidth,h=cv.clientHeight;',
'var wW=Math.max(1,bounds.maxX-bounds.minX),wD=Math.max(1,bounds.maxZ-bounds.minZ),wH=Math.max(1,bounds.maxY-bounds.minY);',
'var span=Math.max(wW,wD,wH*1.4);return Math.min(w,h)/(span*1.7);}',
// 3D rotate + project (perspective)
'function project(px,py,pz){',
'var dx=px-midX,dy=py-midY,dz=pz-midZ;',
'var cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);',
'var x1=dx*cy-dz*sy,z1=dx*sy+dz*cy;',
'var cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);',
'var y1=dy*cp-z1*sp,z2=dy*sp+z1*cp;',
'var s=baseScale()*cam.zoom;',
'var persp=1/(1+ (z2*s)/2600);',
'var w=cv.clientWidth,h=cv.clientHeight;',
'return {sx:w/2+x1*s*persp, sy:h/2-y1*s*persp, depth:z2};}',
// color helpers
'function hx(hex){var n=parseInt(String(hex).slice(1),16);if(isNaN(n))n=0x4488cc;return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}',
'function rgba(c,a){return "rgba("+c.r+","+c.g+","+c.b+","+a+")";}',
'function lighten(c,f){return {r:Math.min(255,c.r+f),g:Math.min(255,c.g+f),b:Math.min(255,c.b+f)};}',
'function darken(c,f){return {r:Math.max(0,c.r-f),g:Math.max(0,c.g-f),b:Math.max(0,c.b-f)};}',
// v63 — wider PBR-leaning material palette. Each entry returns
// { amb (top-face brightness), sheen (highlight intensity), glow (emissive),
//   rough (face-shade variance to fake micro-surface) }.
'function matParams(m){var T={Neon:{amb:0,sheen:0,glow:1,rough:0},' +
'Metal:{amb:38,sheen:0.55,glow:0,rough:0.05},' +
'DiamondPlate:{amb:32,sheen:0.40,glow:0,rough:0.30},' +
'CorrodedMetal:{amb:22,sheen:0.18,glow:0,rough:0.55},' +
'Foil:{amb:55,sheen:0.85,glow:0,rough:0},' +
'Marble:{amb:42,sheen:0.50,glow:0,rough:0.05},' +
'Granite:{amb:18,sheen:0.10,glow:0,rough:0.45},' +
'Slate:{amb:14,sheen:0.10,glow:0,rough:0.35},' +
'Concrete:{amb:16,sheen:0.04,glow:0,rough:0.55},' +
'Brick:{amb:18,sheen:0.05,glow:0,rough:0.50},' +
'Cobblestone:{amb:14,sheen:0.07,glow:0,rough:0.65},' +
'WoodPlanks:{amb:26,sheen:0.08,glow:0,rough:0.40},' +
'Wood:{amb:24,sheen:0.05,glow:0,rough:0.45},' +
'Sand:{amb:38,sheen:0.02,glow:0,rough:0.70},' +
'Sandstone:{amb:34,sheen:0.05,glow:0,rough:0.55},' +
'Grass:{amb:30,sheen:0.02,glow:0,rough:0.75},' +
'Asphalt:{amb:8,sheen:0.06,glow:0,rough:0.55},' +
'Glass:{amb:48,sheen:0.95,glow:0,rough:0},' +
'Ice:{amb:55,sheen:0.85,glow:0,rough:0.10},' +
'SmoothPlastic:{amb:22,sheen:0.12,glow:0,rough:0.05}};' +
'return T[m]||{amb:22,sheen:0.05,glow:0,rough:0.20};}',
// draw a box (cube) with 3 visible faces + lighting
'function drawBox(b,col){',
'var x=+b.x||0,y=+b.y||0,z=+b.z||0,w=+b.w||4,hh=+b.h||1,d=+b.d||4;',
'var mp=matParams(b.material);',
'var c=hx(col);',
'var P=[[x-w/2,y+hh,z-d/2],[x+w/2,y+hh,z-d/2],[x+w/2,y+hh,z+d/2],[x-w/2,y+hh,z+d/2],',
'[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]].map(function(p){return project(p[0],p[1],p[2]);});',
// faces: top(0123), and the two most-facing sides
'function face(idx,shade){ctx.beginPath();ctx.moveTo(P[idx[0]].sx,P[idx[0]].sy);for(var i=1;i<idx.length;i++)ctx.lineTo(P[idx[i]].sx,P[idx[i]].sy);ctx.closePath();',
'var col2=shade<0?darken(c,-shade):lighten(c,shade);ctx.fillStyle=rgba(col2,b.material==="Neon"?0.96:0.99);ctx.fill();',
'if(mp.sheen>0){ctx.fillStyle=rgba(lighten(c,80),mp.sheen);ctx.fill();}',
'ctx.strokeStyle=rgba(darken(c,60),0.5);ctx.lineWidth=0.6;ctx.stroke();}',
// glow under neon
'if(mp.glow){ctx.save();ctx.globalCompositeOperation="lighter";var g=project(x,y+hh/2,z);var rad=Math.max(w,d)*baseScale()*cam.zoom*0.9;var grd=ctx.createRadialGradient(g.sx,g.sy,0,g.sx,g.sy,rad);grd.addColorStop(0,rgba(c,0.5));grd.addColorStop(1,rgba(c,0));ctx.fillStyle=grd;ctx.beginPath();ctx.arc(g.sx,g.sy,rad,0,7);ctx.fill();ctx.restore();}',
'face([4,5,6,7],-70);', // bottom (rarely seen, dark)
'face([1,2,6,5],-45);', // right side
'face([3,2,6,7],-25);', // front side
'face([0,1,2,3],mp.amb);', // top (lit)
'}',
// draw sphere approximation (ball)
'function drawSphere(b,col){var x=+b.x||0,y=+b.y||0,z=+b.z||0,r=(+b.w||4)/2;var c=hx(col);var p=project(x,y+r,z);var sc=baseScale()*cam.zoom*r;var mp=matParams(b.material);',
'if(mp.glow){ctx.save();ctx.globalCompositeOperation="lighter";var grd2=ctx.createRadialGradient(p.sx,p.sy,0,p.sx,p.sy,sc*2.4);grd2.addColorStop(0,rgba(c,0.55));grd2.addColorStop(1,rgba(c,0));ctx.fillStyle=grd2;ctx.beginPath();ctx.arc(p.sx,p.sy,sc*2.4,0,7);ctx.fill();ctx.restore();}',
'var grd=ctx.createRadialGradient(p.sx-sc*0.35,p.sy-sc*0.35,sc*0.1,p.sx,p.sy,sc);grd.addColorStop(0,rgba(lighten(c,70),1));grd.addColorStop(1,rgba(darken(c,40),1));ctx.fillStyle=grd;ctx.beginPath();ctx.arc(p.sx,p.sy,sc,0,7);ctx.fill();ctx.strokeStyle=rgba(darken(c,60),0.5);ctx.stroke();}',
// draw cylinder approximation
'function drawCyl(b,col){var x=+b.x||0,y=+b.y||0,z=+b.z||0,r=(+b.d||4)/2,hh=(+b.h||1);var c=hx(col);var mp=matParams(b.material);',
'var topC=project(x,y+hh,z),botC=project(x,y,z);var sc=baseScale()*cam.zoom*r;',
'if(mp.glow){ctx.save();ctx.globalCompositeOperation="lighter";var grd3=ctx.createRadialGradient(topC.sx,topC.sy,0,topC.sx,topC.sy,sc*2.2);grd3.addColorStop(0,rgba(c,0.5));grd3.addColorStop(1,rgba(c,0));ctx.fillStyle=grd3;ctx.beginPath();ctx.arc(topC.sx,topC.sy,sc*2.2,0,7);ctx.fill();ctx.restore();}',
'ctx.fillStyle=rgba(darken(c,30),0.98);ctx.beginPath();ctx.moveTo(botC.sx-sc,botC.sy);ctx.lineTo(botC.sx+sc,botC.sy);ctx.lineTo(topC.sx+sc,topC.sy);ctx.lineTo(topC.sx-sc,topC.sy);ctx.closePath();ctx.fill();',
'ctx.fillStyle=rgba(lighten(c,30),1);ctx.beginPath();ctx.ellipse(topC.sx,topC.sy,sc,sc*0.4,0,0,7);ctx.fill();ctx.strokeStyle=rgba(darken(c,60),0.5);ctx.stroke();}',
// v63 — draw wedge (sloped roof / ramp). Uses 5 vertices: a rectangular
// base + a sloped top ridge running along the +z axis.
'function drawWedge(b,col){var x=+b.x||0,y=+b.y||0,z=+b.z||0,w=+b.w||4,hh=+b.h||1,d=+b.d||4;',
'var mp=matParams(b.material),c=hx(col);',
'var P=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2],',
'[x-w/2,y+hh,z-d/2],[x+w/2,y+hh,z-d/2]].map(function(p){return project(p[0],p[1],p[2]);});',
'function face(idx,sh){ctx.beginPath();ctx.moveTo(P[idx[0]].sx,P[idx[0]].sy);for(var i=1;i<idx.length;i++)ctx.lineTo(P[idx[i]].sx,P[idx[i]].sy);ctx.closePath();var col2=sh<0?darken(c,-sh):lighten(c,sh);ctx.fillStyle=rgba(col2,0.99);ctx.fill();ctx.strokeStyle=rgba(darken(c,60),0.5);ctx.lineWidth=0.6;ctx.stroke();}',
'face([0,1,2,3],-60);',  // bottom
'face([1,2,5],-40);',     // right triangle
'face([0,3,4],-30);',     // left triangle
'face([2,3,4,5],mp.amb);', // sloped top
'face([0,1,5,4],mp.amb-12);', // back vertical
'}',
// v63 — terrain ground plane. Tinted radial fill at y=bounds.minY using the
// terrain biome material so the preview matches Studio.
'function drawTerrain(){if(!terrain)return;var pad=Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ)*0.55;',
'var cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2,gy=Math.min(bounds.minY,0);',
'var pts=[project(cx-pad,gy,cz-pad),project(cx+pad,gy,cz-pad),project(cx+pad,gy,cz+pad),project(cx-pad,gy,cz+pad)];',
'var mat=String(terrain.ground||"Grass");',
'var palette={Grass:"#4a7d3e",Sand:"#d2bd84",Sandstone:"#b89f6e",Slate:"#4f5a66",Metal:"#7a8590",DiamondPlate:"#6e7884",CorrodedMetal:"#7a6b58",Asphalt:"#2d2f33",Concrete:"#8c8c8e",Cobblestone:"#6b6358",Ground:"#7a5a3a"};',
'var fill=palette[mat]||"#3d4f4a";var c=hx(fill);',
'ctx.beginPath();ctx.moveTo(pts[0].sx,pts[0].sy);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i].sx,pts[i].sy);ctx.closePath();',
'var ggx=(pts[0].sx+pts[2].sx)/2,ggy=(pts[0].sy+pts[2].sy)/2;',
'var grd=ctx.createRadialGradient(ggx,ggy,0,ggx,ggy,Math.max(80,Math.abs(pts[2].sx-pts[0].sx)/1.4));',
'grd.addColorStop(0,rgba(lighten(c,18),0.98));grd.addColorStop(1,rgba(darken(c,18),0.98));ctx.fillStyle=grd;ctx.fill();}',
// grid (subtle, on ground plane)
'function drawGrid(){var step=Math.max(8,Math.round((bounds.maxX-bounds.minX)/10));ctx.lineWidth=0.5;',
'for(var gx=bounds.minX-step;gx<=bounds.maxX+step;gx+=step){var a=project(gx,bounds.minY,bounds.minZ-step),bb=project(gx,bounds.minY,bounds.maxZ+step);ctx.strokeStyle="rgba(60,90,120,0.14)";ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.lineTo(bb.sx,bb.sy);ctx.stroke();}',
'for(var gz=bounds.minZ-step;gz<=bounds.maxZ+step;gz+=step){var c2=project(bounds.minX-step,bounds.minY,gz),d2=project(bounds.maxX+step,bounds.minY,gz);ctx.strokeStyle="rgba(60,90,120,0.14)";ctx.beginPath();ctx.moveTo(c2.sx,c2.sy);ctx.lineTo(d2.sx,d2.sy);ctx.stroke();}}',
// sky gradient
'function drawSky(){var w=cv.clientWidth,h=cv.clientHeight;var g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#0a1018");g.addColorStop(0.55,"#0d1622");g.addColorStop(1,"#070b12");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}',
'function draw(){',
'drawSky();drawTerrain();drawGrid();',
// sort all by depth, render painter order
'var items=blocks.map(function(b){var p=project(+b.x||0,+b.y||0,+b.z||0);return {b:b,depth:p.depth};});',
'items.sort(function(a,b){return a.depth-b.depth;});',
'items.forEach(function(it){var b=it.b;var col=b.color||"#4488CC";var sh=(b.shape||"Block");',
'var sel=(b.__id&&b.__id===selId);',
'if(sh==="Ball"||sh==="Sphere")drawSphere(b,col);else if(sh==="Cylinder")drawCyl(b,col);else if(sh==="Wedge")drawWedge(b,col);else drawBox(b,col);',
'if(sel){var sp=project(+b.x||0,(+b.y||0)+(+b.h||1),+b.z||0);ctx.save();ctx.strokeStyle="#00FF8C";ctx.lineWidth=2.5;ctx.shadowColor="#00FF8C";ctx.shadowBlur=14;var r=Math.max(+b.w||4,+b.d||4)*baseScale()*cam.zoom*0.85;ctx.beginPath();ctx.arc(sp.sx,sp.sy,r,0,7);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle="#00FF8C";ctx.font="bold 11px monospace";ctx.fillText(b.label||"",sp.sx+r+4,sp.sy);ctx.restore();}',
'});',
'}',
// camera presets
'function setView(v){cam.view=v;',
'if(v==="iso"){cam.yaw=0.7;cam.pitch=0.62;}',
'else if(v==="front"){cam.yaw=0;cam.pitch=0.15;}',
'else if(v==="top"){cam.yaw=0;cam.pitch=1.45;}',
'else if(v==="side"){cam.yaw=1.5708;cam.pitch=0.15;}',
'else if(v==="fit"){cam.zoom=1;cam.yaw=0.7;cam.pitch=0.62;}',
'draw();}',
// ── Video Preview Engine: animated cinematic camera ──────────────────
// A real animation loop drives camera shots (orbit / flythrough). It moves
// the SAME camera the user can drag — no content is generated, only the
// viewpoint animates. Manual drag/zoom cancels the active shot.
'var shot=null;var shotT=0;var rafId=null;',
'function stopShot(){shot=null;if(rafId){cancelAnimationFrame(rafId);rafId=null;}',
'Array.prototype.forEach.call(document.querySelectorAll(".shotbtn"),function(b){b.classList.remove("on");});}',
'function tick(){if(!shot){return;}shotT+=0.016;',
'if(shot==="orbit"){cam.yaw+=0.006;cam.pitch=0.55+Math.sin(shotT*0.4)*0.12;}',
'else if(shot==="flythrough"){cam.yaw+=0.003;cam.zoom=1.6+Math.sin(shotT*0.5)*0.6;cam.pitch=0.35+Math.sin(shotT*0.3)*0.1;}',
'else if(shot==="hero"){cam.yaw+=0.01;cam.pitch=0.5;cam.zoom=1.2;}',
'draw();rafId=requestAnimationFrame(tick);}',
'function startShot(mode){stopShot();shot=mode;shotT=0;rafId=requestAnimationFrame(tick);}',
'Array.prototype.forEach.call(document.querySelectorAll("[data-shot]"),function(btn){btn.addEventListener("click",function(){',
'var m=btn.getAttribute("data-shot");',
'Array.prototype.forEach.call(document.querySelectorAll(".shotbtn"),function(b){b.classList.remove("on");});',
'if(m==="stop"){stopShot();return;}btn.classList.add("on");startShot(m);});});',
'Array.prototype.forEach.call(document.querySelectorAll("#cam button"),function(btn){btn.addEventListener("click",function(){',
'Array.prototype.forEach.call(document.querySelectorAll("#cam button"),function(b){b.classList.remove("on");});btn.classList.add("on");setView(btn.getAttribute("data-v"));});});',
// orbit drag
'cv.addEventListener("mousedown",function(e){drag=true;lx=e.clientX;ly=e.clientY;});',
'window.addEventListener("mouseup",function(){drag=false;});',
'window.addEventListener("mousemove",function(e){if(!drag)return;if(typeof stopShot==="function")stopShot();cam.yaw+=(e.clientX-lx)*0.01;cam.pitch=Math.max(-0.2,Math.min(1.5,cam.pitch+(e.clientY-ly)*0.008));lx=e.clientX;ly=e.clientY;draw();});',
// zoom
'cv.addEventListener("wheel",function(e){e.preventDefault();cam.zoom=Math.max(0.25,Math.min(5,cam.zoom*(e.deltaY<0?1.12:0.9)));draw();},{passive:false});',
// ── v59 CANVAS PICKING ────────────────────────────────────────────────
// Screen-space hit radius for a block (matches highlight geometry).
'function hitRadius(b){var sh=(b.shape||"Block");var s=baseScale()*cam.zoom;',
'if(sh==="Ball"||sh==="Sphere")return ((+b.w||4)/2)*s;',
'if(sh==="Cylinder")return ((+b.d||4)/2)*s*1.1;',
'return Math.max(+b.w||4,+b.d||4)*s*0.6;}',
// Project the block CENTER (mid-height) for hit test.
'function blockCenter(b){return project(+b.x||0,(+b.y||0)+(+b.h||1)/2,+b.z||0);}',
// Return front-most block whose screen circle contains (mx,my), else null.
'function pick(mx,my){var best=null,bestDepth=-Infinity;',
'blocks.forEach(function(b){var c=blockCenter(b);var dx=mx-c.sx,dy=my-c.sy;var r=hitRadius(b);',
'if(dx*dx+dy*dy<=r*r){var d=project(+b.x||0,+b.y||0,+b.z||0).depth;if(d>bestDepth){bestDepth=d;best=b;}}});',
'return best;}',
// Track press position to distinguish click (select) from drag (orbit).
'var pressX=0,pressY=0,moved=false;',
'cv.addEventListener("mousedown",function(e){pressX=e.clientX;pressY=e.clientY;moved=false;});',
'cv.addEventListener("mousemove",function(e){if(drag&&(Math.abs(e.clientX-pressX)>4||Math.abs(e.clientY-pressY)>4))moved=true;});',
'cv.addEventListener("click",function(e){if(moved)return;', // ignore clicks that were drags
'var rect=cv.getBoundingClientRect();var mx=e.clientX-rect.left,my=e.clientY-rect.top;',
'var hit=pick(mx,my);',
'var id=hit?hit.__id:null;',
'try{window.parent.postMessage({source:"af51-viewport",type:"select",id:id},"*");}catch(err){}',
'});',
'draw();',
'})();</script></body></html>'
].join("\n");
}

export function RbxPreviewCanvas(props) {
  // v59: listen for clicks bubbling up from the viewport iframe → selectedId
  var onSelect = props.onSelect;
  useEffect(function () {
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
    function handle(ev) {
      var d = ev && ev.data;
      if (d && d.source === "af51-viewport" && d.type === "select") {
        if (typeof onSelect === "function") onSelect(d.id || null);
      }
    }
    window.addEventListener("message", handle);
    return function () { window.removeEventListener("message", handle); };
  }, [onSelect]);
  var previewData    = props.previewData || null;
  var qualityReport  = props.qualityReport || (previewData && previewData.report) || null;

  // v66: RbxPreviewDirector enriches the scene BEFORE rendering
  // ─────────────────────────────────────────────────────────────
  // Director analyzes:
  // - Semantic grouping (vehicles, characters, environment)
  // - Hero selection (main focus object)
  // - Character rigs (humanoid detection)
  // - Performance analysis (draw calls, mobile readiness)
  //
  // This intelligence DRIVES the preview, not just observes it.
  var enriched = useMemo(function() {
    if (!previewData) return null;

    // Convert preview data to graph format for Director
    var graph = null;
    if (previewData.graph && previewData.graph.nodes) {
      graph = previewData.graph; // Already has graph
    } else if (Array.isArray(previewData.nodes)) {
      // production-scenegraph format
      graph = { nodes: previewData.nodes };
    } else if (Array.isArray(previewData.structures)) {
      // generatedPreview format - convert structures back to nodes
      graph = {
        nodes: previewData.structures.map(function(s) {
          return {
            id: s.id,
            className: s.luaClass || s.type,
            properties: {
              Name: s.label,
              Position: [s.x, s.y, s.z],
              Size: [s.w, s.h, s.d],
              Color: s.color,
              Material: s.material,
              Anchored: s.anchored
            },
            parent: s.parent
          };
        })
      };
    }

    if (!graph) return null;

    // Let Director analyze the scene
    var director = new RbxPreviewDirector();
    return director.enrich(graph, {});
  }, [previewData]);

  // v63: accept BOTH generatedPreview.json (.structures) and
  // production-scenegraph.json (.nodes). The conversion lives in
  // rbxPreviewUtils so it stays a pure function.
  var rawStructures  = structuresFromPreviewData(previewData);
  var structures     = normalizeStructures(rawStructures);
  var uiItems        = structures.filter(isUiStructure);

  // v66: Apply Director's intelligence to enhance structures
  // ─────────────────────────────────────────────────────────
  // Director provides: semantic groups, hero objects, character rigs
  // Use this to improve camera framing, grouping, and visual quality
  if (enriched && enriched.semantic) {
    // Log semantic understanding (for debugging)
    console.log('[RbxPreviewDirector] Scene analysis:', {
      vehicles: enriched.semantic.vehicles || [],
      buildings: enriched.semantic.buildings || [],
      characters: enriched.characters && enriched.characters.rigs ? enriched.characters.rigs.length : 0,
      ui: enriched.ui ? Object.keys(enriched.ui).filter(function(k) { return enriched.ui[k].length > 0; }) : [],
      performance: enriched.performance
    });
  }

  var meta = useMemo(function() {
    var targetId = (previewData && (previewData.target || previewData.targetId)) || props.targetId;
    return {
      accent: previewData && previewData.lighting ? previewData.lighting.neonColor : "#25D0FF",
      label:  targetId ? String(targetId).toUpperCase() : "RBX WORLD",
      qualityScore: qualityReport && typeof qualityReport.qualityScore === "number"
                   ? qualityReport.qualityScore : null,
      tierCoverage: qualityReport && qualityReport.tierCoverage
                   ? qualityReport.tierCoverage.present : null,
      source:       Array.isArray(previewData && previewData.nodes) ? "scenegraph" : "preview",
      // v63 — Terrain biome carried from production-scenegraph.services.Terrain
      // so the canvas can render a tinted ground plane that matches Studio.
      terrain:      terrainFromPreviewData(previewData),
    };
  }, [previewData, props.targetId, qualityReport]);

  var srcDoc = useMemo(function() { return buildSrcDoc(structures, meta, props.selectedId, enriched); }, [structures, meta, props.selectedId, enriched]);

  if (Platform.OS !== "web") {
    return (
      <View style={styles.fallback}>
        <Text style={[styles.ft, { color: meta.accent }]}>⬡ {meta.label}</Text>
        <Text style={styles.fsub}>{structures.length} structures · viewport requires web browser</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <iframe
        key={(props.buildId || props.targetId || "") + ":" + structures.length + ":" + (props.selectedId||"")}
        srcDoc={srcDoc}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        sandbox="allow-scripts"
        title={"RBX Viewport: " + meta.label}
      />
      {uiItems.length > 0 ? (
        <View style={styles.uiDock}>
          <Text style={styles.uiHeader}>⬡ UI LAYER · {uiItems.length}</Text>
          {uiItems.slice(0, 8).map(function(u, i) {
            return (
              <View key={i} style={styles.uiRow}>
                <View style={[styles.uiDot, { backgroundColor: u.color || "#46C0FF" }]} />
                <Text style={styles.uiItem}>{u.luaClass}{u.label && u.label !== u.luaClass ? "  ·  " + u.label : ""}</Text>
              </View>
            );
          })}
          <Text style={styles.uiNote}>{getUIRenderingNote(uiItems)}</Text>
        </View>
      ) : null}
    </View>
  );
}

var styles = StyleSheet.create({
  wrap:     { flex: 1, width: "100%", height: "100%", minHeight: 320, backgroundColor: "#070b12", position: "relative" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#070b12", padding: 24 },
  ft:       { fontSize: 16, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  fsub:     { fontSize: 12, color: "#56697d", textAlign: "center", lineHeight: 20 },
  uiDock:   { position: "absolute", bottom: 28, right: 12, backgroundColor: "rgba(8,13,20,0.92)", borderColor: "#2a3a4d", borderWidth: 1, borderRadius: 8, padding: 10, maxWidth: 240 },
  uiHeader: { color: "#46C0FF", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  uiRow:    { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  uiDot:    { width: 8, height: 8, borderRadius: 2, marginRight: 7 },
  uiItem:   { color: "#C8D2E0", fontSize: 11, lineHeight: 16, fontFamily: Platform.OS === "web" ? "ui-monospace,Menlo,monospace" : undefined },
  uiNote:   { color: "#4a5d70", fontSize: 9, marginTop: 6, fontStyle: "italic" },
});

export default RbxPreviewCanvas;
