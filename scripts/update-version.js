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
import readline from 'readline';

const args = process.argv.slice(2);
const updateType = args[0];

if (!updateType || !['patch', 'minor', 'major'].includes(updateType)) {
  console.error('Usage: npm run update-version -- [patch|minor|major]');
  process.exit(1);
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

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

// Update CHANGELOG.md
const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
let changelogContent = fs.readFileSync(changelogPath, 'utf8');

// Check if [Unreleased] section exists
if (!changelogContent.includes('## [Unreleased]')) {
  console.error('❌ CHANGELOG.md must have an [Unreleased] section');
  process.exit(1);
}

// Collect changes from user
console.log('\n📝 Please describe your changes for the new version:');
console.log('(Press Enter twice to finish each section, or just Enter to skip)');

const added = [];
const changed = [];
const fixed = [];

console.log('\n### Added (new features):');
while (true) {
  const line = await question('  - ');
  if (line.trim() === '') break;
  added.push(line.trim());
}

console.log('\n### Changed (existing functionality):');
while (true) {
  const line = await question('  - ');
  if (line.trim() === '') break;
  changed.push(line.trim());
}

console.log('\n### Fixed (bug fixes):');
while (true) {
  const line = await question('  - ');
  if (line.trim() === '') break;
  fixed.push(line.trim());
}

// Build the new version entry
let newVersionEntry = `## [${newVersion}] - ${today}\n\n`;

if (added.length > 0) {
  newVersionEntry += '### Added\n';
  added.forEach(item => {
    newVersionEntry += `- ${item}\n`;
  });
  newVersionEntry += '\n';
}

if (changed.length > 0) {
  newVersionEntry += '### Changed\n';
  changed.forEach(item => {
    newVersionEntry += `- ${item}\n`;
  });
  newVersionEntry += '\n';
}

if (fixed.length > 0) {
  newVersionEntry += '### Fixed\n';
  fixed.forEach(item => {
    newVersionEntry += `- ${item}\n`;
  });
  newVersionEntry += '\n';
}

// Replace [Unreleased] with the new version entry
changelogContent = changelogContent.replace(
  '## [Unreleased]',
  `## [Unreleased]\n\n### Added\n- N/A\n\n### Changed\n- N/A\n\n### Fixed\n- N/A\n\n${newVersionEntry}`
);

// Write updated CHANGELOG.md
fs.writeFileSync(changelogPath, changelogContent);

// Copy CHANGELOG.md to public directory
const publicChangelogPath = path.join(process.cwd(), 'public', 'CHANGELOG.md');
fs.copyFileSync(changelogPath, publicChangelogPath);

// Close readline interface
rl.close();

console.log('\n✅ Version updated successfully!');
console.log(`📝 CHANGELOG.md updated with version ${newVersion}`);
console.log('📋 CHANGELOG.md copied to public/CHANGELOG.md');
console.log('');
console.log('🚀 Next steps:');
console.log('1. Review the changes in CHANGELOG.md');
console.log('2. Commit your changes');
console.log('3. Tag the release if needed'); 