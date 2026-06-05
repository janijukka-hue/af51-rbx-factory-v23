// t3/.eslintrc.js
// T3 Factory Engine pyörii Node.js-prosessissa — ei Expo-bundlessa.
// Tämä override sallii Node-buildinit (fs, path, crypto, child_process)
// kaikissa t3/-hakemiston tiedostoissa.

module.exports = {
  env: {
    node:    true,
    es2022:  true,
    browser: false
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType:  "module"
  },
  rules: {
    // Node built-init sallittu — T3 ei aja Expo-bundlessa
    "import/no-extraneous-dependencies": [
      "error",
      {
        // node: -prefix buildinit ovat aina ok
        "bundledDependencies": false,
        "allowModules": [
          "node:fs",
          "node:path",
          "node:crypto",
          "node:child_process",
          "node:os",
          "node:stream",
          "node:util",
          "node:buffer",
          "fs",
          "path",
          "crypto",
          "child_process",
          "os",
          "stream",
          "util",
          "buffer"
        ]
      }
    ]
  }
};