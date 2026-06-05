# AF51 Code Type Detector

AF51 is not an AI builder. This layer does not turn natural language into code.

It separates project/runtime types and routes them into deterministic factory pipelines.

## Doctrine

- Detect first
- Separate type from intent
- Route by deterministic signatures
- Validate before execution
- Audit every classification

## Current supported classifications

- AF51 Factory Runtime
- Expo / React Native App
- Vite React App
- React Single Component
- Next.js App
- HTML/CSS/JS Project
- Node / Express Runtime
- Generic package.json project

## CLI

```bash
npm run detect
```

## API

```text
GET  /detect/status
POST /detect/project
```

## Expected result for this package

```text
projectType: af51_factory_runtime
target: factory_runtime
pipeline: AF51_FACTORY_PIPELINE_V1
policy: ALLOW_PIPELINE_ROUTE
```
