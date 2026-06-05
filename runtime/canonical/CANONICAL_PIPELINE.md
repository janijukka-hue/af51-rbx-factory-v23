# AF51 RBX Canonical Pipeline

Only supported runtime pipeline:

Lua
↓
AST
↓
Semantic Analysis
↓
ObjectGraph
↓
Preview
↓
Validation
↓
Snapshot
↓
Manifest
↓
Vault
↓
Deterministic ZIP
↓
Publish

Rules:
- No legacy pipeline execution
- No fallback translators
- No duplicate exporters
- No deprecated build flows
- No mixed runtime state

All exports must originate from RuntimePipelineOrchestrator.