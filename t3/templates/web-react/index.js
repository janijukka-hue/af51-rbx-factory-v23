// t3/templates/web-react/index.js
// KERROS: T3 – Tuotanto
// Web React -template — tuottaa puhdasta React DOM -koodia ilman react-native -importteja.
// S4 LiveRenderView voi renderöidä tämän suoraan Babel-evalilla, ei iframea tarvita.
// TemplatePhase kutsuu getFiles(params) ja kirjoittaa tulokset workspaceen.

export var TEMPLATE_META = {
  id:          "web-react",
  version:     "1.0.0",
  target:      "web-react",
  stack:       "react-vite",
  description: "Pure React DOM — renderöitävissä suoraan LiveRenderView:ssa",
  minNode:     "18",
  webOnly:     true
};

export function getFiles(params) {
  var p        = params   || {};
  var name     = p.name   || "WebApp";
  var features = Array.isArray(p.features) ? p.features : [];
  var version  = p.version || "1.0.0";

  var hasTS       = features.indexOf("typescript")  !== -1;
  var hasJest     = features.indexOf("jest")        !== -1;
  var hasLint     = features.indexOf("eslint")      !== -1;
  var hasTailwind = features.indexOf("tailwind")    !== -1;

  var ext = hasTS ? "tsx" : "jsx";

  var files = [];

  // ── package.json ─────────────────────────────────────────
  files.push({ path: "package.json", content: buildPackageJson(name, version, features, hasTS, hasJest, hasLint, hasTailwind) });

  // ── index.html ───────────────────────────────────────────
  files.push({ path: "index.html", content: buildIndexHtml(name) });

  // ── vite.config.js ───────────────────────────────────────
  files.push({ path: "vite.config." + (hasTS ? "ts" : "js"), content: buildViteConfig(hasTS) });

  // ── src/main.jsx ─────────────────────────────────────────
  files.push({ path: "src/main." + ext, content: buildMain(hasTS) });

  // ── src/App.jsx — pääkomponentti ─────────────────────────
  // TÄRKEÄ: App.jsx on se tiedosto jonka LiveRenderView evaluoi.
  // Ei saa sisältää react-native importteja.
  files.push({ path: "src/App." + ext, content: buildApp(name, hasTS, hasTailwind) });

  // ── src/App.css ──────────────────────────────────────────
  if (!hasTailwind) {
    files.push({ path: "src/App.css", content: buildAppCss() });
  }

  // ── tsconfig ─────────────────────────────────────────────
  if (hasTS) {
    files.push({ path: "tsconfig.json",      content: buildTsConfig() });
    files.push({ path: "tsconfig.node.json", content: buildTsConfigNode() });
  }

  // ── eslint ───────────────────────────────────────────────
  if (hasLint) {
    files.push({ path: ".eslintrc.cjs", content: buildEslintConfig(hasTS) });
  }

  // ── tailwind ─────────────────────────────────────────────
  if (hasTailwind) {
    files.push({ path: "tailwind.config.js",  content: buildTailwindConfig() });
    files.push({ path: "postcss.config.js",   content: buildPostCssConfig() });
    files.push({ path: "src/index.css",       content: buildTailwindCss() });
  }

  // ── jest ─────────────────────────────────────────────────
  if (hasJest) {
    files.push({ path: "jest.config." + (hasTS ? "ts" : "js"), content: buildJestConfig(hasTS) });
    files.push({ path: "src/App.test." + ext,                   content: buildAppTest(name, hasTS) });
  }

  // ── .gitignore ───────────────────────────────────────────
  files.push({ path: ".gitignore", content: "node_modules/\ndist/\n.env\n.env.local\n*.local\n" });

  return files;
}

// ─── Sisältörakentajat ───────────────────────────────────────

