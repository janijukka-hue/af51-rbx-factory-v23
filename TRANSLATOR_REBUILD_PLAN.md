# AF51 RBX Translator Rebuild Plan

## CURRENT VERIFIED STATUS

Runtime chain is now REAL and deterministic:

Lua Source
 -> Translator Contract
 -> Object Graph Validation
 -> Render Truth Validation

Confirmed by live runtime tests.

---

## VERIFIED FAILURE

Current translator returns:

```json
{
  "objectCount": 0,
  "objects": []
}
```

This means:

- translator export works
- runtime import works
- worker chain works
- parsing logic fails

---

# ROOT CAUSE HYPOTHESIS

The parser layer inside lua-translator.js is incomplete or disconnected.

Most likely:

1. Regex patterns do not match actual Lua source
2. Parsed objects are never pushed into objects[]
3. Translator returns empty graph
4. Wrong internal function connected to export adapter

---

# REQUIRED REBUILD

## PHASE 1 — TRACE

Add console traces:

```js



```

Verify:
- Instance.new matches
- Vector3.new matches
- Color3.fromRGB matches

---

## PHASE 2 — MINIMAL PARSER

Target ONLY these first:

- Instance.new("Part")
- Size
- Position
- Color
- Parent

Goal:
Return ONE valid object.

---

## PHASE 3 — OBJECT GRAPH

Required schema:

```json
{
  "type": "Part",
  "position": [0,5,0],
  "size": [10,10,10],
  "color": "#00FF88"
}
```

---

## PHASE 4 — LIVE VALIDATION

Required:

translator object count
==
rendered object count

No hidden geometry allowed.

---

# HARD RULES

Forbidden:
- fake fallback objects
- hardcoded object arrays
- demo ownership
- hidden replacement geometry

Required:
- deterministic translator output
- real object graph
- worker truth propagation

---

# CURRENT ENGINEERING PRIORITY

The translator parser is now the main bottleneck.

Everything else:
- runtime
- validation
- contracts
- ESM execution

is finally exposing the REAL state correctly.
