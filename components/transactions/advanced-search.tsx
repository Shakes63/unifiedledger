'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { SavedSearches } from './saved-searches';
import { ChevronDown, Save } from 'lucide-react';
import { FeatureGate } from '@/components/experimental/feature-gate';
import { ExperimentalBadge } from '@/components/experimental/experimental-badge';
import { toast } from 'sonner';
interface SearchFilters {
  query?: string;
  categoryIds?: string[];
  accountIds?: string[];
  tagIds?: string[];
  types?: string[];
  amountMin?: number;
  amountMax?: number;
  dateStart?: string;
  dateEnd?: string;
  isPending?: boolean;
  isSplit?: boolean;
  hasNotes?: boolean;
  sortBy?: 'date' | 'amount' | 'description';
  sortOrder?: 'asc' | 'desc';
  [key: string]: unknown; // Allow index access for compatibility with SavedSearches
}

interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface AdvancedSearchProps {
  categories: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string }>;
  tags?: Array<Tag>;
  onSearch: (filters: SearchFilters) => void;
  onClear?: () => void;
  isLoading?: boolean;
  initialFilters?: SearchFilters;
}

export function AdvancedSearch({
  categories,
  accounts,
  tags = [],
  onSearch,
  onClear,
  isLoading = false,
  initialFilters,
}: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'date',
    sortOrder: 'desc',
    ...initialFilters,
  });

  const [amountRange, setAmountRange] = useState<[number, number]>([0, 10000]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(initialFilters?.categoryIds || [])
  );
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(
    new Set(initialFilters?.accountIds || [])
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(initialFilters?.tagIds || [])
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(initialFilters?.types || [])
  );
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);

  // Update filters when initialFilters change
  useEffect(() => {
    if (initialFilters) {
      setFilters(prev => ({ ...prev, ...initialFilters }));
      setSelectedCategories(new Set(initialFilters.categoryIds || []));
      setSelectedAccounts(new Set(initialFilters.accountIds || []));
      setSelectedTags(new Set(initialFilters.tagIds || []));
      setSelectedTypes(new Set(initialFilters.types || []));
    }
  }, [initialFilters]);

  const transactionTypes = [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' },
  ];

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(categoryId)) {
      newCategories.delete(categoryId);
    } else {
      newCategories.add(categoryId);
    }
    setSelectedCategories(newCategories);
    setFilters({
      ...filters,
      categoryIds: Array.from(newCategories),
    });
  };

  const handleAccountToggle = (accountId: string) => {
    const newAccounts = new Set(selectedAccounts);
    if (newAccounts.has(accountId)) {
      newAccounts.delete(accountId);
    } else {
      newAccounts.add(accountId);
    }
    setSelectedAccounts(newAccounts);
    setFilters({
      ...filters,
      accountIds: Array.from(newAccounts),
    });
  };

  const handleTagToggle = (tagId: string) => {
    const newTags = new Set(selectedTags);
    if (newTags.has(tagId)) {
      newTags.delete(tagId);
    } else {
      newTags.add(tagId);
    }
    setSelectedTags(newTags);
    setFilters({
      ...filters,
      tagIds: Array.from(newTags),
    });
  };

  const handleTypeToggle = (type: string) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
    setFilters({
      ...filters,
      types: Array.from(newTypes),
    });
  };

  const handleAmountChange = (value: number[]) => {
    setAmountRange([value[0], value[1]]);
    setFilters({
      ...filters,
      amountMin: value[0],
      amountMax: value[1],
    });
  };

  const handleClearFilters = () => {
    setFilters({
      sortBy: 'date',
      sortOrder: 'desc',
    });
    setAmountRange([0, 10000]);
    setSelectedCategories(new Set());
    setSelectedAccounts(new Set());
    setSelectedTags(new Set());
    setSelectedTypes(new Set());
    
    // Notify parent to reload all transactions
    onClear?.();
  };

  const handleLoadSavedSearch = (savedFilters: SearchFilters) => {
    // Load filters from saved search
    setFilters({
      ...savedFilters,
      sortBy: savedFilters.sortBy || 'date',
      sortOrder: savedFilters.sortOrder || 'desc',
    });

    // Update UI state
    setSelectedCategories(
      new Set(savedFilters.categoryIds || [])
    );
    setSelectedAccounts(
      new Set(savedFilters.accountIds || [])
    );
    setSelectedTags(
      new Set(savedFilters.tagIds || [])
    );
    setSelectedTypes(
      new Set(savedFilters.types || [])
    );

    if (savedFilters.amountMin !== undefined || savedFilters.amountMax !== undefined) {
      setAmountRange([
        savedFilters.amountMin || 0,
        savedFilters.amountMax || 10000,
      ]);
    }

    // Auto-search with loaded filters
    setTimeout(() => {
      onSearch({
        ...savedFilters,
        sortBy: savedFilters.sortBy || 'date',
        sortOrder: savedFilters.sortOrder || 'desc',
      });
    }, 100);
  };

  const handleSearch = () => {
    // Validate regex if enabled
    if (useRegex && filters.query) {
      try {
        new RegExp(filters.query);
      } catch (_e) {
        toast.error('Invalid regex pattern');
        return;
      }
    }
    onSearch(filters);
  };

  const handleSaveSearch = async () => {
    if (!filters.query && activeFilterCount === 0) {
      toast.error('Add some filters before saving');
      return;
    }

    setSavingSearch(true);
    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: filters.query ? `Search: ${filters.query.substring(0, 30)}...` : 'Custom Search',
          filters: filters,
        }),
      });

      if (response.ok) {
        toast.success('Search saved successfully!');
        setShowSavedSearches(true); // Show saved searches section
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save search');
      }
    } catch (_error) {
      toast.error('Failed to save search');
    } finally {
      setSavingSearch(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : v !== 'date' && v !== 'desc')
  ).length;

  return (
    <Card className={`bg-card border-border transition-all ${isExpanded ? 'p-6 space-y-6' : 'p-4'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <div className="text-left flex-1">
          <h2 className="text-lg font-semibold text-foreground">Advanced Search</h2>
          {activeFilterCount > 0 && (
            <p className="text-sm text-[var(--color-income)] mt-1">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <>
          <div className="flex items-center justify-end">
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground border-border hover:bg-elevated"
              >
                Clear All
              </Button>
            )}
          </div>

      {/* Saved Searches Toggle */}
      <div className="border-t border-border pt-4">
        <Button
          onClick={() => setShowSavedSearches(!showSavedSearches)}
          variant="outline"
          className="w-full justify-between text-muted-foreground border-border hover:bg-elevated"
        >
          Saved Searches
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              showSavedSearches ? 'rotate-180' : ''
            }`}
          />
        </Button>

        {showSavedSearches && (
          <div className="mt-4">
            <SavedSearches
              currentFilters={filters}
              onLoadSearch={handleLoadSavedSearch}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>

      {/* Text Search */}
      <div className="space-y-2">
        <Label htmlFor="query" className="text-foreground">
          Search Description & Notes
        </Label>
        <Input
          id="query"
          placeholder="Search transactions..."
          value={filters.query || ''}
          onChange={(e) =>
            setFilters({ ...filters, query: e.target.value || undefined })
          }
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
        />

        {/* Experimental: Regex Toggle and Save Search */}
        <FeatureGate featureId="enhanced-search">
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-regex"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-elevated text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
                />
                <Label
                  htmlFor="use-regex"
                  className="text-sm text-foreground cursor-pointer"
                >
                  Use Regex
                </Label>
              </div>
              <ExperimentalBadge className="ml-1" />
            </div>

            {(filters.query || activeFilterCount > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSearch}
                disabled={savingSearch}
                className="border-border text-foreground hover:bg-elevated"
              >
                <Save className="w-4 h-4 mr-2" />
                {savingSearch ? 'Saving...' : 'Save Search'}
              </Button>
            )}
          </div>
        </FeatureGate>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <Label className="text-foreground">Categories</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant={
                  selectedCategories.has(category.id) ? 'default' : 'outline'
                }
                className={`cursor-pointer transition-colors ${
                  selectedCategories.has(category.id)
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                    : 'bg-elevated text-muted-foreground border-border hover:bg-[var(--color-elevated)]'
                }`}
                onClick={() => handleCategoryToggle(category.id)}
              >
                {category.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Accounts */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-foreground">Accounts</Label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((account) => (
              <Badge
                key={account.id}
                variant={
                  selectedAccounts.has(account.id) ? 'default' : 'outline'
                }
                className={`cursor-pointer transition-colors ${
                  selectedAccounts.has(account.id)
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                    : 'bg-elevated text-muted-foreground border-border hover:bg-[var(--color-elevated)]'
                }`}
                onClick={() => handleAccountToggle(account.id)}
              >
                {account.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="space-y-2">
          <Label className="text-foreground">Tags</Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={
                  selectedTags.has(tag.id) ? 'default' : 'outline'
                }
                className={`cursor-pointer transition-colors ${
                  selectedTags.has(tag.id)
                    ? 'text-primary-foreground'
                    : 'text-foreground border-border hover:bg-elevated'
                }`}
                style={
                  selectedTags.has(tag.id)
                    ? { backgroundColor: tag.color }
                    : { borderColor: tag.color }
                }
                onClick={() => handleTagToggle(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Transaction Types */}
      <div className="space-y-2">
        <Label className="text-foreground">Transaction Types</Label>
        <div className="flex flex-wrap gap-2">
          {transactionTypes.map((type) => (
            <Badge
              key={type.value}
              variant={
                selectedTypes.has(type.value) ? 'default' : 'outline'
              }
              className={`cursor-pointer transition-colors ${
                selectedTypes.has(type.value)
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'bg-elevated text-muted-foreground border-border hover:bg-[var(--color-elevated)]'
              }`}
              onClick={() => handleTypeToggle(type.value)}
            >
              {type.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Amount Range */}
      <div className="space-y-4">
        <Label className="text-foreground">Amount Range</Label>
        <div className="space-y-3">
          <Slider
            value={amountRange}
            onValueChange={handleAmountChange}
            min={0}
            max={10000}
            step={50}
            className="w-full"
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Min</Label>
              <div className="text-foreground font-semibold">${amountRange[0]}</div>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Max</Label>
              <div className="text-foreground font-semibold">${amountRange[1]}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateStart" className="text-foreground">
            From Date
          </Label>
          <Input
            id="dateStart"
            type="date"
            value={filters.dateStart || ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                dateStart: e.target.value || undefined,
              })
            }
            className="bg-elevated border-border text-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateEnd" className="text-foreground">
            To Date
          </Label>
          <Input
            id="dateEnd"
            type="date"
            value={filters.dateEnd || ''}
            onChange={(e) =>
              setFilters({
                ...filters,
                dateEnd: e.target.value || undefined,
              })
            }
            className="bg-elevated border-border text-foreground"
          />
        </div>
      </div>

      {/* Toggle Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-elevated rounded-lg">
          <Label htmlFor="isPending" className="text-foreground cursor-pointer">
            Pending Only
          </Label>
          <Switch
            id="isPending"
            checked={filters.isPending || false}
            onCheckedChange={(checked) =>
              setFilters({
                ...filters,
                isPending: checked || undefined,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-elevated rounded-lg">
          <Label htmlFor="isSplit" className="text-foreground cursor-pointer">
            Split Transactions Only
          </Label>
          <Switch
            id="isSplit"
            checked={filters.isSplit || false}
            onCheckedChange={(checked) =>
              setFilters({
                ...filters,
                isSplit: checked || undefined,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-elevated rounded-lg">
          <Label htmlFor="hasNotes" className="text-foreground cursor-pointer">
            Has Notes Only
          </Label>
          <Switch
            id="hasNotes"
            checked={filters.hasNotes || false}
            onCheckedChange={(checked) =>
              setFilters({
                ...filters,
                hasNotes: checked || undefined,
              })
            }
          />
        </div>
      </div>

      {/* Sort Options */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sortBy" className="text-foreground">
            Sort By
          </Label>
          <select
            id="sortBy"
            value={filters.sortBy || 'date'}
            onChange={(e) =>
              setFilters({
                ...filters,
                sortBy: e.target.value as 'date' | 'amount' | 'description',
              })
            }
            className="w-full bg-elevated border border-border text-foreground rounded px-3 py-2"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="description">Description</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder" className="text-foreground">
            Order
          </Label>
          <select
            id="sortOrder"
            value={filters.sortOrder || 'desc'}
            onChange={(e) =>
              setFilters({
                ...filters,
                sortOrder: e.target.value as 'asc' | 'desc',
              })
            }
            className="w-full bg-elevated border border-border text-foreground rounded px-3 py-2"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Search Button */}
      <Button
        onClick={handleSearch}
        disabled={isLoading}
        className="w-full bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)] font-semibold py-2"
      >
        {isLoading ? 'Searching...' : 'Search Transactions'}
      </Button>
        </>
      )}
    </Card>
  );
}
