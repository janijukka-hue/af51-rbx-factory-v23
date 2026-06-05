const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  'web.js',
  'web.jsx',
  'web.ts',
  'web.tsx',
  'js',
  'jsx',
  'ts',
  'tsx',
  'json'
];

module.exports = config;
