// runtime/rbx-runtime/LuaFactoryExpander.js
// AF51-RBX — Expands known factory function calls (makePart, makeNPC, makeTool) into Instance.new equivalents.
// Stateless static analysis. No Lua execution. Adds AST nodes that InstanceGraphBuilder can consume.
//
// Supported factory patterns:
// - makePart(name, size, position, color, material)
// - makeNPC(name, position, appearance)
// - makeTool(name, toolType)

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

// Expands makeNPC(name, position, appearance) calls
// makeNPC("Guard", Vector3.new(0, 3, 0), "Soldier")
function expandMakeNPCCalls(source) {
  const clean = stripComments(source);
  const nodes = [];
  let varCounter = 1;
  let pos = 0;

  while (true) {
    const idx = clean.indexOf('makeNPC(', pos);
    if (idx === -1) break;

    const callStart = idx + 8;
    let depth = 1;
    let i = callStart;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '(') depth++;
      if (clean[i] === ')') depth--;
      i++;
    }

    const argsRaw = clean.slice(callStart, i - 1);
    const args = splitArgs(argsRaw);

    if (args.length >= 2) {
      const varName = 'npc' + varCounter++;
      const nameExpr = args[0];
      const positionExpr = args[1];
      const appearanceExpr = args[2] || '"Robloxian"';

      // Create Model for NPC
      nodes.push({
        type: 'InstanceCreation',
        varName,
        className: 'Model',
        source: 'expanded_makeNPC'
      });

      // Set Name
      const nameValue = parseString(nameExpr);
      if (nameValue) {
        nodes.push({
          type: 'PropertyAssignment',
          varName,
          property: 'Name',
          value: nameValue,
        });
      }

      // Add Humanoid (child of Model)
      const humanoidVar = varName + '_humanoid';
      nodes.push({
        type: 'InstanceCreation',
        varName: humanoidVar,
        className: 'Humanoid',
        source: 'expanded_makeNPC'
      });

      nodes.push({
        type: 'ParentAssignment',
        varName: humanoidVar,
        parent: varName,
      });

      // Add Head (Part)
      const headVar = varName + '_head';
      nodes.push({
        type: 'InstanceCreation',
        varName: headVar,
        className: 'Part',
        source: 'expanded_makeNPC'
      });

      nodes.push({
        type: 'PropertyAssignment',
        varName: headVar,
        property: 'Name',
        value: 'Head',
      });

      nodes.push({
        type: 'PropertyAssignment',
        varName: headVar,
        property: 'Size',
        rawValue: 'Vector3.new(2, 1, 1)',
      });

      nodes.push({
        type: 'PropertyAssignment',
        varName: headVar,
        property: 'Position',
        rawValue: positionExpr,
      });

      nodes.push({
        type: 'PropertyAssignment',
        varName: headVar,
        property: 'Color',
        rawValue: 'Color3.fromRGB(255, 204, 153)', // Skin tone
      });

      nodes.push({
        type: 'ParentAssignment',
        varName: headVar,
        parent: varName,
      });

      // Parent Model to workspace
      nodes.push({
        type: 'ParentAssignment',
        varName,
        parent: 'workspace',
      });
    }

    pos = i;
  }

  return nodes;
}

// Expands makeTool(name, toolType) calls
// makeTool("Sword", "Melee")
function expandMakeToolCalls(source) {
  const clean = stripComments(source);
  const nodes = [];
  let varCounter = 1;
  let pos = 0;

  while (true) {
    const idx = clean.indexOf('makeTool(', pos);
    if (idx === -1) break;

    const callStart = idx + 9;
    let depth = 1;
    let i = callStart;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '(') depth++;
      if (clean[i] === ')') depth--;
      i++;
    }

    const argsRaw = clean.slice(callStart, i - 1);
    const args = splitArgs(argsRaw);

    if (args.length >= 1) {
      const varName = 'tool' + varCounter++;
      const nameExpr = args[0];
      const toolTypeExpr = args[1] || '"Generic"';

      // Create Tool instance
      nodes.push({
        type: 'InstanceCreation',
        varName,
        className: 'Tool',
        source: 'expanded_makeTool'
      });

      // Set Name
      const nameValue = parseString(nameExpr);
      if (nameValue) {
        nodes.push({
          type: 'PropertyAssignment',
          varName,
          property: 'Name',
          value: nameValue,
        });
      }

      // Add Handle (Part)
      const handleVar = varName + '_handle';
      nodes.push({
        type: 'InstanceCreation',
        varName: handleVar,
        className: 'Part',
        source: 'expanded_makeTool'
      });

      nodes.push({
        type: 'PropertyAssignment',
        varName: handleVar,
        property: 'Name',
        value: 'Handle',
      });

      nodes.push({
        type: 'PropertyAssignment',
        varName: handleVar,
        property: 'Size',
        rawValue: 'Vector3.new(1, 4, 1)',
      });

      nodes.push({
        type: 'PropertyAssignment',
        varName: handleVar,
        property: 'Color',
        rawValue: 'Color3.fromRGB(163, 162, 165)', // Gray
      });

      nodes.push({
        type: 'ParentAssignment',
        varName: handleVar,
        parent: varName,
      });

      // Parent Tool to workspace
      nodes.push({
        type: 'ParentAssignment',
        varName,
        parent: 'workspace',
      });
    }

    pos = i;
  }

  return nodes;
}

export function expandFactoryFunctions(source, ast) {
  // Expand all factory patterns
  const makePartNodes = expandMakePartCalls(source);
  const makeNPCNodes = expandMakeNPCCalls(source);
  const makeToolNodes = expandMakeToolCalls(source);

  const allExpandedNodes = [...makePartNodes, ...makeNPCNodes, ...makeToolNodes];

  // Append to existing AST nodes (don't replace)
  return {
    ...ast,
    nodes: [...ast.nodes, ...allExpandedNodes],
  };
}

export default { expandFactoryFunctions };
