// m2/agents/ollama-memory.js
// AF51 ONE — Ollama Session Memory
//
// ARKKITEHTUURI: m2-taso, ei koske ALX:ään eikä t3 Factoryyn.
//
// OllamaMemory pitää keskusteluhistorian muistissa per sessionId.
// Serverin elinaikana pysyvä (in-memory) — ei levylle kirjoitusta.
//
// Myöhemmin laajennettavissa:
//   - Persistent tiedostoon (append-only jsonl)
//   - Per-project memory
//   - Context tagging

export var OLLAMA_MEMORY_VERSION = "1.0.0";

var DEFAULT_MAX_HISTORY = 20;  // max viestiä per sessio
var DEFAULT_MAX_SESSIONS = 50; // max samanaikaisia sessioita

// System prompt — suomi ensin
export var OLLAMA_SYSTEM_PROMPT = {
  role: "system",
  content: `Olet AF51 Ollama — Jani Segermanin tekoälyassistentti AF51 Factory -järjestelmässä.

PUHEKIELI:
Puhu luonnollisesti suomeksi. Lyhyesti, suoraan, ei turhaa höpinää.
Älä listaa sääntöjä tai selitä mitä olet tekemässä — tee se vain.
Vastaa kuin kokenut koodari joka tuntee järjestelmän läpikotaisin.
Ei "Kyllä!", ei "Toki!", ei pitkiä johdantoja. Mene asiaan.

KOODI — PAKOLLISET SÄÄNNÖT:
- Funktio AINA: export default function App() { }
- EI import-lauseita. React, useState, useEffect, useCallback, useRef ovat valmiina.
- Värit: #080c0a tausta, #39ff5a lime, #e8eaf0 teksti, #a78bfa Ollama-purppura
- Fontti: 'Courier New', monospace
- Tyylit: inline style-objekteina
- Kirjoita KOKO koodi — ei lyhennyksiä, ei "// ... rest"
- Koodi toimii suoraan selaimessa — ei buildia, ei ulkoisia kirjastoja

MUISTI:
Muistat koko keskustelun. Jos sanotaan "muuta X", muutat koko edellisen koodin.
Ei toistuvia kysymyksiä asioista jotka on jo kerrottu.`
};

export class OllamaMemory {
  constructor(opts) {
    var options       = opts || {};
    this._maxHistory  = options.maxHistory  || DEFAULT_MAX_HISTORY;
    this._maxSessions = options.maxSessions || DEFAULT_MAX_SESSIONS;
    this._sessions    = new Map();  // sessionId → messages[]
    this._meta        = new Map();  // sessionId → { createdAt, updatedAt, messageCount }
  }

  // ── Historia ────────────────────────────────────────────────

  // Palauttaa session historian (ilman system promptia)
  getHistory(sessionId) {
    return this._sessions.get(sessionId) || [];
  }

  // Palauttaa täyden viestiketjun Ollamalle (system + historia + uusi viesti)
  buildMessages(sessionId, userMessage, ringContext) {
    var history = this.getHistory(sessionId);
    var messages = [ OLLAMA_SYSTEM_PROMPT ];

    // Lisää pysyvä memory ring kontekstina jos olemassa
    if (ringContext) {
      messages.push({
        role: "user",
        content: "Huomio: " + ringContext
      });
      messages.push({
        role: "assistant",
        content: "Ymmärretty. Otan aiemman kontekstin huomioon."
      });
    }

    // Sessiohistoria
    messages.push(...history);
    messages.push({ role: "user", content: userMessage });
    return messages;
  }

  // Tallentaa käyttäjän viestin ja assistentin vastauksen
  append(sessionId, userMessage, assistantResponse) {
    // Evict jos liikaa sessioita
    if (!this._sessions.has(sessionId) && this._sessions.size >= this._maxSessions) {
      this._evictOldest();
    }

    var history = this._sessions.get(sessionId) || [];

    // Lisää uudet viestit
    history.push({ role: "user",      content: userMessage });
    history.push({ role: "assistant", content: assistantResponse });

    // Trim — pidetään max _maxHistory viestiä (FIFO, parillinen määrä)
    var max = this._maxHistory;
    if (max % 2 !== 0) max = max - 1;  // aina parillinen (user+assistant parit)
    while (history.length > max) {
      history.shift();  // poista vanhin
    }

    this._sessions.set(sessionId, history);

    // Meta
    var now  = Date.now();
    var meta = this._meta.get(sessionId) || { createdAt: now, messageCount: 0 };
    meta.updatedAt    = now;
    meta.messageCount = (meta.messageCount || 0) + 2;
    this._meta.set(sessionId, meta);
  }

  // ── Sessio-hallinta ─────────────────────────────────────────

  clear(sessionId) {
    this._sessions.delete(sessionId);
    this._meta.delete(sessionId);
  }

  clearAll() {
    this._sessions.clear();
    this._meta.clear();
  }

  // ── Stats ───────────────────────────────────────────────────

  getStats(sessionId) {
    if (sessionId) {
      var hist = this.getHistory(sessionId);
      var meta = this._meta.get(sessionId) || {};
      return {
        sessionId:    sessionId,
        messages:     hist.length,
        maxHistory:   this._maxHistory,
        createdAt:    meta.createdAt  || null,
        updatedAt:    meta.updatedAt  || null,
        totalAdded:   meta.messageCount || 0,
      };
    }
    // Kaikki sessiot
    var sessions = [];
    for (var [sid, hist] of this._sessions) {
      var m = this._meta.get(sid) || {};
      sessions.push({
        sessionId:  sid,
        messages:   hist.length,
        updatedAt:  m.updatedAt || null,
      });
    }
    return {
      totalSessions: sessions.length,
      maxSessions:   this._maxSessions,
      maxHistory:    this._maxHistory,
      sessions:      sessions.sort(function(a, b) { return (b.updatedAt||0) - (a.updatedAt||0); }),
    };
  }

  // ── Sisäiset ─────────────────────────────────────────────────

  _evictOldest() {
    var oldest = null; var oldestTime = Infinity;
    for (var [sid, meta] of this._meta) {
      var t = meta.updatedAt || 0;
      if (t < oldestTime) { oldestTime = t; oldest = sid; }
    }
    if (oldest) {
      this._sessions.delete(oldest);
      this._meta.delete(oldest);
    }
  }
}

// Singleton — jaettu koko serverin elinajan
var _instance = null;
export function getOllamaMemory(opts) {
  if (!_instance) _instance = new OllamaMemory(opts || {});
  return _instance;
}