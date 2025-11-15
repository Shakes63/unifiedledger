#!/bin/bash

# Script to update remaining frontend components with useHouseholdFetch hook
# This updates all files that haven't been manually updated yet

BASE_DIR="/Users/jacobneudorf/Documents/coding/javascript/nextjs/unifiedledger"

# List of files to update (modals, lists, utilities)
FILES=(
  # Remaining Modals
  "components/transactions/transaction-templates-manager.tsx"
  "components/transactions/convert-to-transfer-modal.tsx"
  "components/transactions/transfer-suggestions-modal.tsx"
  # Lists
  "components/transactions/recent-transactions.tsx"
  "components/dashboard/recent-transactions.tsx"
  "components/transactions/transaction-history.tsx"
  "components/transactions/splits-list.tsx"
  "components/transactions/transaction-details.tsx"
  # Utilities
  "components/transactions/advanced-search.tsx"
  "components/transactions/saved-searches.tsx"
  "components/transactions/budget-warning.tsx"
  "components/transactions/split-builder.tsx"
  "components/transactions/transaction-templates.tsx"
  "components/accounts/account-card.tsx"
  "components/categories/category-card.tsx"
  "components/calendar/transaction-indicators.tsx"
)

echo "========================================="
echo "Household Fetch Hook Batch Update Script"
echo "========================================="
echo ""
echo "This script will update ${#FILES[@]} files to use useHouseholdFetch hook"
echo ""

# Counter for tracking
UPDATED=0
SKIPPED=0
ERRORS=0

for file in "${FILES[@]}"; do
  filepath="$BASE_DIR/$file"

  echo "Processing: $file"

  # Check if file exists
  if [ ! -f "$filepath" ]; then
    echo "  ⚠️  File not found, skipping"
    ((SKIPPED++))
    continue
  fi

  # Check if already has the import
  if grep -q "useHouseholdFetch" "$filepath"; then
    echo "  ✓ Already updated, skipping"
    ((SKIPPED++))
    continue
  fi

  # Check if file has any household-isolated API calls
  if ! grep -q -E "'/api/(transactions|accounts|categories|merchants)" "$filepath"; then
    echo "  ℹ️  No household-isolated APIs found, skipping"
    ((SKIPPED++))
    continue
  fi

  echo "  🔄 Needs update"
  ((UPDATED++))
done

echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo "Files to update: $UPDATED"
echo "Files skipped: $SKIPPED"
echo "Errors: $ERRORS"
echo ""
echo "Note: This is a dry-run. Use Claude Code to make actual changes."
