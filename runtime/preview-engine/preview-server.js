// runtime/preview-engine/preview-server.js
//
// Tiny pure-Node static server + preview JSON endpoint. Serves the Studio UI
// on http://localhost:8765 (or PORT env). Exposed virtual endpoints:
//
//   GET /api/preview/latest         → latest generatedPreview.json (raw)
//   GET /api/preview?target=obby    → preview JSON for the named target
//   GET /api/builds                 → { builds: [{ target, buildId, zip, size }] }
//
// Everything else is served as static from the preview-engine directory.

import http from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPreviewFromZip } from './zip-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR  = __dirname;
const PROJECT_DIR = path.resolve(__dirname, '..', '..');
const EXPORTS_DIR = path.join(PROJECT_DIR, 'exports-rbx');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2':'font/woff2', '.map': 'application/json',
};

async function listBuilds() {
  try {
    const entries = await readdir(EXPORTS_DIR);
    const zips = entries.filter(n => n.endsWith('.zip'));
    const out  = [];
    for (const z of zips) {
      const full = path.join(EXPORTS_DIR, z);
      const st   = await stat(full);
      const m    = z.match(/^AF51-RBX-AF51-([A-Z]+)-build_[a-z0-9_]+\.zip$/i);
      out.push({ target: m ? m[1].toLowerCase() : 'unknown', zip: z, path: full, size: st.size, mtime: st.mtimeMs });
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  } catch (_) { return []; }
}

async function pickBuild(target) {
  const builds = await listBuilds();
  if (target) return builds.find(b => b.target === target.toLowerCase()) || null;
  return builds[0] || null;
}

async function serveStatic(req, res) {
  let url = req.url.split('?')[0];
  if (url === '/' || url === '') url = '/index.html';
  const safe = path.normalize(url).replace(/^([\\/])+/, '');
  const full = path.join(ENGINE_DIR, safe);
  if (!full.startsWith(ENGINE_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
  try {
    const st = await stat(full);
    if (!st.isFile()) throw new Error('not file');
    const mime = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-cache' });
    createReadStream(full).pipe(res);
  } catch (_) {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found: ' + safe);
  }
}

async function handle(req, res) {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/builds') {
      const builds = (await listBuilds()).map(b => ({ target: b.target, zip: b.zip, size: b.size }));
      return _json(res, 200, { builds });
    }
    if (u.pathname === '/api/preview/latest' || u.pathname === '/api/preview') {
      const target = u.searchParams.get('target');
      const b = await pickBuild(target);
      if (!b) return _json(res, 404, { error: 'no builds found in exports-rbx/' });
      // v62: prefer production-scenegraph.json (Studio-parity source of truth).
      // Fallback to generatedPreview.json for older builds.
      let json = await extractPreviewFromZip(b.path, 'production-scenegraph.json');
      if (!json) json = await extractPreviewFromZip(b.path, 'generatedPreview.json');
      if (!json) return _json(res, 404, { error: 'no preview entry in ' + b.zip });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(JSON.stringify(json));
    }
    return serveStatic(req, res);
  } catch (e) { _json(res, 500, { error: String(e.message || e) }); }
}

function _json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function startPreviewServer({ port = Number(process.env.AF51_PREVIEW_PORT) || 8765, host = '127.0.0.1' } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer(handle);
    server.listen(port, host, () => resolve({ server, url: `http://${host}:${port}/` }));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url } = await startPreviewServer();
  console.log('AF51-RBX Studio Preview serving on ' + url);
  console.log('  exports dir: ' + EXPORTS_DIR);
}
