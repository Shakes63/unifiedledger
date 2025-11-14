#!/usr/bin/env node

/**
 * Script to add credentials: 'include' to all fetch calls to /api endpoints
 * This is required for Better Auth cookie-based authentication
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Pattern to match fetch calls to /api endpoints
const patterns = [
  // fetch('/api...') with no options
  /fetch\((['"`])\/api([^'"`]*)\1\)/g,
  // fetch("/api...") with no options
  /fetch\((['"`])\/api([^'"`]*)\1\)/g,
  // fetch(`/api...`) with no options
  /fetch\((['"`])\/api([^'"`]*)\1\)/g,
];

// Pattern to match fetch calls that already have credentials
const hasCredentialsPattern = /credentials:\s*['"`]include['"`]/;

function fixFetchCalls(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file already imports credentials or has the pattern
  if (hasCredentialsPattern.test(content)) {
    // File already has some credentials set, need to check each fetch individually
  }

  // Find all fetch calls to /api
  const fetchMatches = content.matchAll(/fetch\(\s*(['"`])\/api[^)]*\)/gs);

  for (const match of fetchMatches) {
    const fullMatch = match[0];

    // Skip if this fetch call already has credentials
    if (fullMatch.includes('credentials')) {
      continue;
    }

    // Determine if fetch has options object
    const hasOptions = fullMatch.includes(',');

    let replacement;
    if (hasOptions) {
      // Has options object, add credentials to it
      // Extract the URL and options
      const urlMatch = fullMatch.match(/fetch\(\s*(['"`])([^'"`]+)\1\s*,\s*(\{[\s\S]*\})\s*\)/);
      if (urlMatch) {
        const quote = urlMatch[1];
        const url = urlMatch[2];
        const options = urlMatch[3];

        // Add credentials to the options object
        // Handle both { method: 'POST' } and {method:'POST'} formats
        const trimmedOptions = options.trim();
        if (trimmedOptions === '{}') {
          replacement = `fetch(${quote}${url}${quote}, { credentials: 'include' })`;
        } else {
          // Add credentials as first property
          const optionsContent = trimmedOptions.slice(1, -1); // Remove { }
          replacement = `fetch(${quote}${url}${quote}, { credentials: 'include', ${optionsContent} })`;
        }
      }
    } else {
      // No options, add credentials object
      const urlMatch = fullMatch.match(/fetch\(\s*(['"`])([^'"`]+)\1\s*\)/);
      if (urlMatch) {
        const quote = urlMatch[1];
        const url = urlMatch[2];
        replacement = `fetch(${quote}${url}${quote}, { credentials: 'include' })`;
      }
    }

    if (replacement) {
      content = content.replace(fullMatch, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

// Find all TypeScript/JavaScript files
const files = [
  ...glob.sync('app/**/*.{ts,tsx}', { cwd: process.cwd() }),
  ...glob.sync('components/**/*.{ts,tsx}', { cwd: process.cwd() }),
  ...glob.sync('contexts/**/*.{ts,tsx}', { cwd: process.cwd() }),
  ...glob.sync('hooks/**/*.{ts,tsx}', { cwd: process.cwd() }),
  ...glob.sync('lib/**/*.{ts,tsx}', { cwd: process.cwd() }),
];

console.log(`Scanning ${files.length} files...`);

let fixedCount = 0;
for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (fixFetchCalls(filePath)) {
    fixedCount++;
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);
