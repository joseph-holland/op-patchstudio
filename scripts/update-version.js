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
import { execSync } from 'child_process';

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

// Regenerate package-lock.json to ensure version consistency
console.log('🔄 Regenerating package-lock.json...');
try {
  execSync('npm install --package-lock-only', { stdio: 'inherit' });
  console.log('✅ package-lock.json regenerated');
} catch (error) {
  console.warn('⚠️  Failed to regenerate package-lock.json, but continuing...');
  console.warn('   You may want to run "npm install" manually to update it');
}

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

// Create a simple new version entry with placeholder content
const newVersionEntry = `## [${newVersion}] - ${today}

### Added
- N/A

### Changed
- N/A

### Fixed
- N/A

`;

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

console.log('\n✅ Version updated successfully!');
console.log(`📦 package.json updated to version ${newVersion}`);
console.log(`📋 manifest.json updated to version ${newVersion}`);
console.log(`📝 CHANGELOG.md updated with version ${newVersion}`);
console.log('📋 CHANGELOG.md copied to public/CHANGELOG.md');
console.log('');
console.log('🚀 Next steps:');
console.log('1. Review and update the changes in CHANGELOG.md');
console.log('2. Commit your changes');
console.log('3. Tag the release if needed'); 