// test-future-machine.mjs — AF51 FutureMachine: rings + SSE live-stream
// Covers: pure RingEvents helpers, RingRuntime determinism, and the
// /rbx/audit/stream/<buildId> SSE route's replay invariant against /rbx/audit.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
// Import from leaf modules (not index.js) so we avoid pulling in JSX components.
import { createRingRuntime } from './ui/futureMachine/RingRuntime.js';
import {
  intentToRingEvents, memoryToRingEvents,
  energyToRingEvents, worldToRingEvents,
} from './ui/futureMachine/RingEvents.js';

const C={g:'\x1b[32m',r:'\x1b[31m',c:'\x1b[36m',b:'\x1b[1m',x:'\x1b[0m'};
let P=0,F=0;
function t(l,c,d=''){if(c){console.log(`  ${C.g}✓${C.x} ${l}`);P++;}else{console.log(`  ${C.r}✗${C.x} ${l}${d?' — '+d:''}`);F++;}}
function sec(s){console.log(`\n${C.c}${C.b}── ${s} ──${C.x}`);}

// ── 1. Pure RingEvents helpers ──────────────────────────────────────────────
sec('RingEvents — pure branches');

t('intentToRingEvents([])=null → []', intentToRingEvents(null).length === 0);
const iFull = intentToRingEvents({ targetId:'obby', targetType:'obby', qualityScore:97, rules:{total:6,satisfied:6,identity:'sci-fi'} });
t('intent full → 5 events', iFull.length === 5);
t('intent full → all done', iFull.every(e => e.state === 'done'));
const iPartial = intentToRingEvents({ qualityScore:50, rules:{total:6,satisfied:3} });
t('intent partial qualityScore<gate → QUALITY=error', iPartial.find(e=>e.segment==='QUALITY').state === 'error');
t('intent partial rules satisfied<total → RULES=active', iPartial.find(e=>e.segment==='RULES').state === 'active');

t('memoryToRingEvents(null) → []', memoryToRingEvents(null).length === 0);
const mFull = memoryToRingEvents({ ghostId:'g', artifactId:'a', parentCapsuleId:'p', buildGeneration:2, mutationSource:'rbx-pipeline', repairCount:0 });
t('memory full → HEALTH=done', mFull.find(e=>e.segment==='HEALTH').state === 'done');
t('memory repairCount>0 → HEALTH=active', memoryToRingEvents({ ghostId:'g', artifactId:'a', repairCount:3 }).find(e=>e.segment==='HEALTH').state === 'active');
t('memory genesis (no parent) → ANCESTOR=idle', mFull.find(e=>e.segment==='ANCESTOR').state === 'done');

const eFull = energyToRingEvents({ buildDuration:1000, zipSize:50000, recordCount:15, runtimeModules:9, entryCount:30 });
t('energy 5 events', eFull.length === 5);
const wFull = worldToRingEvents({ factory:'AF51-RBX', rojo:'7.x', robloxCompatible:true, signedAt:'2026', masterHash:'h' });
t('world 5 events all done', wFull.every(e => e.state === 'done'));

// ── 2. RingRuntime determinism ──────────────────────────────────────────────
sec('RingRuntime — replay determinism');

const records = [
  { seq:0, traceId:'t1', phase:'STERILITY', event:'PHASE_OK', payload:{error:null}, at:1000 },
  { seq:1, traceId:'t1', phase:'QUALITY',   event:'PHASE_OK', payload:{error:null}, at:1010 },
  { seq:2, traceId:'t1', phase:'GHOST_SEAL',event:'SEAL_OK',  payload:{ghostId:'g'}, at:1020 },
];
const intent = { targetId:'obby', targetType:'obby', qualityScore:97, qualityPass:true, rules:{total:6,satisfied:6,identity:'x'}, criticals:0, warnings:0 };
const ledger = { ghostId:'g', artifactId:'a', parentCapsuleId:null, buildGeneration:1, mutationSource:'rbx-pipeline', repairCount:0, layerCount:9, auditHash:'h', createdAt:900, sealedAt:1020 };
const energy = { buildDuration:120, zipSize:50000, recordCount:3, runtimeModules:9, entryCount:30 };
const world  = { factory:'AF51-RBX', rojo:'7.x', robloxCompatible:true, signedAt:'2026', masterHash:'mh' };

