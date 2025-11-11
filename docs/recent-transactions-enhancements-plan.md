# Recent Transactions Component Enhancements

## Objective
Enhance the RecentTransactions component with:
1. Scrollable view showing up to 50 transactions (currently shows only 5)
2. Account filtering to view transactions from specific bank accounts

## Current State
**File:** `components/dashboard/recent-transactions.tsx`
**Current behavior:**
- Fetches only 5 transactions (`/api/transactions?limit=5`)
- No scrolling (just shows 5 items in a column)
- No filtering capability
- Has "View All Transactions" button at bottom

## Proposed Enhancements

### Feature 1: Scrollable View with 50 Transactions ✅

**Changes needed:**
1. Update API call from `limit=5` to `limit=50`
2. Add max-height with vertical scroll to transaction list container
3. Add scroll indicators or shadow effects for better UX
4. Keep loading states and empty states
5. Maintain "View All" button at bottom (outside scroll area)

**Design specs:**
- Max height: `max-h-[600px]` (approximately 8-10 transactions visible)
- Overflow: `overflow-y-auto`
- Smooth scrolling: `scroll-smooth`
- Custom scrollbar styling for theme compatibility
- Optional: Fade effect at top/bottom to indicate scrollable content

### Feature 2: Account Filtering ✅

**Changes needed:**
1. Fetch all accounts for filter dropdown
2. Add account selector above transaction list (similar to CompactStatsBar design)
3. Filter transactions client-side by selected account
4. Add "All Accounts" option (default)
5. Show account color indicator in selector
6. Persist filter selection in component state (not localStorage - session only)

**UI Design:**
- Position: Above transaction list, below "Recent Transactions" header
- Layout: Flex row with label + Select dropdown
- Select options: "All Accounts" + individual accounts with color dots
- Compact design to not take too much vertical space

**Filter logic:**
- When "All Accounts" selected: Show all 50 transactions
- When specific account selected: Filter to transactions where `accountId === selectedAccountId`
- For transfers (transfer_out/transfer_in), show if either source or destination matches

## Implementation Tasks

### Task 1: Update API Call and Add Scrollable Container ✅
**File:** `components/dashboard/recent-transactions.tsx`

**Changes:**
1. Change API call from `limit=5` to `limit=50`
2. Wrap transaction list in scrollable container:
   ```tsx
   <div className="space-y-2 max-h-[600px] overflow-y-auto scroll-smooth">
     {/* transaction cards */}
   </div>
   ```
3. Add custom scrollbar styling (use theme variables)
4. Keep "View All Transactions" button outside scroll container
5. Test with 0, 5, 20, 50 transactions to verify scroll behavior

### Task 2: Add Account Filtering UI ✅
**File:** `components/dashboard/recent-transactions.tsx`

**Changes:**
1. Import Select components (already imported in dashboard page)
2. Add state: `const [selectedAccountId, setSelectedAccountId] = useState<string>('all')`
3. Fetch accounts in existing useEffect (accounts API call)
4. Add filter UI above transaction list:
   ```tsx
   <div className="flex items-center justify-between mb-4">
     <div className="flex items-center gap-3">
       <span className="text-sm text-muted-foreground">Filter:</span>
       <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
         <SelectTrigger className="w-[200px]">
           <SelectValue />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="all">All Accounts</SelectItem>
           {accounts.map(account => (
             <SelectItem key={account.id} value={account.id}>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full" style={{backgroundColor: account.color}} />
                 {account.name}
               </div>
             </SelectItem>
           ))}
         </SelectContent>
       </Select>
     </div>
   </div>
   ```

### Task 3: Implement Filter Logic ✅
**File:** `components/dashboard/recent-transactions.tsx`

