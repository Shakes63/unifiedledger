'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          aria-expanded={isExpanded}
          aria-label="Toggle report filters"
        >
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold text-foreground">Report Filters</CardTitle>
            {activeFilterCount > 0 && (
              <Badge
                variant="default"
                className="bg-primary text-primary-foreground"
              >
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Accounts Filter */}
          <div className="space-y-2">
            <label htmlFor="accounts-filter" className="text-sm font-medium text-foreground">
              Accounts
            </label>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
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
                    <Badge
                      key={account.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-elevated text-muted-foreground border-border hover:bg-elevated'
                      }`}
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
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Categories Filter */}
          <div className="space-y-2">
            <label htmlFor="categories-filter" className="text-sm font-medium text-foreground">
              Categories
            </label>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
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
                    <Badge
                      key={category.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-elevated text-muted-foreground border-border hover:bg-elevated'
                      }`}
                      onClick={() => handleCategoryToggle(category.id)}
                      role="button"
                      tabIndex={0}
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
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Merchants Filter */}
          <div className="space-y-2">
            <label htmlFor="merchants-filter" className="text-sm font-medium text-foreground">
              Merchants
            </label>
            {merchants.length === 0 ? (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
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
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-elevated text-muted-foreground border-border hover:bg-elevated'
                      }`}
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
            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="text-muted-foreground border-border hover:bg-elevated"
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

