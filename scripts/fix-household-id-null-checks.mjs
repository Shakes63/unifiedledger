#!/usr/bin/env node

/**
 * Script to add null checks for householdId after requireHouseholdAuth calls
 * This fixes TypeScript errors where householdId might be null
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('app/api/**/*.ts');

let fixedCount = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  let modified = false;

  // Pattern 1: After requireHouseholdAuth, before using householdId in eq()
  // Match: await requireHouseholdAuth(...);\n    [something using householdId]
  const pattern1 = /await requireHouseholdAuth\([^)]+\);\s*\n(\s*)(?!if \(!householdId\))/g;
  
  if (pattern1.test(content)) {
    // Reset regex
    pattern1.lastIndex = 0;
    
    // Find all matches and add null check
    content = content.replace(
      /(await requireHouseholdAuth\([^)]+\);)\s*\n(\s*)(?!\/\/ TypeScript: householdId|if \(!householdId\))/g,
      (match, authCall, indent) => {
        modified = true;
        return `${authCall}\n${indent}// TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth\n${indent}if (!householdId) {\n${indent}  return Response.json(\n${indent}    { error: 'Household ID is required' },\n${indent}    { status: 400 }\n${indent}  );\n${indent}}\n${indent}`;
      }
    );
  }

  // Pattern 2: Remove non-null assertions (householdId!)
  if (content.includes('householdId!')) {
    content = content.replace(/householdId!/g, 'householdId');
    modified = true;
  }

  if (modified) {
    writeFileSync(file, content, 'utf-8');
    fixedCount++;
    console.log(`Fixed: ${file}`);
  }
}

console.log(`\nFixed ${fixedCount} files`);