const rt1 = createRingRuntime(); rt1.replay(records, intent, ledger, energy, world);
const rt2 = createRingRuntime(); rt2.replay(records, intent, ledger, energy, world);
t('replay twice → identical snapshot', JSON.stringify(rt1.snapshot()) === JSON.stringify(rt2.snapshot()));

const rt3 = createRingRuntime();
for (const r of records) rt3.consume(r);
rt3.applyIntent(intent); rt3.applyMemory(ledger); rt3.applyEnergy(energy); rt3.applyWorld(world);
t('consume()+apply* ≡ replay()', JSON.stringify(rt3.snapshot()) === JSON.stringify(rt1.snapshot()));

const rtEmpty = createRingRuntime(); rtEmpty.replay([]);
t('empty replay → traceId null', rtEmpty.snapshot().traceId === null);

// ── 3. SSE route — live ≡ replay (real server) ──────────────────────────────
sec('SSE /rbx/audit/stream/<buildId> — live ≡ replay');

const buildId = fs.readdirSync('exports-rbx').find(f => f.endsWith('.zip'))?.match(/build_[a-z0-9_]+/i)?.[0];
if (!buildId) { t('exports-rbx has a build zip', false, 'no ZIP found'); }
else {
  const PORT = 3100 + Math.floor(Math.random()*200);
  const srv = spawn('node', ['server.js'], { env:{...process.env, PORT:String(PORT)}, stdio:['ignore','pipe','pipe'] });
  await new Promise(r => setTimeout(r, 1500));

  const fetchJson = path => new Promise((res,rej) => {
    http.get(`http://localhost:${PORT}${path}`, r => { let s=''; r.on('data',d=>s+=d); r.on('end',()=>{try{res(JSON.parse(s));}catch(e){rej(e);}}); }).on('error', rej);
  });
  const streamLive = bid => new Promise((res,rej) => {
    http.get(`http://localhost:${PORT}/rbx/audit/stream/${bid}?pacingMs=0`, r => {
      let buf=''; const live=createRingRuntime();
      r.on('data', d => {
        buf += d.toString(); let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0,i); buf = buf.slice(i+2);
          let ev='message', data='';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) ev = line.slice(7);
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue;
          let j; try { j = JSON.parse(data); } catch(_) { continue; }
          if (ev === 'meta') {
            if (j.intent) live.applyIntent(j.intent);
            if (j.ledger) live.applyMemory(j.ledger);
            if (j.energy) live.applyEnergy(j.energy);
            if (j.world)  live.applyWorld(j.world);
          } else if (ev === 'record') {
            live.consume(j);
          } else if (ev === 'done') {
            const s = live.snapshot();
            if (s.intent) live.applyIntent(s.intent);
            if (s.ledger) live.applyMemory(s.ledger);
            if (s.energy) live.applyEnergy(s.energy);
            if (s.world)  live.applyWorld(s.world);
            res(live.snapshot());
          }
        }
      });
      r.on('error', rej);
    }).on('error', rej);
  });

  try {
    const liveSnap = await streamLive(buildId);
    const a = await fetchJson(`/rbx/audit/${buildId}`);
    t('GET /rbx/audit returns ok', a.ok === true);
    t('SSE meta+records carry intent', !!liveSnap.intent && liveSnap.intent.qualityScore === a.intent.qualityScore);
    t('SSE final traceId === audit traceId', liveSnap.traceId === a.audit.traceId);
    const rp = createRingRuntime();
    rp.replay(a.audit.records || [], a.intent, a.ledger, a.energy, a.world);
    t('live SSE snapshot ≡ replay() snapshot', JSON.stringify(liveSnap) === JSON.stringify(rp.snapshot()));
  } catch (e) {
    t('SSE roundtrip succeeds', false, e.message);
  } finally {
    srv.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 200));
  }
}

const tot=P+F;
console.log(`\n${C.b}${'═'.repeat(56)}${C.x}`);
console.log(`  FUTURE MACHINE: ${tot} | Pass: ${C.g}${P}${C.x} | Fail: ${F>0?C.r:''}${F}${C.x}`);
console.log(F===0?`${C.g}${C.b}  ✓ ALL PASS — rings + SSE replay invariant holds 🔥${C.x}`:`${C.r}  ✗ ${F} failed${C.x}`);
console.log(`${'═'.repeat(56)}`);
process.exit(F>0?1:0);
