AF51 RBX LIVE PIPELINE TESTS

RUN:

node tests/runtime/run-all-runtime-tests.js

This version:
- removes invalid translator.default fallback
- enforces deterministic translator contract
- requires translateLuaToRBXObjects export
- removes fake fallback execution paths

Goal:
real translator runtime validation
