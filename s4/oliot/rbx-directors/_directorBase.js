// s4/oliot/rbx-directors/_directorBase.js
// KERROS: S4 – Olio · RBX Director Layer
// Version: 1.0.0
//
// Shared primitives for the two Directors. The cardinal rule (from the brief):
// a Director may INTERPRET / UNDERSTAND / ASSESS, but never GENERATE / REPLACE
// / ADD content the code does not contain. To enforce that in practice, every
// inference is expressed as a `finding`:
//
//   finding(value, confidence, evidence[])
//
// where `evidence` lists the concrete scene-graph signals the value is derived
// from. If there is no evidence, the value MUST be "undetermined" — never a
// guess. This makes every Director conclusion auditable back to real code.

export function finding(value, confidence, evidence) {
  return {
    value: value,
    confidence: clamp01(confidence),
    evidence: Array.isArray(evidence) ? evidence : (evidence ? [evidence] : []),
  };
}

// The honest default when the code carries no signal for a question.
export const UNDETERMINED = Object.freeze(finding("undetermined", 0, []));

export function clamp01(n) {
  if (typeof n !== "number" || !isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Count nodes by a predicate, collecting the matching labels as evidence.
export function gather(interpreted, nodes, predicate) {
  const hits = [];
  for (const n of nodes) {
    const sem = interpreted[n.id] || {};
    if (predicate(sem, n)) {
      hits.push((n.properties && n.properties.Name) || n.varName || n.className);
    }
  }
  return hits;
}

// Lowercased, separator-stripped name for keyword matching.
export function nameKey(node) {
  const p = node.properties || {};
  return String(p.Name || node.varName || "").toLowerCase().replace(/[_\s]/g, "");
}

// Does any node name contain one of the given keywords? Returns matched labels.
export function nameMatches(nodes, keywords) {
  const out = [];
  for (const n of nodes) {
    const key = nameKey(n);
    for (const kw of keywords) {
      if (key.includes(kw)) { out.push((n.properties && n.properties.Name) || n.varName); break; }
    }
  }
  return out;
}
