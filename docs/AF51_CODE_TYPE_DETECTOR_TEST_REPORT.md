# AF51 Code Type Detector Test Report

## Scope

Built into clean QUBE51 / AF51 Product Edition UI foundation.

This package is verified as Factory / production infrastructure content, not unrelated consumer runtime content.

## Added

- `k1/code-detector/SignatureScanner.js`
- `k1/code-detector/DetectorRegistry.js`
- `k1/code-detector/FrameworkDetector.js`
- `k1/code-detector/RuntimeClassifier.js`
- `k1/code-detector/PipelineSelector.js`
- `k1/code-detector/CodeTypeDetector.js`
- `k1/code-detector/EnterpriseValidator.js`
- `k1/code-detector/index.js`
- `scripts/af51-detect.js`
- `routes/detect.js`
- `test-code-detector.mjs`

## Commands verified

```bash
npm run detect
npm run test:detector
node --check server.js
```

## Expected detector output

```text
projectType: af51_factory_runtime
target: factory_runtime
pipeline: AF51_FACTORY_PIPELINE_V1
confidence: 0.99
policy: ALLOW_PIPELINE_ROUTE
```

## Content safety check

Search terms checked and not found:

- unrelated consumer runtime product markers
- consumer chat runtime endpoint markers
- non-factory UI phrase markers
- chat-specific brain/mode markers
- external chat adapter constants

## Result

PASS.

This artifact is Factory / AF51 Product Edition content with an added deterministic Code Type Detector layer.
