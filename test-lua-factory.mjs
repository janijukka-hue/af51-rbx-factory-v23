// test-lua-factory.mjs — AF51-RBX user-Lua → Studio ZIP chain
import { LuaParser } from './runtime/rbx-runtime/LuaParser.js';
import { InstanceGraphBuilder } from './runtime/rbx-runtime/InstanceGraphBuilder.js';
import { PreviewRenderer } from './runtime/rbx-runtime/PreviewRenderer.js';
import { LuaProjectBuilder } from './runtime/rbx-runtime/LuaProjectBuilder.js';
import { normalizeStructures, classifyStructure, iconFor, fmtTriple, fmtColor, fmtVal } from './ui/preview/rbxPreviewUtils.js';
import { pick, makeProjector } from './runtime/rbx-runtime/PickingMath.js';
import { reportLuaQuality, measureLuaGraph } from './runtime/rbx-runtime/LuaQualityGate.js';
import { runLuaPasses } from './runtime/rbx-runtime/LuaPasses.js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const C={g:'\x1b[32m',r:'\x1b[31m',c:'\x1b[36m',b:'\x1b[1m',x:'\x1b[0m'};
let P=0,F=0;
function t(l,c2,d=''){if(c2){console.log(`  ${C.g}✓${C.x} ${l}`);P++;}else{console.log(`  ${C.r}✗${C.x} ${l}${d?' — '+d:''}`);F++;}}
function sec(s){console.log(`\n${C.c}${C.b}── ${s} ──${C.x}`);}

const SAMPLE = `local Workspace = game:GetService('Workspace')
local floor = Instance.new('Part')
floor.Name = 'Floor'
floor.Size = Vector3.new(100, 2, 100)
floor.Position = Vector3.new(0, 0, 0)
floor.Anchored = true
floor.BrickColor = BrickColor.new('Bright green')
floor.Parent = Workspace
local spawn = Instance.new('SpawnLocation')
spawn.Size = Vector3.new(6, 1, 6)
spawn.Position = Vector3.new(0, 2, 0)
spawn.Parent = Workspace
local light = Instance.new('PointLight')
light.Brightness = 5
light.Parent = floor`;

sec('Parse');
const ast = new LuaParser().parse(SAMPLE);
t('AST has nodes', ast.nodes.length > 0);
t('service alias captured', ast.serviceAliases.Workspace === 'Workspace');
const graph = new InstanceGraphBuilder().build(ast);
t('3 instances', graph.nodes.length === 3, 'got '+graph.nodes.length);
t('floor is Part', graph.nodes[0].className === 'Part');
t('floor Size parsed', JSON.stringify(graph.nodes[0].properties.Size)==='[100,2,100]');
t('BrickColor → hex', graph.nodes[0].properties.BrickColor === '#4B974B');
t('Anchored bool', graph.nodes[0].properties.Anchored === true);
t('spawn parented to workspace', graph.nodes[1].parent === 'workspace');
t('light nested in floor', graph.nodes[2].parentVar === 'floor');

sec('Preview');
const prev = new PreviewRenderer().render(graph);
t('3 structures', prev.structures.length === 3);
t('floor label = FLOOR', prev.structures[0].label === 'FLOOR');
t('floor size mapped', prev.structures[0].w===100 && prev.structures[0].h===2);
t('spawn glows', prev.structures[1].glow === true);
t('light type', prev.structures[2].type === 'light');

sec('Studio ZIP');
const r = await new LuaProjectBuilder().build(SAMPLE, { projectName:'TestWorld', scriptName:'World', exportsDir:'/tmp/af51-test-exports' });
t('build ok', r.ok);
t('zipName format', /^AF51-RBX-TestWorld-lua_[a-f0-9]+\.zip$/.test(r.zipName), r.zipName);
t('routed to service', !!r.routing.service);
t('zip exists on disk', fs.existsSync(r.zipPath));
const listing = execSync(`unzip -l "${r.zipPath}"`, {encoding:'utf8'});
t('has default.project.json', listing.includes('default.project.json'));
t('has generatedPreview.json', listing.includes('generatedPreview.json'));
t('has signature.json', listing.includes('signature.json'));
t('user Lua in service folder', listing.includes('World.server.lua'));
t('5 service dirs', ['ReplicatedStorage','ServerScriptService','StarterGui','StarterPlayer','Workspace'].every(s=>listing.includes('src/'+s)));
execSync(`unzip -t "${r.zipPath}"`, {stdio:'pipe'});
t('zip integrity (unzip -t)', true);
const proj = JSON.parse(execSync(`unzip -p "${r.zipPath}" default.project.json`, {encoding:'utf8'}));
t('Rojo project valid', proj.name==='TestWorld' && !!proj.tree.$className);
t('Workspace mapped', proj.tree.Workspace.$path === 'src/Workspace');

sec('Determinism');
const a = new InstanceGraphBuilder().build(new LuaParser().parse(SAMPLE));
const b = new InstanceGraphBuilder().build(new LuaParser().parse(SAMPLE));
t('same input → same graph', JSON.stringify(a)===JSON.stringify(b));

sec('Edge cases');
const empty = await new LuaProjectBuilder().build('', {});
t('empty source → ok:false', empty.ok === false);
const garbage = new LuaParser().parse('!@#$%\nrandom text\n123');
t('garbage → 0 instances', new InstanceGraphBuilder().build(garbage).nodes.length === 0);

try { fs.rmSync('/tmp/af51-test-exports', {recursive:true,force:true}); } catch {}


sec('Loop Unrolling');
{
  const loopLua = `for i = 1, 12 do
	local angle = math.rad(i * 30)
	local pillar = Instance.new('Part')
	pillar.Name = 'Pillar_' .. i
	pillar.Size = Vector3.new(2, 18, 2)
	pillar.Position = Vector3.new(math.cos(angle) * 28, 9, math.sin(angle) * 28)
	pillar.Parent = workspace
end`;
  const g = new InstanceGraphBuilder().build(new LuaParser().parse(loopLua));
  const pv = new PreviewRenderer().render(g);
  t('loop unrolls to 12 instances', g.nodes.length === 12, 'got '+g.nodes.length);
  t('labels resolved (Pillar_1)', pv.structures[0].label === 'PILLAR_1', pv.structures[0].label);
  t('positions differ (circle)', pv.structures[0].x !== pv.structures[1].x);
  t('math.cos computed', Math.abs(pv.structures[0].x - 24) <= 1, 'x='+pv.structures[0].x);
  t('all parented to workspace', g.nodes.every(n=>n.parent==='workspace'));

  const stepLua = `for i = 1, 8 do
	local p = Instance.new('Part')
	p.Position = Vector3.new(i * 10, 2, 0)
	p.Parent = workspace
end`;
  const g2 = new InstanceGraphBuilder().build(new LuaParser().parse(stepLua));
  const pv2 = new PreviewRenderer().render(g2);
  t('step loop: 8 instances', g2.nodes.length === 8);
  t('i*10 computed: 10,20,30...', pv2.structures[0].x===10 && pv2.structures[1].x===20);

  const safetyLua = `for i = 1, 9999 do
	local p = Instance.new('Part')
	p.Parent = workspace
end`;
  const g3 = new InstanceGraphBuilder().build(new LuaParser().parse(safetyLua));
  t('unroll safety cap (<=256)', g3.nodes.length <= 256, 'got '+g3.nodes.length);
}


sec('KORJAUS 1 — @AF51_TARGET directive');
{
  const dir = `-- @AF51_TARGET: ReplicatedStorage\nlocal p = Instance.new('Part')\np.Parent = workspace`;
  const r = await new LuaProjectBuilder().build(dir, {projectName:'D',scriptName:'M',exportsDir:'/tmp/d1'});
  t('directive overrides regex', r.routing.service === 'ReplicatedStorage', r.routing.service);
  const noDir = `local p = Instance.new('Part')\np.Parent = workspace`;
  const r2 = await new LuaProjectBuilder().build(noDir, {projectName:'D2',scriptName:'M',exportsDir:'/tmp/d2'});
  t('no directive → regex routing', r2.routing.service === 'ServerScriptService');
  try{fs.rmSync('/tmp/d1',{recursive:true,force:true});fs.rmSync('/tmp/d2',{recursive:true,force:true});}catch{}
}

sec('KORJAUS 3 — UDim2/UI no NaN');
{
  const uiLua = `local g = Instance.new('ScreenGui')\ng.Parent = workspace\nlocal l = Instance.new('TextLabel')\nl.Size = UDim2.new(0,200,0,50)\nl.Parent = g`;
  const g = new InstanceGraphBuilder().build(new LuaParser().parse(uiLua));
  const pv = new PreviewRenderer().render(g);
  const anyNaN = pv.structures.some(s => [s.x,s.y,s.z,s.w,s.h,s.d].some(v=>isNaN(v)));
  t('UI elements produce no NaN', !anyNaN);
  t('UI mapped to ui type', pv.structures.some(s=>s.type==='ui'));
  const partLua = `local p = Instance.new('Part')\np.Size = Vector3.new(10,2,10)\np.Parent = workspace`;
  const pg = new PreviewRenderer().render(new InstanceGraphBuilder().build(new LuaParser().parse(partLua)));
  t('Part dims unaffected by UI fix', pg.structures[0].w===10 && pg.structures[0].h===2);
}

sec('KORJAUS 5 — reproducible build');
{
  const lua = `local p = Instance.new('Part')\np.Parent = workspace`;
  const a = await new LuaProjectBuilder().build(lua, {projectName:'R',scriptName:'M',exportsDir:'/tmp/r1'});
  const b = await new LuaProjectBuilder().build(lua, {projectName:'R',scriptName:'M',exportsDir:'/tmp/r2'});
  t('same source → same buildId', a.buildId === b.buildId, a.buildId+' vs '+b.buildId);
  t('same source → same fingerprint', a.signature.fingerprint === b.signature.fingerprint);
  try{fs.rmSync('/tmp/r1',{recursive:true,force:true});fs.rmSync('/tmp/r2',{recursive:true,force:true});}catch{}
}


sec('KOHTA 4 — big-world bounds (no NaN, auto-fit ready)');
{
  const big = `local base=Instance.new('Part')\nbase.Size=Vector3.new(200,2,200)\nbase.Parent=workspace\nlocal t=Instance.new('Part')\nt.Size=Vector3.new(20,120,20)\nt.Position=Vector3.new(0,60,0)\nt.Parent=workspace`;
  const p = new PreviewRenderer().render(new InstanceGraphBuilder().build(new LuaParser().parse(big)));
  t('big base 200x200', p.structures[0].w===200 && p.structures[0].d===200);
  t('tall tower 120 high', p.structures[1].h===120);
  t('no NaN in big world', p.structures.every(s=>[s.x,s.y,s.z,s.w,s.h,s.d].every(v=>!isNaN(v))));
}

sec('KOHTA 6/8 — honest package metadata');
{
  const lua = `local p=Instance.new('Part')\np.Parent=workspace\nlocal x=Instance.new('Part')\nx.Touched`;
  const r = await new LuaProjectBuilder().build('local p=Instance.new("Part")\np.Parent=workspace\nspawn(function() end)\nlocal h\nh.Touched:Connect(function() end)', {projectName:'M',scriptName:'Main',exportsDir:'/tmp/m6'});
  t('packageType = raw-lua-rojo', r.packageType === 'raw-lua-rojo');
  t('runtimeTruth = roblox-studio', r.runtimeTruth === 'roblox-studio');
  t('does NOT claim governance', r.packageType !== 'af51-governed-runtime');
  t('detects Touched runtime event', r.runtimeEvents.includes('Touched'));
  try{fs.rmSync('/tmp/m6',{recursive:true,force:true});}catch{}
}

sec('KOHTA 5 — parser limits (concat, arith, math, Color3)');
{
  const lua = `for i = 1, 5 do\n local p=Instance.new('Part')\n p.Name='BLOCK_'..i\n p.Position=Vector3.new((i-3)*8,6,-40)\n p.Color=Color3.fromRGB(0,255,140)\n p.Parent=workspace\nend`;
  const p = new PreviewRenderer().render(new InstanceGraphBuilder().build(new LuaParser().parse(lua)));
  t('5.1 concat: BLOCK_1..5', p.structures.map(s=>s.label).join(',')==='BLOCK_1,BLOCK_2,BLOCK_3,BLOCK_4,BLOCK_5');
  t('5.2 arith (i-3)*8', p.structures.map(s=>s.x).join(',')==='-16,-8,0,8,16');
  t('5.4 Color3.fromRGB', p.structures[0].color==='#00FF8C');
}


sec('v58 — Hierarchy + Inspector utils');
{
  const s = [
    {luaClass:'Part',shape:'Ball',parent:'workspace',x:1,y:2,z:3,color:'#FF00FF'},
    {luaClass:'TextLabel',parent:'PlayerGui',type:'ui'},
    {luaClass:'Part',parent:''},
    {label:'NOCLASS',parent:'workspace'}
  ];
  const n = normalizeStructures(s);
  t('all structures get __id', n.every(x=>x.__id!==undefined));
  t('__id is stable (re-normalize same)', normalizeStructures(s)[0].__id === n[0].__id);
  t('classify: Ball→workspace', classifyStructure(s[0])==='workspace');
  t('classify: TextLabel→ui', classifyStructure(s[1])==='ui');
  t('classify: no-parent→unresolved', classifyStructure(s[2])==='unresolved');
  t('icon: Ball', iconFor(s[0])==='\u25CF');
  t('icon: TextLabel', iconFor(s[1])==='T');
  t('fmtTriple finite', fmtTriple(1,2,3)==='1.0, 2.0, 3.0');
  t('fmtTriple null→unknown', fmtTriple(null,null,null)==='unknown');
  t('fmtColor string', fmtColor('#FF00FF')==='#FF00FF');
  t('fmtColor null→unknown', fmtColor(null)==='unknown');
  t('fmtVal missing→unknown', fmtVal(undefined)==='unknown');
  t('fmtVal bool', fmtVal(true)==='true');
  t('no object lost (4 in → 4 classified)', n.length===4);
  // missing fields must not throw
  t('missing fields no throw', (function(){try{n.forEach(x=>{classifyStructure(x);iconFor(x);fmtTriple(x.x,x.y,x.z);fmtColor(x.color);});return true;}catch{return false;}})());
}


sec('v59 — Canvas picking math');
{
  const blocks = [
    {__id:'left',x:-20,y:2,z:0,w:4,h:4,d:4,shape:'Block'},
    {__id:'center',x:0,y:2,z:0,w:4,h:4,d:4,shape:'Block'},
    {__id:'right',x:20,y:2,z:0,w:4,h:4,d:4,shape:'Block'}
  ];
  const bounds={minX:-22,maxX:22,minY:0,maxY:4,minZ:-2,maxZ:2};
  const cam={yaw:0,pitch:0,zoom:1}; const W=800,H=600;
  const proj=makeProjector(cam,bounds,W,H);
  const cc=proj(0,4,0);
  t('click center → center block', pick(blocks,cc.sx,cc.sy,cam,bounds,W,H)?.__id==='center');
  t('click empty → null', pick(blocks,5,5,cam,bounds,W,H)===null);
  const cl=proj(-20,4,0);
  t('click left → left block', pick(blocks,cl.sx,cl.sy,cam,bounds,W,H)?.__id==='left');
  const cr=proj(20,4,0);
  t('click right → right block', pick(blocks,cr.sx,cr.sy,cam,bounds,W,H)?.__id==='right');
  // overlap: front-most wins
  const ov=[{__id:'back',x:0,y:2,z:-10,w:4,h:4,d:4,shape:'Block'},{__id:'front',x:0,y:2,z:10,w:4,h:4,d:4,shape:'Block'}];
  const ob={minX:-2,maxX:2,minY:0,maxY:4,minZ:-12,maxZ:12};
  const pj=makeProjector(cam,ob,W,H); const fc=pj(0,4,10);
  t('overlap → front-most wins', pick(ov,fc.sx,fc.sy,cam,ob,W,H)?.__id==='front');
  // ball + cylinder shapes pickable
  const shapes=[{__id:'ball',x:0,y:2,z:0,w:6,h:6,d:6,shape:'Ball'},{__id:'cyl',x:15,y:2,z:0,w:2,h:4,d:4,shape:'Cylinder'}];
  const sb={minX:-3,maxX:17,minY:0,maxY:6,minZ:-3,maxZ:3};
  const sp=makeProjector(cam,sb,W,H); const bc=sp(0,5,0);
  t('ball pickable', pick(shapes,bc.sx,bc.sy,cam,sb,W,H)?.__id==='ball');
}


sec('Quality gate + passes (measurement only, NO generation)');
{
  const lua = `local f=Instance.new('Part')
f.Size=Vector3.new(100,2,100)
f.Material=Enum.Material.Neon
f.Color=Color3.fromRGB(0,255,140)
f.Parent=workspace
local s=Instance.new('SpawnLocation')
s.Parent=workspace
local l=Instance.new('PointLight')
l.Parent=f`;
  const g = new InstanceGraphBuilder().build(new LuaParser().parse(lua));
  const before = JSON.stringify(g.nodes);

  const m = measureLuaGraph(g);
  t('measures geometry count', m.geometryCount === 1);
  t('measures spawn', m.spawnCount === 1);
  t('measures light', m.lightCount === 1);
  t('measures material diversity', m.materialDiversity >= 1);

  const r = reportLuaQuality(g);
  t('quality score in range', r.score >= 0 && r.score <= 100);
  t('quality is non-blocking', r.blocking === false);
  t('measure did NOT mutate graph', JSON.stringify(g.nodes) === before);

  const ctx = runLuaPasses(g);
  t('passes did NOT mutate graph', JSON.stringify(g.nodes) === before);
  t('passes produced groups', Array.isArray(ctx.annotations.groups) && ctx.annotations.groups.length === g.nodes.length);
  t('passes never added nodes', g.nodes.length === 3);
  t('passLog all ok', ctx.passLog.every(p=>p.ok));

  // empty graph → score reflects emptiness, still non-blocking
  const empty = reportLuaQuality({nodes:[]});
  t('empty graph → has note', empty.notes.length > 0);
  t('empty graph → still non-blocking', empty.blocking === false);
}

const tot=P+F;
console.log(`\n${C.b}${'═'.repeat(52)}${C.x}`);
console.log(`  LUA FACTORY: ${tot} | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:''}${F}${C.x}`);
console.log(F===0?`${C.g}${C.b}  ✓ ALL PASS — user Lua → Studio ZIP works 🔥${C.x}`:`${C.r}  ✗ ${F} failed${C.x}`);
console.log(`${'═'.repeat(52)}`);
process.exit(F>0?1:0);
