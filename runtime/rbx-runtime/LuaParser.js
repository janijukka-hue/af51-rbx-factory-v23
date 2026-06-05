// runtime/rbx-runtime/LuaParser.js
// AF51-RBX — Deterministic Roblox Lua → AST parser with for-loop unrolling.
// No execution. Numeric expressions evaluated via the safe LuaExpr evaluator.

import { evalExpr, evalVector3 } from './LuaExpr.js';

const MAX_UNROLL = 256; // safety cap on total unrolled instances

export class LuaParser {
  parse(source) {
    const lines = String(source || '').split('\n');
    const nodes = [];
    const serviceAliases = {};
    let unrolledCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line || line.startsWith('--')) continue;

      // ── for VAR = START, STOP[, STEP] do ──────────────────────────────
      const forMatch = line.match(/^for\s+(\w+)\s*=\s*([^,]+),\s*([^,]+?)(?:,\s*(.+?))?\s+do$/);
      if (forMatch) {
        const loopVar = forMatch[1];
        const start = evalExpr(forMatch[2], {});
        const stop  = evalExpr(forMatch[3], {});
        const step  = forMatch[4] ? evalExpr(forMatch[4], {}) : 1;

        // collect loop body until matching 'end'
        const body = [];
        let depth = 1;
        let j = i + 1;
        for (; j < lines.length; j++) {
          const bl = lines[j].trim();
          if (/\b(for|while|if|function)\b.*\bdo\b/.test(bl) || /\bfunction\b/.test(bl) || /\bif\b.*\bthen\b/.test(bl)) depth++;
          if (bl === 'end' || bl.startsWith('end')) { depth--; if (depth === 0) break; }
          body.push(lines[j]);
        }

        if (start != null && stop != null && step) {
          for (let v = start; (step > 0 ? v <= stop : v >= stop); v += step) {
            if (unrolledCount >= MAX_UNROLL) break;
            unrolledCount += this._parseBody(body, nodes, serviceAliases, { [loopVar]: v }, loopVar, v);
          }
        }
        i = j; // skip past 'end'
        continue;
      }

      // ── flat statements ────────────────────────────────────────────────
      this._parseLine(line, nodes, serviceAliases, {}, i + 1);
    }

    return { type: 'LuaAST', nodes, serviceAliases };
  }

  // Parse a loop body for ONE iteration. Resolves local intermediate vars
  // (e.g. `local angle = math.rad(i*30)`) into the scope before instances.
  _parseBody(body, nodes, serviceAliases, scope, loopVar, iterVal) {
    const localScope = Object.assign({}, scope);
    let created = 0;
    // pre-pass: capture intermediate numeric locals
    for (const rawLine of body) {
      const l = rawLine.trim();
      const lm = l.match(/^local\s+(\w+)\s*=\s*(.+)$/);
      if (lm && !/Instance\.new/.test(lm[2])) {
        const val = evalExpr(lm[2], localScope);
        if (val != null) localScope[lm[1]] = val;
      }
    }
    // main pass: instances + properties, with a per-iteration var suffix
    const before = nodes.length;
    for (const rawLine of body) {
      const l = rawLine.trim();
      if (!l || l.startsWith('--')) continue;
      this._parseLine(l, nodes, serviceAliases, localScope, 0, '_' + iterVal);
    }
    created = nodes.filter((n, idx) => idx >= before && n.type === 'InstanceCreation').length;
    return created;
  }

  // Parse a single line. scope holds numeric vars; varSuffix disambiguates
  // loop-iteration instance vars so each iteration is a distinct object.
  _parseLine(line, nodes, serviceAliases, scope, lineNo, varSuffix) {
    varSuffix = varSuffix || '';

    let m = line.match(/(?:local\s+)?(\w+)\s*=\s*game:GetService\(\s*["'](\w+)["']\s*\)/);
    if (m) { serviceAliases[m[1]] = m[2]; nodes.push({ type: 'ServiceAlias', varName: m[1], service: m[2], line: lineNo }); return; }

    m = line.match(/(?:local\s+)?(\w+)\s*=\s*Instance\.new\(\s*["'](\w+)["']\s*\)/);
    if (m) { nodes.push({ type: 'InstanceCreation', varName: m[1] + varSuffix, className: m[2], line: lineNo }); return; }

    m = line.match(/(\w+)\.(\w+)\s*=\s*(.+)/);
    if (m) {
      const [, varName, prop, rawValue] = m;
      const vn = varName + varSuffix;
      if (prop === 'Parent') {
        let pm = rawValue.match(/(\w+)/);
        let parent = pm ? pm[1] : rawValue.trim();
        if (serviceAliases[parent]) parent = serviceAliases[parent];
        nodes.push({ type: 'ParentAssignment', varName: vn, parent, line: lineNo });
      } else if (/Vector3\.new/.test(rawValue)) {
        // Evaluate with loop scope (handles math.cos/sin/i*n)
        const vec = evalVector3(rawValue, scope);
        nodes.push({ type: 'PropertyAssignment', varName: vn, property: prop, rawValue, computed: vec });
      } else {
        // Resolve "Prefix_" .. loopVar  →  "Prefix_3"  when in a loop iteration
        let resolved = rawValue.trim();
        if (varSuffix && /\.\./.test(resolved)) {
          const iterNum = varSuffix.replace(/^_/, '');
          const cm = resolved.match(/^["']([^"']*)["']\s*\.\.\s*\w+$/);
          if (cm) resolved = '"' + cm[1] + iterNum + '"';
        }
        nodes.push({ type: 'PropertyAssignment', varName: vn, property: prop, rawValue: resolved });
      }
      return;
    }
  }
}

export default LuaParser;
