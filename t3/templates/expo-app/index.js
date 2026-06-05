// t3/templates/expo-app/index.js
// KERROS: T3 – Tuotanto
// Expo Managed Workflow -pohja, web-valmis.
// getFiles(params) palauttaa tiedostolistan — kirjoitus workspaceen tapahtuu TemplatePhase:ssa.

export var TEMPLATE_META = {
  id:          "expo-app",
  version:     "1.0.0",
  target:      "expo-app",
  stack:       "expo-managed",
  sdkVersion:  "51",
  description: "Expo Managed Workflow, web-valmis, React Navigation",
  minNode:     "18"
};

export function getFiles(params) {
  var p        = params   || {};
  var name     = p.name   || "MyApp";
  var features = Array.isArray(p.features) ? p.features : [];

  var hasTS     = features.indexOf("typescript")      !== -1;
  var hasNav    = features.indexOf("react-navigation") !== -1;
  var hasRouter = features.indexOf("expo-router")      !== -1;
  var hasZustand= features.indexOf("zustand")          !== -1;
  var hasJest   = features.indexOf("jest")             !== -1;
  var hasLint   = features.indexOf("eslint")           !== -1;

  var ext    = hasTS ? "tsx" : "jsx";
  var appExt = hasTS ? "tsx" : "js";

  var files = [];

  // ── package.json ─────────────────────────────────────────
  files.push({ path: "package.json", content: buildPackageJson(name, features, hasTS, hasNav, hasRouter, hasZustand, hasJest, hasLint) });

  // ── app.json ─────────────────────────────────────────────
  files.push({ path: "app.json", content: buildAppJson(name) });

  // ── babel.config.js ──────────────────────────────────────
  files.push({ path: "babel.config.js", content: "module.exports = function(api) {\n  api.cache(true);\n  return { presets: ['babel-preset-expo'] };\n};\n" });

  // ── index.js ─────────────────────────────────────────────
  files.push({ path: "index.js", content: "import 'expo/build/Expo.fx';\nimport { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n" });

  // ── App ──────────────────────────────────────────────────
  if (!hasRouter) {
    files.push({ path: "App." + appExt, content: buildApp(name, hasNav, hasTS) });
  }

  // ── tsconfig ─────────────────────────────────────────────
  if (hasTS) {
    files.push({ path: "tsconfig.json", content: JSON.stringify({ extends: "expo/tsconfig.base", compilerOptions: { strict: true } }, null, 2) });
  }

  // ── Navigaatio ───────────────────────────────────────────
  if (hasNav && !hasRouter) {
    files.push({ path: "src/navigation/RootNavigator." + ext, content: buildRootNavigator(hasTS) });
    files.push({ path: "src/screens/HomeScreen."     + ext, content: buildHomeScreen(name) });
  }

  // ── Expo Router ──────────────────────────────────────────
  if (hasRouter) {
    files.push({ path: "app/_layout." + ext, content: "import { Stack } from 'expo-router';\nexport default function RootLayout() { return <Stack />; }\n" });
    files.push({ path: "app/index."   + ext, content: buildRouterIndex(name) });
  }

  // ── Zustand ──────────────────────────────────────────────
  if (hasZustand) {
    files.push({ path: "src/store/appStore." + ext, content: buildZustandStore(hasTS) });
  }

  // ── .gitignore ───────────────────────────────────────────
  files.push({ path: ".gitignore", content: "node_modules/\n.expo/\ndist/\nweb-build/\n.env\n.env.local\n" });

  return files;
}

// ─── Sisältörakentajat ───────────────────────────────────────

