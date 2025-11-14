#!/bin/bash

# Script to add credentials: 'include' to fetch calls to /api endpoints
# This fixes authentication issues with Better Auth cookie-based sessions

echo "Fixing fetch calls to include credentials..."

# Find all TypeScript/TSX files and fix fetch patterns
find app components contexts hooks lib -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  # Check if file contains fetch('/api without credentials
  if grep -q "fetch(['\"\`]/api" "$file" && ! grep -q "credentials: 'include'" "$file"; then
    echo "Processing: $file"

    # Pattern 1: fetch('/api...') -> fetch('/api...', { credentials: 'include' })
    sed -i.bak -E "s/fetch\((['\"\`]\/api[^'\"\`]*['\"\`])\)/fetch(\1, { credentials: 'include' })/g" "$file"

    # Remove backup file
    rm -f "${file}.bak"
  fi
done

echo "✅ Done! Please review changes and test."
