'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface ReportFiltersProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; type: string }>;
  merchants: Array<{ id: string; name: string }>;
  selectedAccountIds: string[];
  selectedCategoryIds: string[];
  selectedMerchantIds: string[];
  onAccountChange: (accountIds: string[]) => void;
  onCategoryChange: (categoryIds: string[]) => void;
  onMerchantChange: (merchantIds: string[]) => void;
  onClearFilters: () => void;
}

/**
 * ReportFilters Component
 * Multi-select filter panel for accounts, categories, and merchants
 */
export function ReportFilters({
  accounts,
  categories,
  merchants,
  selectedAccountIds,
  selectedCategoryIds,
  selectedMerchantIds,
  onAccountChange,
  onCategoryChange,
  onMerchantChange,
  onClearFilters,
}: ReportFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate active filter count
  const activeFilterCount =
    selectedAccountIds.length + selectedCategoryIds.length + selectedMerchantIds.length;

  // Toggle functions
  const handleAccountToggle = (accountId: string) => {
    const newAccounts = new Set(selectedAccountIds);
    if (newAccounts.has(accountId)) {
      newAccounts.delete(accountId);
    } else {
      newAccounts.add(accountId);
    }
    onAccountChange(Array.from(newAccounts));
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = new Set(selectedCategoryIds);
    if (newCategories.has(categoryId)) {
      newCategories.delete(categoryId);
    } else {
      newCategories.add(categoryId);
    }
    onCategoryChange(Array.from(newCategories));
  };

  const handleMerchantToggle = (merchantId: string) => {
    const newMerchants = new Set(selectedMerchantIds);
    if (newMerchants.has(merchantId)) {
      newMerchants.delete(merchantId);
    } else {
      newMerchants.add(merchantId);
    }
    onMerchantChange(Array.from(newMerchants));
  };

  return (
    <Card className="border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          aria-expanded={isExpanded}
          aria-label="Toggle report filters"
        >
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>Report Filters</CardTitle>
            {activeFilterCount > 0 && (
              <span
                className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-md"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                {activeFilterCount}
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
          )}
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Accounts Filter */}
          <div className="space-y-2">
            <label htmlFor="accounts-filter" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
              Accounts
            </label>
            {accounts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }} role="status" aria-live="polite">
                No accounts available
              </p>
            ) : (
              <div
                id="accounts-filter"
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter by accounts"
              >
                {accounts.map((account) => {
                  const isSelected = selectedAccountIds.includes(account.id);
                  return (
                    <span
                      key={account.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-colors inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border"
                      style={
                        isSelected
                          ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)', borderColor: 'var(--color-primary)' }
                          : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }
                      }
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                      onClick={() => handleAccountToggle(account.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAccountToggle(account.id);
                        }
                      }}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Remove' : 'Add'} ${account.name} filter`}
                    >
                      {account.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Categories Filter */}
          <div className="space-y-2">
            <label htmlFor="categories-filter" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
              Categories
            </label>
            {categories.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }} role="status" aria-live="polite">
                No categories available
              </p>
            ) : (
              <div
                id="categories-filter"
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter by categories"
              >
                {categories.map((category) => {
                  const isSelected = selectedCategoryIds.includes(category.id);
                  return (
                    <span
                      key={category.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition-colors inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border"
                      style={
                        isSelected
                          ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)', borderColor: 'var(--color-primary)' }
                          : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }
                      }
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                      onClick={() => handleCategoryToggle(category.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCategoryToggle(category.id);
                        }
                      }}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Remove' : 'Add'} ${category.name} filter`}
                    >
                      {category.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Merchants Filter */}
          <div className="space-y-2">
            <label htmlFor="merchants-filter" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
              Merchants
            </label>
            {merchants.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }} role="status" aria-live="polite">
                No merchants available
              </p>
            ) : (
              <div
                id="merchants-filter"
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter by merchants"
              >
                {merchants.map((merchant) => {
                  const isSelected = selectedMerchantIds.includes(merchant.id);
                  return (
                    <Badge
                      key={merchant.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer transition-colors ${!isSelected ? 'hover:bg-[var(--color-elevated)]' : ''}`}
                      style={
                        isSelected
                          ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)', borderColor: 'var(--color-primary)' }
                          : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }
                      }
                      onClick={() => handleMerchantToggle(merchant.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleMerchantToggle(merchant.id);
                        }
                      }}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Remove' : 'Add'} ${merchant.name} filter`}
                    >
                      {merchant.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clear Filters Button */}
          {activeFilterCount > 0 && (
            <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                style={{ color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X className="w-4 h-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