function buildPackageJson(name, features, hasTS, hasNav, hasRouter, hasZustand, hasJest, hasLint) {
  var deps = {
    "expo":                          "~51.0.0",
    "expo-status-bar":               "~1.12.1",
    "react":                         "18.2.0",
    "react-native":                  "0.74.5",
    "react-native-safe-area-context":"4.10.5",
    "react-native-screens":          "~3.31.1"
  };
  if (hasNav) {
    deps["@react-navigation/native"]       = "^6.1.17";
    deps["@react-navigation/native-stack"] = "^6.9.26";
    deps["react-native-gesture-handler"]   = "~2.16.1";
  }
  if (hasRouter) deps["expo-router"] = "~3.5.14";
  if (hasZustand) deps["zustand"]    = "^4.5.2";

  var devDeps = {};
  if (hasTS)   { devDeps["typescript"] = "^5.3.3"; devDeps["@types/react"] = "~18.2.79"; }
  if (hasJest) { devDeps["jest"] = "^29.7.0"; devDeps["jest-expo"] = "~51.0.3"; devDeps["@testing-library/react-native"] = "^12.4.3"; }
  if (hasLint) { devDeps["eslint"] = "^8.57.0"; devDeps["eslint-plugin-react"] = "^7.34.1"; devDeps["eslint-plugin-react-hooks"] = "^4.6.2"; }

  var scripts = {
    "start":   "expo start",
    "android": "expo run:android",
    "ios":     "expo run:ios",
    "web":     "expo start --web",
    "export":  "expo export --platform web"
  };
  if (hasJest) scripts["test"] = "jest --passWithNoTests";
  if (hasLint) scripts["lint"] = "eslint src --ext .js,.jsx,.ts,.tsx";

  var pkg = {
    name:            name,
    version:         "1.0.0",
    main:            hasRouter ? "expo-router/entry" : "index.js",
    scripts:         scripts,
    dependencies:    deps,
    devDependencies: devDeps
  };
  if (hasJest) {
    pkg.jest = { preset: "jest-expo", transformIgnorePatterns: ["node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*)"] };
  }
  return JSON.stringify(pkg, null, 2);
}

function buildAppJson(name) {
  return JSON.stringify({
    expo: {
      name:        name,
      slug:        name.toLowerCase().replace(/\s+/g, "-"),
      version:     "1.0.0",
      orientation: "portrait",
      icon:        "./assets/icon.png",
      userInterfaceStyle: "light",
      assetBundlePatterns: ["**/*"],
      ios:     { supportsTablet: true },
      android: { adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#FFFFFF" } },
      web:     { favicon: "./assets/favicon.png", bundler: "metro" }
    }
  }, null, 2);
}

function buildApp(name, hasNav, hasTS) {
  var nav = hasNav
    ? "import { NavigationContainer } from '@react-navigation/native';\nimport { RootNavigator } from './src/navigation/RootNavigator';\n"
    : "";
  var body = hasNav
    ? "    <NavigationContainer>\n      <RootNavigator />\n    </NavigationContainer>"
    : "    <View style={styles.container}>\n      <Text style={styles.title}>" + name + "</Text>\n      <StatusBar style=\"auto\" />\n    </View>";
  return "import React from 'react';\nimport { StyleSheet, Text, View } from 'react-native';\nimport { StatusBar } from 'expo-status-bar';\n" + nav + "\nexport default function App()" + (hasTS ? ": React.FC" : "") + " {\n  return (\n" + body + "\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },\n  title: { fontSize: 24, fontWeight: '700' }\n});\n";
}

function buildRootNavigator(hasTS) {
  return "import React from 'react';\nimport { createNativeStackNavigator } from '@react-navigation/native-stack';\nimport { HomeScreen } from '../screens/HomeScreen';\nconst Stack = createNativeStackNavigator();\nexport " + (hasTS ? "const" : "function") + " RootNavigator" + (hasTS ? ": React.FC" : "") + " = () => (\n  <Stack.Navigator>\n    <Stack.Screen name=\"Home\" component={HomeScreen} />\n  </Stack.Navigator>\n);\n";
}

function buildHomeScreen(name) {
  return "import React from 'react';\nimport { View, Text, StyleSheet } from 'react-native';\nexport function HomeScreen() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.title}>Tervetuloa: " + name + "</Text>\n    </View>\n  );\n}\nconst styles = StyleSheet.create({\n  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },\n  title: { fontSize: 20, fontWeight: '600' }\n});\n";
}

function buildRouterIndex(name) {
  return "import { View, Text, StyleSheet } from 'react-native';\nexport default function HomeScreen() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.title}>" + name + "</Text>\n    </View>\n  );\n}\nconst styles = StyleSheet.create({\n  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },\n  title: { fontSize: 24, fontWeight: '700' }\n});\n";
}

function buildZustandStore(hasTS) {
  return "import { create } from 'zustand';\n" + (hasTS ? "interface AppState { count: number; increment: () => void; reset: () => void; }\n" : "") + "export const useAppStore = create" + (hasTS ? "<AppState>" : "") + "((set) => ({\n  count: 0,\n  increment: () => set((s) => ({ count: s.count + 1 })),\n  reset: () => set({ count: 0 })\n}));\n";
}

export var EXPO_APP_TEMPLATE = { meta: TEMPLATE_META, getFiles: getFiles };
export default EXPO_APP_TEMPLATE;