function buildPackageJson(name, version, features, hasTS, hasJest, hasLint, hasTailwind) {
  var deps = {
    "react":     "^18.3.1",
    "react-dom": "^18.3.1"
  };

  var devDeps = {
    "@vitejs/plugin-react": "^4.3.1",
    "vite":                 "^5.4.2"
  };

  if (hasTS) {
    devDeps["typescript"]           = "^5.5.3";
    devDeps["@types/react"]         = "^18.3.4";
    devDeps["@types/react-dom"]     = "^18.3.0";
  }

  if (hasJest) {
    devDeps["jest"]                         = "^29.7.0";
    devDeps["@testing-library/react"]       = "^16.0.0";
    devDeps["@testing-library/jest-dom"]    = "^6.4.6";
    devDeps["@testing-library/user-event"]  = "^14.5.2";
    devDeps["jsdom"]                        = "^25.0.0";
    if (hasTS) devDeps["ts-jest"]           = "^29.2.4";
  }

  if (hasLint) {
    devDeps["eslint"]                       = "^8.57.0";
    devDeps["eslint-plugin-react"]          = "^7.35.0";
    devDeps["eslint-plugin-react-hooks"]    = "^4.6.2";
    devDeps["eslint-plugin-react-refresh"]  = "^0.4.9";
    if (hasTS) devDeps["@typescript-eslint/eslint-plugin"] = "^8.0.1";
    if (hasTS) devDeps["@typescript-eslint/parser"]        = "^8.0.1";
  }

  if (hasTailwind) {
    devDeps["tailwindcss"] = "^3.4.10";
    devDeps["autoprefixer"] = "^10.4.20";
    devDeps["postcss"]      = "^8.4.41";
  }

  var scripts = {
    "dev":     "vite",
    "build":   "vite build",
    "preview": "vite preview"
  };
  if (hasLint) scripts["lint"]   = "eslint . --ext js,jsx,ts,tsx";
  if (hasJest) scripts["test"]   = "jest --passWithNoTests";

  return JSON.stringify({ name, version, type: "module", scripts, dependencies: deps, devDependencies: devDeps }, null, 2);
}

function buildIndexHtml(name) {
  return [
    "<!DOCTYPE html>",
    "<html lang=\"fi\">",
    "  <head>",
    "    <meta charset=\"UTF-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
    "    <title>" + name + "</title>",
    "  </head>",
    "  <body>",
    "    <div id=\"root\"></div>",
    "    <script type=\"module\" src=\"/src/main.jsx\"></script>",
    "  </body>",
    "</html>",
    ""
  ].join("\n");
}

function buildViteConfig(hasTS) {
  var ext = hasTS ? "ts" : "js";
  return [
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    "",
    "// https://vitejs.dev/config/",
    "export default defineConfig({",
    "  plugins: [react()],",
    "});",
    ""
  ].join("\n");
}

function buildMain(hasTS) {
  return [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import App from './App." + (hasTS ? "tsx" : "jsx") + "';",
    "",
    "ReactDOM.createRoot(document.getElementById('root')" + (hasTS ? " as HTMLElement" : "") + ").render(",
    "  <React.StrictMode>",
    "    <App />",
    "  </React.StrictMode>",
    ");",
    ""
  ].join("\n");
}

function buildApp(name, hasTS, hasTailwind) {
  // Tärkeä: käytetään vain React DOM -elementtejä (<div>, <button> jne.)
  // Ei react-native importteja. LiveRenderView evaluoi tämän tiedoston.
  if (hasTailwind) {
    return [
      "import React, { useState } from 'react';",
      "",
      "export default function App()" + (hasTS ? ": React.FC" : "") + " {",
      "  const [count, setCount] = useState(0);",
      "",
      "  return (",
      "    <div className=\"min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8\">",
      "      <h1 className=\"text-4xl font-bold mb-2 text-cyan-400\">" + name + "</h1>",
      "      <p className=\"text-gray-400 mb-8\">Rakennettu ALX Factory — web-react template</p>",
      "      <div className=\"flex items-center gap-4\">",
      "        <button",
      "          onClick={() => setCount(c => c - 1)}",
      "          className=\"px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition\"",
      "        >",
      "          −",
      "        </button>",
      "        <span className=\"text-2xl font-mono w-12 text-center\">{count}</span>",
      "        <button",
      "          onClick={() => setCount(c => c + 1)}",
      "          className=\"px-4 py-2 bg-cyan-600 rounded-lg hover:bg-cyan-500 transition\"",
      "        >",
      "          +",
      "        </button>",
      "      </div>",
      "    </div>",
      "  );",
      "}",
      ""
    ].join("\n");
  }

  return [
    "import React, { useState } from 'react';",
    "import './App.css';",
    "",
    "export default function App()" + (hasTS ? ": React.FC" : "") + " {",
    "  const [count, setCount] = useState(0);",
    "",
    "  return (",
    "    <div className=\"app\">",
    "      <header className=\"app-header\">",
    "        <h1>" + name + "</h1>",
    "        <p className=\"subtitle\">Rakennettu ALX Factory — web-react template</p>",
    "      </header>",
    "      <main className=\"app-main\">",
    "        <div className=\"counter\">",
    "          <button onClick={() => setCount(c => c - 1)}>−</button>",
    "          <span className=\"count\">{count}</span>",
    "          <button onClick={() => setCount(c => c + 1)}>+</button>",
    "        </div>",
    "      </main>",
    "    </div>",
    "  );",
    "}",
    ""
  ].join("\n");
}

