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
  hasSavingsGoal?: boolean; // Phase 18: Filter for savings contributions
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
    <div className={`rounded-xl transition-all ${isExpanded ? 'p-5 space-y-5' : 'p-4'}`} style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between hover:opacity-80 transition-opacity">
        <div className="text-left flex-1">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Advanced Search</h2>
          {activeFilterCount > 0 && (
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-income)' }}>
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--color-muted-foreground)' }} />
      </button>

      {isExpanded && (
        <>
          <div className="flex items-center justify-end">
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="hover:bg-(--color-elevated)"
            style={{ color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}
              >
                Clear All
              </Button>
            )}
          </div>

      {/* Saved Searches Toggle */}
      <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <Button
          onClick={() => setShowSavedSearches(!showSavedSearches)}
          variant="outline"
          className="w-full justify-between hover:bg-(--color-elevated)"
          style={{ color: 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}
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
      <div className="space-y-1.5">
        <Label htmlFor="query" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
          Search Description &amp; Notes
        </Label>
        <Input id="query" placeholder="Search transactions…" value={filters.query || ''}
          onChange={e => setFilters({ ...filters, query: e.target.value || undefined })}
          className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />

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
                  className="w-4 h-4 rounded focus:ring-offset-0"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)', accentColor: 'var(--color-primary)' }}
                />
                <Label
                  htmlFor="use-regex"
                  className="text-sm cursor-pointer" style={{ color: 'var(--color-foreground)' }}
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
                className="hover:bg-(--color-elevated)"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
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
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Categories</Label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => {
              const active = selectedCategories.has(cat.id);
              return <button key={cat.id} type="button" onClick={() => handleCategoryToggle(cat.id)}
                className="px-2.5 py-1 text-[11px] rounded-full transition-all"
                style={{ backgroundColor: active ? 'var(--color-primary)' : 'var(--color-elevated)', color: active ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)', border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                {cat.name}
              </button>;
            })}
          </div>
        </div>
      )}

      {/* Accounts */}
      {accounts.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Accounts</Label>
          <div className="flex flex-wrap gap-1.5">
            {accounts.map(account => {
              const active = selectedAccounts.has(account.id);
              return <button key={account.id} type="button" onClick={() => handleAccountToggle(account.id)}
                className="px-2.5 py-1 text-[11px] rounded-full transition-all"
                style={{ backgroundColor: active ? 'var(--color-primary)' : 'var(--color-elevated)', color: active ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)', border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                {account.name}
              </button>;
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Tags</Label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(tag => {
              const active = selectedTags.has(tag.id);
              return <button key={tag.id} type="button" onClick={() => handleTagToggle(tag.id)}
                className="px-2.5 py-1 text-[11px] rounded-full transition-all"
                style={{ backgroundColor: active ? tag.color : 'var(--color-elevated)', color: active ? 'white' : 'var(--color-muted-foreground)', border: `1px solid ${active ? tag.color : 'var(--color-border)'}` }}>
                {tag.name}
              </button>;
            })}
          </div>
        </div>
      )}

      {/* Transaction Types */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Transaction Types</Label>
        <div className="flex flex-wrap gap-1.5">
          {transactionTypes.map(type => {
            const active = selectedTypes.has(type.value);
            return <button key={type.value} type="button" onClick={() => handleTypeToggle(type.value)}
              className="px-2.5 py-1 text-[11px] rounded-full transition-all"
              style={{ backgroundColor: active ? 'var(--color-primary)' : 'var(--color-elevated)', color: active ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)', border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
              {type.label}
            </button>;
          })}
        </div>
      </div>

      {/* Amount Range */}
      <div className="space-y-4">
        <Label style={{ color: 'var(--color-foreground)' }}>Amount Range</Label>
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
              <Label className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Min</Label>
              <div className="font-semibold" style={{ color: 'var(--color-foreground)' }}>${amountRange[0]}</div>
            </div>
            <div className="flex-1">
              <Label className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Max</Label>
              <div className="font-semibold" style={{ color: 'var(--color-foreground)' }}>${amountRange[1]}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dateStart" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>From Date</Label>
          <Input id="dateStart" type="date" value={filters.dateStart || ''} onChange={e => setFilters({ ...filters, dateStart: e.target.value || undefined })}
            className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dateEnd" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>To Date</Label>
          <Input id="dateEnd" type="date" value={filters.dateEnd || ''} onChange={e => setFilters({ ...filters, dateEnd: e.target.value || undefined })}
            className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
        </div>
      </div>

      {/* Toggle Filters */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {[
          { id: 'isPending', label: 'Pending Only', key: 'isPending' as const },
          { id: 'isSplit', label: 'Split Transactions Only', key: 'isSplit' as const },
          { id: 'hasNotes', label: 'Has Notes Only', key: 'hasNotes' as const },
          { id: 'hasSavingsGoal', label: 'Savings Contributions Only', key: 'hasSavingsGoal' as const },
        ].map(({ id, label, key }, i, arr) => (
          <div key={id} className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: 'var(--color-elevated)', borderBottom: i < arr.length - 1 ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none' }}>
            <Label htmlFor={id} className="text-[13px] cursor-pointer" style={{ color: 'var(--color-foreground)' }}>{label}</Label>
            <Switch id={id} checked={!!filters[key]} onCheckedChange={checked => setFilters({ ...filters, [key]: checked || undefined })} />
          </div>
        ))}
      </div>

      {/* Sort Options */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sortBy" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Sort By</Label>
          <select id="sortBy" value={filters.sortBy || 'date'}
            onChange={e => setFilters({ ...filters, sortBy: e.target.value as 'date' | 'amount' | 'description' })}
            className="w-full rounded-lg px-3 py-2 text-[13px] h-9"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
            <option value="date">Date</option>
            <option value="amount">Amount</option>
            <option value="description">Description</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Order</Label>
          <select id="sortOrder" value={filters.sortOrder || 'desc'}
            onChange={e => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
            className="w-full rounded-lg px-3 py-2 text-[13px] h-9"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <Button onClick={handleSearch} disabled={isLoading} className="w-full h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
        {isLoading ? 'Searching…' : 'Search Transactions'}
      </Button>
        </>
      )}
    </div>
  );
}
