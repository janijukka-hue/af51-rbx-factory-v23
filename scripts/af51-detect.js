#!/usr/bin/env node
// scripts/af51-detect.js
// CLI: node scripts/af51-detect.js [projectRoot]

import { detectCodeType, validateDetection } from "../k1/code-detector/index.js";

const root = process.argv[2] || process.cwd();
const detection = detectCodeType(root);
const validation = validateDetection(detection);
const report = { detection, validation };

console.log(JSON.stringify(report, null, 2));
process.exit(validation.ok ? 0 : 2);