// The app imports framework-free code from ../shared (money, dates, the plan's maths, query keys),
// which lives outside this folder. Metro watches it, and resolves its imports from this app's own
// node_modules: shared/ imports no packages (shared/imports.test.ts), so nothing else is needed.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../shared')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
