#!/bin/bash

# Script to add null checks for householdId after requireHouseholdAuth calls

FILES=$(find app/api -name "*.ts" -type f | xargs grep -l "await requireHouseholdAuth" | xargs grep -L "TypeScript: householdId is guaranteed")

for file in $FILES; do
  # Use perl to add null check after requireHouseholdAuth if not already present
  perl -i -pe 's/(await requireHouseholdAuth\([^)]+\);)\s*\n(\s*)(?!\/\/ TypeScript: householdId|if \(!householdId\))/$1\n$2\/\/ TypeScript: householdId is guaranteed to be non-null after requireHouseholdAuth\n$2if (!householdId) {\n$2  return Response.json(\n$2    { error: '\''Household ID is required'\'' },\n$2    { status: 400 }\n$2  );\n$2}\n$2/g' "$file"
  echo "Fixed: $file"
done

echo "Done!"