**Changes:**
1. Create filtered transactions array based on selectedAccountId:
   ```tsx
   const filteredTransactions = selectedAccountId === 'all'
     ? transactions
     : transactions.filter(tx => {
         // For regular transactions
         if (tx.type !== 'transfer_out' && tx.type !== 'transfer_in') {
           return tx.accountId === selectedAccountId;
         }
         // For transfers, show if either source or destination matches
         // transfer_out: accountId is source, transferId is destination account
         // transfer_in: accountId is destination, merchantId is source (for converted)
         if (tx.type === 'transfer_out') {
           return tx.accountId === selectedAccountId || tx.transferId === selectedAccountId;
         }
         if (tx.type === 'transfer_in') {
           return tx.accountId === selectedAccountId || tx.merchantId === selectedAccountId;
         }
         return false;
       });
   ```
2. Update map to use `filteredTransactions` instead of `transactions`
3. Update empty state to handle filtered results (show different message)

### Task 4: Update Parent Component (Dashboard) ✅
**File:** `app/dashboard/page.tsx`

**Changes:**
- Update the header section to accommodate potential filter UI
- Ensure proper spacing between elements
- No major changes needed (RecentTransactions is self-contained)

### Task 5: Testing & Polish ✅

**Test scenarios:**
1. Load with 0 transactions (empty state)
2. Load with 5 transactions (no scroll needed)
3. Load with 20+ transactions (scroll should appear)
4. Load with 50 transactions (full scroll)
5. Filter by each account (verify correct transactions shown)
6. Filter to account with 0 transactions (show empty state)
7. Switch between "All Accounts" and specific accounts
8. Test transfer transactions appear in correct accounts
9. Mobile responsiveness (Select dropdown, scroll on small screens)
10. Theme compatibility (Dark Mode + Dark Pink Theme)

### Task 6: Documentation Update ✅

**Files to update:**
- `docs/features.md` - Mark features as complete
- `.claude/CLAUDE.md` - Add to Recent Updates section

## Design System Compliance

**Colors:**
- Scrollbar track: `var(--color-muted)`
- Scrollbar thumb: `var(--color-border)`
- Scrollbar thumb hover: `var(--color-foreground)`
- Filter label: `text-muted-foreground`
- Select background: `var(--color-elevated)`
- Select border: `var(--color-border)`

**Spacing:**
- Filter section margin bottom: `mb-4`
- Scroll container max height: `max-h-[600px]`
- Transaction card spacing: `space-y-2` (existing)

**Typography:**
- Filter label: `text-sm`
- Select trigger: Default size
- Use existing transaction card typography

**Custom Scrollbar CSS:**
```css
/* Add to component styles or globals.css */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: var(--color-muted);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--color-foreground);
}
```

## Success Criteria

1. ✅ Component loads 50 transactions instead of 5
2. ✅ Scroll appears when transactions exceed visible area (~8-10 items)
3. ✅ Scrollbar is styled consistently with theme
4. ✅ Account filter dropdown works correctly
5. ✅ Filtering updates transaction list in real-time
6. ✅ Transfer transactions appear in both source and destination account filters
7. ✅ Empty state shows when filter returns 0 results
8. ✅ Mobile responsive (filter and scroll work on small screens)
9. ✅ Build successful with zero TypeScript errors
10. ✅ Both Dark Mode and Dark Pink Theme supported

## Performance Considerations

- Fetching 50 transactions is reasonable (API already handles this well)
- Client-side filtering is fast for 50 items (no performance concerns)
- Consider adding React.memo if re-renders become an issue
- Scroll performance should be native and smooth

## Timeline Estimate

- Task 1 (Scrollable container): ~15 minutes
- Task 2 (Filter UI): ~20 minutes
- Task 3 (Filter logic): ~15 minutes
- Task 4 (Parent updates): ~5 minutes
- Task 5 (Testing): ~20 minutes
- Task 6 (Documentation): ~10 minutes

**Total: ~1.5 hours**

## Notes

- Keep existing "Repeat Transaction" button functionality
- Maintain existing merchant/description display logic
- Keep existing category badges and split indicators
- Don't change the "View All Transactions" link (still goes to /dashboard/transactions)
- Account filter is session-only (doesn't persist on page reload)
- If user wants persistence, we can add localStorage later
