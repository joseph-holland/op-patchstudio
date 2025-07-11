#!/usr/bin/env node

/**
 * Version Update Script
 * 
 * Usage:
 * npm run update-version -- patch    # Increment patch version (0.7.0 -> 0.7.1)
 * npm run update-version -- minor    # Increment minor version (0.7.0 -> 0.8.0)
 * npm run update-version -- major    # Increment major version (0.7.0 -> 1.0.0)
 */

import fs from 'fs';
import path from 'path';
import semver from 'semver';

const args = process.argv.slice(2);
const updateType = args[0];

if (!updateType || !['patch', 'minor', 'major'].includes(updateType)) {
  console.error('Usage: npm run update-version -- [patch|minor|major]');
  process.exit(1);
}

// Read current version from package.json
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Validate current version using semver
if (!semver.valid(currentVersion)) {
  console.error(`❌ Invalid version format: ${currentVersion}`);
  console.error('Version must follow semantic versioning (e.g., 1.2.3)');
  process.exit(1);
}

// Calculate new version using semver
let newVersion;
switch (updateType) {
  case 'patch':
    newVersion = semver.inc(currentVersion, 'patch');
    break;
  case 'minor':
    newVersion = semver.inc(currentVersion, 'minor');
    break;
  case 'major':
    newVersion = semver.inc(currentVersion, 'major');
    break;
}

if (!newVersion) {
  console.error('❌ Failed to increment version');
  process.exit(1);
}

console.log(`Updating version from ${currentVersion} to ${newVersion}...`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Update manifest.json
const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = newVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// Get today's date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0];

console.log('✅ Version updated successfully!');
console.log('');
console.log('📝 Remember to:');
console.log('1. Update CHANGELOG.md with your changes');
console.log(`2. Add today's date (${today}) to new version entries`);
console.log('3. Run: cp CHANGELOG.md public/CHANGELOG.md');
console.log('4. Commit your changes'); 