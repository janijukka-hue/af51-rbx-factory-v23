// t3/Factory/pipeline/phases/autofix-phase.js
// KERROS: T3 — Tuotanto
// AutoFix Phase v1.0.0
//
// Lukee koodin ja korjaa automaattisesti:
//   - React: lisää puuttuvan import React, export default, hooks
//   - HTML: lisää DOCTYPE, meta, viewport
//   - Vanilla JS: lisää DOMContentLoaded wrapper tarvittaessa
//   - TypeScript: lisää type annotations jos puuttuvat
//   - Kaikki: normalisoi line endings, poistaa BOM

export class AutofixPhase {

  constructor(opts) {
    this.name  = "AUTOFIX";
    this.debug = (opts || {}).debug || false;
  }

  canSkip() { return false; }

  async execute(context) {
    var files = (context.files || []);
    var buildSpec = context.buildSpec || {};
    var target = buildSpec.target || (context.getCommand ? context.getCommand().target : null) || "web-react";

    var fixed = [];
    var fixes = [];

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var result = this._fixFile(file, target);
      fixed.push(result.file);
      if (result.fixes.length > 0) {
        fixes.push({ path: file.path, fixes: result.fixes });
      }
    }

    context.files = fixed;
    if (context.setPhaseResult) {
      context.setPhaseResult("AUTOFIX", { ok: true, fixedCount: fixes.length, fixes: fixes });
    }

    return { ok: true, fixedCount: fixes.length, fixes: fixes };
  }

  _fixFile(file, target) {
    var code    = file.content || "";
    var path    = file.path    || "";
    var fixes   = [];

    // ── Universaalit korjaukset ───────────────────────────────────
    // BOM
    if (code.charCodeAt(0) === 0xFEFF) {
      code = code.slice(1);
      fixes.push("BOM poistettu");
    }

    // CRLF → LF
    if (code.includes("\r\n")) {
      code = code.replace(/\r\n/g, "\n");
      fixes.push("Line endings normalisoitu (CRLF→LF)");
    }

    var ext = path.split(".").pop().toLowerCase();

    // ── JSX / TSX / React ────────────────────────────────────────
    if (ext === "jsx" || ext === "tsx" || target === "web-react" || target === "expo-app") {
      var r = this._fixReact(code, path, target);
      code   = r.code;
      fixes  = fixes.concat(r.fixes);
    }

    // ── HTML ─────────────────────────────────────────────────────
    if (ext === "html" || target === "html") {
      var h = this._fixHtml(code);
      code  = h.code;
      fixes = fixes.concat(h.fixes);
    }

    // ── JavaScript (vanilla) ─────────────────────────────────────
    if ((ext === "js" || ext === "mjs") && target === "vanilla-js") {
      var v = this._fixVanilla(code);
      code  = v.code;
      fixes = fixes.concat(v.fixes);
    }

    return { file: { ...file, content: code }, fixes: fixes };
  }

  _fixReact(code, path, target) {
    var fixes = [];
    var isRN  = target === "expo-app";

    // 1. Puuttuva React import
    var hasReactImport = /import\s+React/.test(code) || /from ['"]react['"]/.test(code);
    if (!hasReactImport && (/<[A-Z]|<[a-z][a-z]*[\s/>]|useState|useEffect/.test(code))) {
      if (isRN) {
        code = "import React, { useState, useEffect, useCallback, useRef } from 'react';\n" +
               "import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';\n" +
               code;
      } else {
        code = "import React, { useState, useEffect, useCallback, useRef } from 'react';\n" + code;
      }
      fixes.push("React import lisätty");
    }

    // 2. export default puuttuu — lisätään jos on function App
    var hasExportDefault = /export\s+default/.test(code);
    var funcMatch = code.match(/^function\s+(App|Home|Main|Component)\s*\(/m);
    if (!hasExportDefault && funcMatch) {
      code = code + "\n\nexport default " + funcMatch[1] + ";";
      fixes.push("export default " + funcMatch[1] + " lisätty");
    }

    // 3. StyleSheet.create puuttuu (React Native) — lisätään tyhjä pohja
    if (isRN && !/(StyleSheet\.create|const styles)/.test(code) && /style=/.test(code)) {
      code = code + "\n\nconst styles = StyleSheet.create({});";
      fixes.push("StyleSheet.create pohja lisätty");
    }

    // 4. Poistetaan käyttämätön import 'react-native'
    // (ei tee mitään web-react targetissa — ei poista jos on käytössä)

    // 5. Korjataan puuttuva sulkeva tag tai JSX syntax virhe — ei tehdä automaattisesti
    //    (Babel antaa virheen joka on informatiivisempi)

    return { code, fixes };
  }

  _fixHtml(code) {
    var fixes = [];

    // DOCTYPE puuttuu
    if (!/<!DOCTYPE\s+html/i.test(code)) {
      code = "<!DOCTYPE html>\n" + code;
      fixes.push("DOCTYPE html lisätty");
    }

    // charset puuttuu
    if (!/<meta\s[^>]*charset/i.test(code) && /<head/i.test(code)) {
      code = code.replace(/<head>/i, '<head>\n  <meta charset="UTF-8"/>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>');
      fixes.push("charset + viewport meta lisätty");
    }

    return { code, fixes };
  }

  _fixVanilla(code) {
    var fixes = [];

    // document.write tai inline script — lisätään DOMContentLoaded wrapper
    var needsWrapper = /document\.\w+\s*=|document\.querySelector|document\.getElementById/.test(code) &&
                       !/DOMContentLoaded|window\.onload/.test(code) &&
                       !/^<script|<\/script>/.test(code.trim());

    if (needsWrapper) {
      code = "document.addEventListener('DOMContentLoaded', function() {\n" + code + "\n});";
      fixes.push("DOMContentLoaded wrapper lisätty");
    }

    return { code, fixes };
  }
}

export default AutofixPhase;