// runtime/preview-engine/zip-reader.js
//
// Minimal pure-Node ZIP reader: extracts a single named entry (we only need
// generatedPreview.json) from an AF51-built ZIP without an external zip lib.
// Supports stored (method 0) and deflated (method 8) entries.

import { readFile } from 'node:fs/promises';
import { inflateRaw } from 'node:zlib';

const u16 = (b, o) => b.readUInt16LE(o);
const u32 = (b, o) => b.readUInt32LE(o);

function _findEOCD(buf) {
  // End-of-central-directory record: signature 0x06054b50, search last 64 KiB.
  const sig = 0x06054b50;
  const start = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === sig) return i;
  }
  return -1;
}

function _readCentralDir(buf) {
  const eocd = _findEOCD(buf);
  if (eocd < 0) throw new Error('zip: EOCD not found');
  const totalEntries = u16(buf, eocd + 10);
  const cdSize       = u32(buf, eocd + 12);
  const cdOffset     = u32(buf, eocd + 16);
  const entries      = [];
  let p = cdOffset;
  const end = cdOffset + cdSize;
  for (let i = 0; i < totalEntries && p < end; i++) {
    if (u32(buf, p) !== 0x02014b50) throw new Error('zip: bad CD signature at ' + p);
    const method   = u16(buf, p + 10);
    const compSize = u32(buf, p + 20);
    const uncSize  = u32(buf, p + 24);
    const nameLen  = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const cmtLen   = u16(buf, p + 32);
    const lfhOff   = u32(buf, p + 42);
    const name     = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compSize, uncSize, lfhOff });
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return entries;
}

function _readLocalData(buf, entry) {
  if (u32(buf, entry.lfhOff) !== 0x04034b50) throw new Error('zip: bad LFH signature');
  const nameLen  = u16(buf, entry.lfhOff + 26);
  const extraLen = u16(buf, entry.lfhOff + 28);
  const dataStart = entry.lfhOff + 30 + nameLen + extraLen;
  return buf.slice(dataStart, dataStart + entry.compSize);
}

function _inflate(buf) {
  return new Promise((res, rej) => inflateRaw(buf, (err, out) => err ? rej(err) : res(out)));
}

/**
 * @param {string} zipPath
 * @param {string} entryName  default: 'generatedPreview.json'
 * @returns {Promise<object|null>} parsed JSON or null if entry is missing
 */
export async function extractPreviewFromZip(zipPath, entryName = 'generatedPreview.json') {
  const buf = await readFile(zipPath);
  const entries = _readCentralDir(buf);
  const entry = entries.find(e => e.name === entryName);
  if (!entry) return null;
  let data = _readLocalData(buf, entry);
  if (entry.method === 0) {
    // stored
  } else if (entry.method === 8) {
    data = await _inflate(data);
  } else {
    throw new Error('zip: unsupported method ' + entry.method);
  }
  return JSON.parse(data.toString('utf8'));
}

export default { extractPreviewFromZip };
