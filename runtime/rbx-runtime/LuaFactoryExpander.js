// runtime/rbx-runtime/LuaFactoryExpander.js
// AF51-RBX — Expands known factory function calls (makePart, makeNPC) into Instance.new equivalents.
// Stateless static analysis. No Lua execution. Adds AST nodes that InstanceGraphBuilder can consume.

function stripComments(source) {
  return String(source || '').replace(/--.*$/gm, '');
}

function splitArgs(argString) {
  const args = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let quote = null;

  for (let i = 0; i < argString.length; i++) {
    const ch = argString[i];
    const prev = argString[i - 1];

    if ((ch === '"' || ch === "'") && prev !== '\\') {
      if (!inString) {
        inString = true;
        quote = ch;
      } else if (quote === ch) {
        inString = false;
        quote = null;
      }
    }

    if (!inString) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;

      if (ch === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

function parseString(value) {
  const m = String(value || '').trim().match(/^["']([\s\S]*?)["']$/);
  return m ? m[1] : null;
}

// Expands makePart(...) calls into AST nodes for InstanceGraphBuilder
function expandMakePartCalls(source) {
  const clean = stripComments(source);
  const nodes = [];
  let varCounter = 1;

  // Find all makePart( positions
  let pos = 0;
  while (true) {
    const idx = clean.indexOf('makePart(', pos);
    if (idx === -1) break;

    // Skip if this is function definition
    const before = clean.slice(Math.max(0, idx - 50), idx);
    if (/function\s+$/.test(before) || /local\s+function\s+$/.test(before)) {
      pos = idx + 9;
      continue;
    }

    // Find matching closing paren with nesting
    let depth = 1;
    let i = idx + 9; // after "makePart("
    while (i < clean.length && depth > 0) {
      if (clean[i] === '(') depth++;
      if (clean[i] === ')') depth--;
      i++;
    }

    if (depth !== 0) {
      pos = idx + 9;
      continue; // unclosed
    }

    const rawArgs = clean.slice(idx + 9, i - 1);
    const varName = `_factoryPart${varCounter++}`;
    pos = i;

    const args = splitArgs(rawArgs);

    if (args.length < 5) {
      continue;
    }

    const name = parseString(args[0]);
    const sizeExpr = args[1];
    const positionExpr = args[2];
    const colorExpr = args[3];
    const materialExpr = args[4];

    if (!name) {
      continue;
    }

    // Create Instance.new node
    nodes.push({
      type: 'InstanceCreation',
      varName,
      className: 'Part',
      source: 'expanded_makePart',
    });

    // Add properties
    nodes.push({
      type: 'PropertyAssignment',
      varName,
      property: 'Name',
      rawValue: `"${name}"`,
      computed: name,
    });

    nodes.push({
      type: 'PropertyAssignment',
      varName,
      property: 'Size',
      rawValue: sizeExpr,
    });

    nodes.push({
      type: 'PropertyAssignment',
      varName,
      property: 'Position',
      rawValue: positionExpr,
    });

    nodes.push({
      type: 'PropertyAssignment',
      varName,
      property: 'Anchored',
      rawValue: 'true',
      computed: true,
    });

    nodes.push({
      type: 'PropertyAssignment',
      varName,
      property: 'Color',
      rawValue: colorExpr,
    });

    nodes.push({
      type: 'PropertyAssignment',
      varName,
      property: 'Material',
      rawValue: materialExpr,
    });

    // Parent assignment
    nodes.push({
      type: 'ParentAssignment',
      varName,
      parent: 'workspace',
    });
  }

  return nodes;
}

export function expandFactoryFunctions(source, ast) {
  // Expand makePart calls
  const expandedNodes = expandMakePartCalls(source);

  // Append to existing AST nodes (don't replace)
  return {
    ...ast,
    nodes: [...ast.nodes, ...expandedNodes],
  };
}

export default { expandFactoryFunctions };
