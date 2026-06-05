// m2/agents/ollama-memory-ring.js — Pysyvä Memory Ring
//
// Memory Ring = pyörivä pitkäkestoinen muisti joka kirjoitetaan levylle.
// Toisin kuin OllamaMemory (in-memory), tämä säilyy serverin uudelleenkäynnistyksissä.
//
// Rakenne:
//   vault/ollama-memory/<sessionId>.jsonl
//   Jokainen rivi = yksi muistimerkintä (JSONL-formaatti)
//
// Toiminta:
//   - Max N merkintää per sessio (ring buffer)
//   - Vanhin ylikirjoitetaan kun raja täyttyy
//   - Sisältää: tyyppi, sisältö, aikaleima, tärkeys
//
// Tyypit:
//   "fact"     — käyttäjän kertoma fakta ("käytän React Nativea")
//   "code"     — generoitu koodi joka hyväksyttiin
//   "decision" — tehty päätös ("käytetään suomea")
//   "context"  — yleinen konteksti ("rakennetaan AF51")

import fs   from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

var __dir     = path.dirname(fileURLToPath(import.meta.url));
var RING_DIR  = path.resolve(__dir, "..", "..", "vault", "ollama-memory");
var MAX_RING  = parseInt(process.env.OLLAMA_MEMORY_RING_SIZE || "50", 10);

function ensureDir() {
  if (!fs.existsSync(RING_DIR)) fs.mkdirSync(RING_DIR, { recursive: true });
}

function ringPath(sessionId) {
  var safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return path.join(RING_DIR, safe + ".jsonl");
}

export class OllamaMemoryRing {

  // Lisää merkintä muistiringiin
  static add(sessionId, type, content, importance) {
    ensureDir();
    var fp      = ringPath(sessionId);
    var entries = OllamaMemoryRing.load(sessionId);

    var entry = {
      id:         crypto.randomBytes(4).toString("hex"),
      ts:         new Date().toISOString(),
      type:       type || "fact",
      content:    content,
      importance: importance || "normal",
      sessionId:  sessionId,
    };

    entries.push(entry);

    // Ring buffer — poista vanhimmat
    while (entries.length > MAX_RING) entries.shift();

    // Kirjoita levylle
    var lines = entries.map(function(e) { return JSON.stringify(e); }).join("\n");
    fs.writeFileSync(fp, lines, "utf8");

    return entry;
  }

  // Lataa sessio-rinki levyltä
  static load(sessionId) {
    var fp = ringPath(sessionId);
    if (!fs.existsSync(fp)) return [];
    try {
      return fs.readFileSync(fp, "utf8")
        .split("\n")
        .filter(function(l) { return l.trim(); })
        .map(function(l) { return JSON.parse(l); });
    } catch { return []; }
  }

  // Rakenna context-string Ollamalle (lyhyt tiivistelmä)
  static buildContext(sessionId) {
    var entries = OllamaMemoryRing.load(sessionId);
    if (entries.length === 0) return null;

    // Tärkeät ensin
    var important = entries.filter(function(e) { return e.importance === "high"; });
    var normal    = entries.filter(function(e) { return e.importance !== "high"; });
    var sorted    = important.concat(normal).slice(-15); // viimeiset 15

    var lines = sorted.map(function(e) {
      return "[" + e.type + "] " + e.content;
    });

    return "=== Aiempi muistikonteksti ===\n" + lines.join("\n") + "\n===";
  }

  // Poista sessio-rinki
  static clear(sessionId) {
    var fp = ringPath(sessionId);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  // Lista kaikista sessioista
  static listSessions() {
    ensureDir();
    return fs.readdirSync(RING_DIR)
      .filter(function(f) { return f.endsWith(".jsonl"); })
      .map(function(f) {
        var sid     = f.replace(".jsonl", "");
        var entries = OllamaMemoryRing.load(sid);
        return {
          sessionId: sid,
          count:     entries.length,
          latest:    entries.length > 0 ? entries[entries.length-1].ts : null,
        };
      });
  }

  // Statistiikka
  static stats(sessionId) {
    var entries = OllamaMemoryRing.load(sessionId);
    return {
      sessionId: sessionId,
      count:     entries.length,
      maxSize:   MAX_RING,
      types:     entries.reduce(function(a, e) {
        a[e.type] = (a[e.type] || 0) + 1; return a;
      }, {}),
      oldest:    entries.length > 0 ? entries[0].ts : null,
      latest:    entries.length > 0 ? entries[entries.length-1].ts : null,
      ringPath:  ringPath(sessionId),
    };
  }
}

export default OllamaMemoryRing;