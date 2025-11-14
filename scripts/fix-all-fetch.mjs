#!/usr/bin/env node

/**
 * Comprehensive script to add credentials: 'include' to ALL fetch calls to /api endpoints
 * Handles both simple and complex cases
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      // Skip node_modules and .next directories
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist') {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

function fixFetchInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let changesMade = 0;

  // Pattern 1: Simple fetch with just URL, no options
  // fetch('/api/...') or fetch("/api/...") or fetch(`/api/...`)
  const simplePattern = /fetch\(\s*(['"`])(\/api[^'"`]*)\1\s*\)/g;

  content = content.replace(simplePattern, (match, quote, url) => {
    // Double-check it doesn't already have credentials (defensive)
    if (!match.includes('credentials')) {
      changesMade++;
      return `fetch(${quote}${url}${quote}, { credentials: 'include' })`;
    }
    return match;
  });

  // Pattern 2: fetch with existing options object but no credentials
  // fetch('/api/...', { ... }) -> fetch('/api/...', { credentials: 'include', ... })
  const optionsPattern = /fetch\(\s*(['"`])(\/api[^'"`]*)\1\s*,\s*\{([^}]*)\}\s*\)/g;

  content = content.replace(optionsPattern, (match, quote, url, options) => {
    // Check if credentials already in options
    if (options.includes('credentials')) {
      return match;
    }

    const trimmedOptions = options.trim();
    if (!trimmedOptions) {
      // Empty options object
      changesMade++;
      return `fetch(${quote}${url}${quote}, { credentials: 'include' })`;
    } else {
      // Has existing options, add credentials as first property
      changesMade++;
      return `fetch(${quote}${url}${quote}, { credentials: 'include', ${trimmedOptions} })`;
    }
  });

  // Only write if changes were made
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed ${changesMade} fetch call(s) in: ${path.relative(rootDir, filePath)}`);
    return changesMade;
  }

  return 0;
}

function main() {
  console.log('🔍 Scanning for files with fetch calls to /api endpoints...\n');

  const directories = ['app', 'components', 'contexts', 'hooks', 'lib'];
  let allFiles = [];

  for (const dir of directories) {
    const dirPath = path.join(rootDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = getAllFiles(dirPath);
      allFiles = [...allFiles, ...files];
    }
  }

  console.log(`Found ${allFiles.length} files to scan\n`);

  let totalChanges = 0;
  let filesModified = 0;

  for (const filePath of allFiles) {
    // Quick check if file contains fetch and /api
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('fetch(') && content.includes('/api')) {
      const changes = fixFetchInFile(filePath);
      if (changes > 0) {
        totalChanges += changes;
        filesModified++;
      }
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Total fetch calls fixed: ${totalChanges}`);

  if (filesModified > 0) {
    console.log(`\n⚠️  Please review the changes and test thoroughly!`);
  }
}

main();
