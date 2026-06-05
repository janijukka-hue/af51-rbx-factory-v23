// _make-delivery-zip.mjs — one-shot packager for an AF51-RBX delivery snapshot.
// Walks v60_work/, applies the project's .gitignore-style exclusions, and writes
// a single zip to ../af51-rbx-v60.zip. Intentionally separate from the real
// factory's zip-hardener: this script only packages source for hand-off, it
// never participates in a build.
import archiver from 'archiver';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('../af51-rbx-v60.zip');
const ROOT = process.cwd();

// Excluded path prefixes (relative to ROOT). Mirrors .gitignore minus
// exports-rbx/ which we keep (only 138 KB, lets the SSE test pass out of box).
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '_runs',
  'runs',
  '.cache',
  'dist',
  'build',
  '.git',
  '.expo',
]);
// Excluded individual files (basename match).
const EXCLUDE_FILES = new Set([
  '.DS_Store',
  '_make-delivery-zip.mjs', // don't ship the packager itself
]);
// Excluded extensions.
const EXCLUDE_EXT = new Set(['.log']);

function walk(dir, rel = '') {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const r = rel ? rel + '/' + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue;
      out.push(...walk(full, r));
    } else if (st.isFile()) {
      if (EXCLUDE_FILES.has(name)) continue;
      if (EXCLUDE_EXT.has(path.extname(name))) continue;
      out.push({ full, rel: r, size: st.size });
    }
  }
  return out;
}

const files = walk(ROOT);
let totalBytes = 0;
for (const f of files) totalBytes += f.size;

console.log(`AF51-RBX delivery packager`);
console.log(`  source root : ${ROOT}`);
console.log(`  files       : ${files.length}`);
console.log(`  raw size    : ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  output zip  : ${OUT}`);

const out = fs.createWriteStream(OUT);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('warning', (e) => { console.warn('  warning:', e.message); });
archive.on('error', (e) => { console.error('  error:', e); process.exit(1); });

const closed = new Promise((res) => out.on('close', res));
archive.pipe(out);

for (const f of files) {
  archive.file(f.full, { name: 'v60_work/' + f.rel });
}

await archive.finalize();
await closed;

const zipBytes = fs.statSync(OUT).size;
console.log(`\n  ✓ written ${(zipBytes / 1024 / 1024).toFixed(2)} MB (${zipBytes} bytes)`);
console.log(`  ✓ ${OUT}`);
