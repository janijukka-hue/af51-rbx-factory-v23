// AF51-RBX | t3/roblox-rbx/zip-reader.js
// Pure-Node ZIP central-directory reader. Reads a single named entry from
// a ZIP file without invoking the `unzip` binary. Supports STORED (method 0)
// and DEFLATE (method 8) — the two methods written by ZipHardener.
//
// Used by /rbx/preview/:buildId so the route works on platforms (Windows
// stripped containers, minimal Linux images) where unzip is not on PATH.
//
// Reference: PKWARE APPNOTE 4.3.7 — EOCD, central directory, local header.

import { openSync, readSync, closeSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const SIG_EOCD     = 0x06054b50;
const SIG_CD       = 0x02014b50;
const SIG_LOCAL    = 0x04034b50;
const EOCD_MIN     = 22;
const EOCD_SEARCH  = 65557;  // 22 + max comment 65535

function _readEOCD(fd, size) {
  const start = Math.max(0, size - EOCD_SEARCH);
  const len   = size - start;
  const buf   = Buffer.allocUnsafe(len);
  readSync(fd, buf, 0, len, start);
  for (let i = buf.length - EOCD_MIN; i >= 0; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) {
      return {
        cdEntries: buf.readUInt16LE(i + 10),
        cdSize:    buf.readUInt32LE(i + 12),
        cdOffset:  buf.readUInt32LE(i + 16),
      };
    }
  }
  throw new Error("ZIP EOCD not found");
}

function _readCentralDirectory(fd, eocd) {
  const cd = Buffer.allocUnsafe(eocd.cdSize);
  readSync(fd, cd, 0, eocd.cdSize, eocd.cdOffset);
  const entries = [];
  let off = 0;
  for (let i = 0; i < eocd.cdEntries; i++) {
    if (cd.readUInt32LE(off) !== SIG_CD) throw new Error("ZIP CD signature mismatch");
    const method     = cd.readUInt16LE(off + 10);
    const compSize   = cd.readUInt32LE(off + 20);
    const uncompSize = cd.readUInt32LE(off + 24);
    const nameLen    = cd.readUInt16LE(off + 28);
    const extraLen   = cd.readUInt16LE(off + 30);
    const commentLen = cd.readUInt16LE(off + 32);
    const localHdr   = cd.readUInt32LE(off + 42);
    const name       = cd.slice(off + 46, off + 46 + nameLen).toString("utf8");
    entries.push({ name, method, compSize, uncompSize, localHdr });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function _readEntry(fd, entry) {
  // Local file header: signature(4) + version(2) + flags(2) + method(2)
  // + time(2) + date(2) + crc(4) + compSize(4) + uncompSize(4)
  // + nameLen(2) + extraLen(2) + name + extra + data
  const hdr = Buffer.allocUnsafe(30);
  readSync(fd, hdr, 0, 30, entry.localHdr);
  if (hdr.readUInt32LE(0) !== SIG_LOCAL) throw new Error("ZIP local-header signature mismatch");
  const nameLen  = hdr.readUInt16LE(26);
  const extraLen = hdr.readUInt16LE(28);
  const dataOff  = entry.localHdr + 30 + nameLen + extraLen;
  const data     = Buffer.allocUnsafe(entry.compSize);
  if (entry.compSize > 0) readSync(fd, data, 0, entry.compSize, dataOff);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error("Unsupported ZIP compression method: " + entry.method);
}

/**
 * Reads a single named entry from a ZIP file.
 * @param {string} zipPath - absolute path to the ZIP file
 * @param {string} entryName - exact entry name (e.g. "generatedPreview.json")
 * @returns {Buffer} the (decompressed) entry bytes
 * @throws if the entry is not present or the ZIP is malformed
 */
export function readZipEntry(zipPath, entryName) {
  const size = statSync(zipPath).size;
  const fd   = openSync(zipPath, "r");
  try {
    const eocd    = _readEOCD(fd, size);
    const entries = _readCentralDirectory(fd, eocd);
    const target  = entries.find(e => e.name === entryName);
    if (!target) throw new Error("ZIP entry not found: " + entryName);
    return _readEntry(fd, target);
  } finally {
    closeSync(fd);
  }
}

/**
 * Lists entry names in a ZIP file.
 * @param {string} zipPath
 * @returns {string[]} ordered list of entry names
 */
export function listZipEntries(zipPath) {
  const size = statSync(zipPath).size;
  const fd   = openSync(zipPath, "r");
  try {
    const eocd    = _readEOCD(fd, size);
    const entries = _readCentralDirectory(fd, eocd);
    return entries.map(e => e.name);
  } finally {
    closeSync(fd);
  }
}

export default { readZipEntry, listZipEntries };