function buildAppCss() {
  return [
    "* { box-sizing: border-box; margin: 0; padding: 0; }",
    "",
    "body {",
    "  background: #080c0a;",
    "  color: #f0f4f1;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  min-height: 100vh;",
    "}",
    "",
    ".app {",
    "  min-height: 100vh;",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: center;",
    "  justify-content: center;",
    "  padding: 2rem;",
    "}",
    "",
    ".app-header {",
    "  text-align: center;",
    "  margin-bottom: 2.5rem;",
    "}",
    "",
    ".app-header h1 {",
    "  font-size: 2.5rem;",
    "  font-weight: 800;",
    "  color: #39ff5a;",
    "  letter-spacing: -0.02em;",
    "  margin-bottom: 0.5rem;",
    "}",
    "",
    ".subtitle {",
    "  font-size: 0.875rem;",
    "  color: #8a9e8f;",
    "}",
    "",
    ".counter {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 1.5rem;",
    "}",
    "",
    ".counter button {",
    "  background: #111a14;",
    "  border: 1px solid #1e2e22;",
    "  color: #f0f4f1;",
    "  font-size: 1.5rem;",
    "  width: 48px;",
    "  height: 48px;",
    "  border-radius: 12px;",
    "  cursor: pointer;",
    "  transition: background 0.15s;",
    "}",
    "",
    ".counter button:hover { background: #1e2e22; }",
    "",
    ".count {",
    "  font-size: 2rem;",
    "  font-weight: 700;",
    "  font-variant-numeric: tabular-nums;",
    "  min-width: 3rem;",
    "  text-align: center;",
    "}",
    ""
  ].join("\n");
}

function buildTsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2020", useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext", skipLibCheck: true,
      moduleResolution: "bundler", allowImportingTsExtensions: true,
      resolveJsonModule: true, isolatedModules: true, noEmit: true,
      jsx: "react-jsx", strict: true, noUnusedLocals: true,
      noUnusedParameters: true, noFallthroughCasesInSwitch: true
    },
    include: ["src"],
    references: [{ path: "./tsconfig.node.json" }]
  }, null, 2);
}

function buildTsConfigNode() {
  return JSON.stringify({
    compilerOptions: {
      composite: true, skipLibCheck: true,
      module: "ESNext", moduleResolution: "bundler",
      allowSyntheticDefaultImports: true, strict: true
    },
    include: ["vite.config.ts"]
  }, null, 2);
}

function buildEslintConfig(hasTS) {
  var parser = hasTS ? "'@typescript-eslint/parser'" : "undefined";
  var plugins = hasTS
    ? "['react', 'react-hooks', 'react-refresh', '@typescript-eslint']"
    : "['react', 'react-hooks', 'react-refresh']";
  return [
    "module.exports = {",
    "  root: true,",
    "  env: { browser: true, es2020: true },",
    "  extends: ['eslint:recommended'],",
    "  ignorePatterns: ['dist'],",
    hasTS ? "  parser: '@typescript-eslint/parser'," : "",
    "  plugins: " + plugins + ",",
    "  rules: {",
    "    'react-hooks/rules-of-hooks': 'error',",
    "    'react-hooks/exhaustive-deps': 'warn',",
    "    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]",
    "  }",
    "};",
    ""
  ].filter(function(l) { return l !== ""; }).join("\n");
}

function buildTailwindConfig() {
  return [
    "/** @type {import('tailwindcss').Config} */",
    "export default {",
    "  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],",
    "  theme: { extend: {} },",
    "  plugins: []",
    "};",
    ""
  ].join("\n");
}

function buildPostCssConfig() {
  return "export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n";
}

function buildTailwindCss() {
  return "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n";
}

function buildJestConfig(hasTS) {
  if (hasTS) {
    return [
      "import type { Config } from 'jest';",
      "",
      "const config: Config = {",
      "  preset: 'ts-jest',",
      "  testEnvironment: 'jsdom',",
      "  setupFilesAfterFramework: ['@testing-library/jest-dom'],",
      "};",
      "",
      "export default config;",
      ""
    ].join("\n");
  }
  return [
    "export default {",
    "  testEnvironment: 'jsdom',",
    "  setupFilesAfterFramework: ['@testing-library/jest-dom'],",
    "  transform: { '^.+\\\\.(js|jsx)$': 'babel-jest' }",
    "};",
    ""
  ].join("\n");
}

function buildAppTest(name, hasTS) {
  var ext = hasTS ? "tsx" : "jsx";
  return [
    "import React from 'react';",
    "import { render, screen } from '@testing-library/react';",
    "import App from './App." + ext + "';",
    "",
    "test('renders app title', () => {",
    "  render(<App />);",
    "  expect(screen.getByText('" + name + "')).toBeInTheDocument();",
    "});",
    ""
  ].join("\n");
}

export var WEB_REACT_TEMPLATE = { meta: TEMPLATE_META, getFiles: getFiles };
export default WEB_REACT_TEMPLATE;