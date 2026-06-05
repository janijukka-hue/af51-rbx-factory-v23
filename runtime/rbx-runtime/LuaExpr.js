// runtime/rbx-runtime/LuaExpr.js
// AF51-RBX — Deterministic evaluator for the numeric subset of Lua expressions
// used in geometry code: math.cos/sin/rad/pi, + - * / %, parens, numbers, and
// a single loop variable. NO Lua execution — a safe arithmetic parser only.

// Tokenize a numeric expression
function tokenize(expr) {
  const tokens = [];
  const re = /\s*([0-9]*\.?[0-9]+|math\.cos|math\.sin|math\.rad|math\.pi|math\.floor|math\.abs|[A-Za-z_]\w*|[()+\-*/%,])/g;
  let m;
  while ((m = re.exec(expr))) tokens.push(m[1]);
  return tokens;
}

// Recursive-descent evaluator with a variable scope { name: number }
export function evalExpr(expr, scope) {
  const tokens = tokenize(expr);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parsePrimary() {
    const t = peek();
    if (t === '(') { next(); const v = parseAdd(); if (peek() === ')') next(); return v; }
    if (t === 'math.pi') { next(); return Math.PI; }
    if (t === 'math.cos' || t === 'math.sin' || t === 'math.rad' || t === 'math.floor' || t === 'math.abs') {
      const fn = next();
      if (peek() === '(') next();
      const arg = parseAdd();
      if (peek() === ')') next();
      switch (fn) {
        case 'math.cos': return Math.cos(arg);
        case 'math.sin': return Math.sin(arg);
        case 'math.rad': return arg * Math.PI / 180;
        case 'math.floor': return Math.floor(arg);
        case 'math.abs': return Math.abs(arg);
      }
    }
    if (/^[0-9]*\.?[0-9]+$/.test(t)) { next(); return parseFloat(t); }
    if (/^[A-Za-z_]\w*$/.test(t)) { next(); return scope[t] != null ? scope[t] : NaN; }
    return NaN;
  }

  function parseUnary() {
    if (peek() === '-') { next(); return -parseUnary(); }
    if (peek() === '+') { next(); return parseUnary(); }
    return parsePrimary();
  }

  function parseMul() {
    let v = parseUnary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next(); const r = parseUnary();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }

  function parseAdd() {
    let v = parseMul();
    while (peek() === '+' || peek() === '-') {
      const op = next(); const r = parseMul();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  const result = parseAdd();
  return Number.isFinite(result) ? result : null;
}

// Evaluate a Vector3.new(...) call with a variable scope. Returns [x,y,z] or null.
export function evalVector3(raw, scope) {
  const m = raw.match(/Vector3\.new\(([\s\S]*)\)/);
  if (!m) return null;
  // split top-level commas
  const parts = splitArgs(m[1]);
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => evalExpr(p, scope));
  return nums.every((n) => n != null && Number.isFinite(n)) ? nums : null;
}

// Split argument list on top-level commas (respecting parens)
export function splitArgs(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim());
}

export default { evalExpr, evalVector3, splitArgs };
