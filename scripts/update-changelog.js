#!/usr/bin/env node

/**
 * Changelog Update Helper Script
 * 
 * Usage:
 * npm run update-changelog -- 0.8.0 "New feature description"
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const version = args[0];
const description = args[1];

if (!version) {
  console.error('Usage: npm run update-changelog -- [version] [description]');
  console.error('Example: npm run update-changelog -- 0.8.0 "New features and bug fixes"');
  process.exit(1);
}

// Get today's date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0];

// Read current changelog
const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf8');

// Check if version already exists
if (changelog.includes(`## [${version}]`)) {
  console.error(`Version ${version} already exists in CHANGELOG.md`);
  process.exit(1);
}

// Find the [Unreleased] section and replace it with the new version
const unreleasedPattern = /## \[Unreleased\]/;
const newVersionEntry = `## [${version}] - ${today}
${description ? `\n${description}\n` : ''}

### Added
- N/A

### Changed
- N/A

### Fixed
- N/A

## [Unreleased]`;

if (changelog.includes('[Unreleased]')) {
  changelog = changelog.replace(unreleasedPattern, newVersionEntry);
} else {
  // If no [Unreleased] section, add it at the top after the header
  const headerEnd = changelog.indexOf('\n\n## [');
  if (headerEnd !== -1) {
    const beforeVersions = changelog.substring(0, headerEnd);
    const versions = changelog.substring(headerEnd);
    changelog = beforeVersions + '\n\n' + newVersionEntry + versions;
  } else {
    // Fallback: add at the end
    changelog += '\n\n' + newVersionEntry;
  }
}

// Write updated changelog
fs.writeFileSync(changelogPath, changelog);

console.log(`✅ Updated CHANGELOG.md with version ${version} (${today})`);
console.log('');
console.log('📝 Next steps:');
console.log('1. Edit the changelog entry to add your specific changes');
console.log('2. Run: cp CHANGELOG.md public/CHANGELOG.md');
console.log('3. Commit your changes'); 