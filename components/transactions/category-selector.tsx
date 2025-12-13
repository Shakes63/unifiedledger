'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Category {
  id: string;
  name: string;
  type: string;
  isBusinessCategory?: boolean;
  isBudgetGroup?: boolean;
  parentId?: string | null;
}

interface Bill {
  id: string;
  name: string;
  categoryId: string;
}

interface Debt {
  id: string;
  name: string;
  categoryId: string;
}

interface CategorySelectorProps {
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  transactionType: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  onLoadingChange?: (isLoading: boolean) => void;
  isBusinessAccount?: boolean;
}

export function CategorySelector({
  selectedCategory,
  onCategoryChange,
  transactionType,
  onLoadingChange,
  isBusinessAccount = false,
}: CategorySelectorProps) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [_isLoading, setIsLoading] = useState(true);

  // Notify parent of loading state changes
  const updateLoading = useCallback((loading: boolean) => {
    setIsLoading(loading);
    onLoadingChange?.(loading);
  }, [onLoadingChange]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const getCategoryType = (): string => {
    if (transactionType === 'income') return 'income';
    return 'expense'; // default for expenses
  };

  useEffect(() => {
    if (!selectedHouseholdId) {
      updateLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        updateLoading(true);

        // Fetch categories
        const categoriesResponse = await fetchWithHousehold('/api/categories');
        if (categoriesResponse.ok) {
          const data = await categoriesResponse.json();
          // Filter categories based on transaction type
          const filteredCategories = data.filter((cat: Category) => {
            if (transactionType === 'income') return cat.type === 'income';
            if (transactionType === 'transfer_in' || transactionType === 'transfer_out')
              return false;
            return cat.type === 'expense';
          });
          setCategories(filteredCategories);
        }

        // Only fetch bills and debts for expense transactions
        if (transactionType === 'expense') {
          // Fetch active bills with categories
          const billsResponse = await fetchWithHousehold('/api/bills?isActive=true');
          if (billsResponse.ok) {
            const billsData = await billsResponse.json();
            // Bills API returns { data: [...], total, limit, offset }
            // Each item is { bill, category, account, upcomingInstances }
            interface BillItem {
              bill: { id: string; name: string; categoryId?: string };
            }
            const billsWithCategories = (billsData.data || [])
              .filter((item: BillItem) => item.bill?.categoryId)
              .map((item: BillItem) => ({
                id: item.bill.id,
                name: item.bill.name,
                categoryId: item.bill.categoryId,
              }));
            setBills(billsWithCategories);
          }

          // Fetch active debts with categories
          const debtsResponse = await fetchWithHousehold('/api/debts?status=active');
          if (debtsResponse.ok) {
            const debtsData = await debtsResponse.json();
            // Debts API returns array directly
            interface DebtItem {
              id: string;
              name: string;
              categoryId?: string;
            }
            const debtsWithCategories = (debtsData || [])
              .filter((debt: DebtItem) => debt.categoryId)
              .map((debt: DebtItem) => ({
                id: debt.id,
                name: debt.name,
                categoryId: debt.categoryId,
              }));
            setDebts(debtsWithCategories);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        updateLoading(false);
      }
    };

    fetchData();
  }, [transactionType, selectedHouseholdId, fetchWithHousehold, updateLoading]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await postWithHousehold('/api/categories', {
        name: newCategoryName,
        type: getCategoryType(),
        monthlyBudget: 0,
        isBusinessCategory: isBusinessAccount,
      });

      if (response.ok) {
        const newCategory = await response.json();
        // Use flushSync to ensure categories state updates synchronously
        flushSync(() => {
          setCategories([...categories, newCategory]);
        });
        // Use setTimeout to ensure parent state updates propagate
        // before switching back to Select view
        setTimeout(() => {
          onCategoryChange(newCategory.id);
          setNewCategoryName('');
          setIsCreating(false);
        }, 0);
        toast.success(`Category "${newCategory.name}" created!`);
      } else {
        toast.error('Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Error creating category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateCategory();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewCategoryName('');
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Category</label>
      {/* Keep Select mounted but hidden during creation to preserve controlled value state */}
      <div className={`flex gap-2 ${isCreating ? 'hidden' : ''}`}>
        <Select value={selectedCategory || 'none'} onValueChange={(value) => onCategoryChange(value === 'none' ? null : value)}>
          <SelectTrigger className="flex-1 bg-elevated border-border text-foreground rounded-lg">
            <SelectValue placeholder="Select or skip" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Skip (No category)</SelectItem>

            {(() => {
              // Track which categoryIds we've already shown to prevent duplicates
              const shownCategoryIds = new Set<string>();

              // Separate budget groups from regular categories
              const budgetGroups = categories.filter(c => c.isBudgetGroup);
              const regularCategories = categories.filter(c => !c.isBudgetGroup);

              // Collect all items to display
              const billItems: React.ReactElement[] = [];
              const debtItems: React.ReactElement[] = [];
              const businessCategoryItems: React.ReactElement[] = [];
              const personalCategoryItems: React.ReactElement[] = [];
              const budgetGroupSections: React.ReactElement[] = [];

              // Add bills
              bills.forEach((bill) => {
                if (!shownCategoryIds.has(bill.categoryId)) {
                  shownCategoryIds.add(bill.categoryId);
                  billItems.push(
                    <SelectItem key={`bill-${bill.id}`} value={bill.categoryId}>
                      {bill.name}
                    </SelectItem>
                  );
                }
              });

              // Add debts
              debts.forEach((debt) => {
                if (!shownCategoryIds.has(debt.categoryId)) {
                  shownCategoryIds.add(debt.categoryId);
                  debtItems.push(
                    <SelectItem key={`debt-${debt.id}`} value={debt.categoryId}>
                      {debt.name}
                    </SelectItem>
                  );
                }
              });

              // Build budget group sections with their children
              budgetGroups.forEach((group) => {
                const children = regularCategories.filter(c => c.parentId === group.id);
                if (children.length > 0) {
                  const childItems = children
                    .filter(child => !shownCategoryIds.has(child.id))
                    .map(child => {
                      shownCategoryIds.add(child.id);
                      return (
                        <SelectItem key={`cat-${child.id}`} value={child.id}>
                          {child.name}
                        </SelectItem>
                      );
                    });

                  if (childItems.length > 0) {
                    budgetGroupSections.push(
                      <React.Fragment key={`group-${group.id}`}>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel className="uppercase text-xs tracking-wider">{group.name}</SelectLabel>
                          {childItems}
                        </SelectGroup>
                      </React.Fragment>
                    );
                  }
                }
              });

              // Add remaining regular categories (not in any budget group)
              // Split into business and personal categories
              regularCategories.forEach((category) => {
                if (!shownCategoryIds.has(category.id) && !category.parentId) {
                  shownCategoryIds.add(category.id);
                  const item = (
                    <SelectItem key={`cat-${category.id}`} value={category.id}>
                      {category.name}
                    </SelectItem>
                  );
                  if (category.isBusinessCategory) {
                    businessCategoryItems.push(item);
                  } else {
                    personalCategoryItems.push(item);
                  }
                }
              });

              // Render budget group sections first (they represent the user's budget structure)
              const renderBudgetGroups = () =>
                budgetGroupSections.length > 0 && budgetGroupSections;

              // Render sections in order based on account type
              // If business account: Business first, then Bills, Debts, Personal
              // If personal account: Personal first, then Bills, Debts, Business
              const renderBusinessSection = () =>
                businessCategoryItems.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Business</SelectLabel>
                      {businessCategoryItems}
                    </SelectGroup>
                  </>
                );

              const renderPersonalSection = () =>
                personalCategoryItems.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Uncategorized</SelectLabel>
                      {personalCategoryItems}
                    </SelectGroup>
                  </>
                );

              const renderBillsSection = () =>
                billItems.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Bills</SelectLabel>
                      {billItems}
                    </SelectGroup>
                  </>
                );

              const renderDebtsSection = () =>
                debtItems.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Debts</SelectLabel>
                      {debtItems}
                    </SelectGroup>
                  </>
                );

              return (
                <>
                  {/* Budget groups always appear first since they represent the budget structure */}
                  {renderBudgetGroups()}
                  
                  {isBusinessAccount ? (
                    <>
                      {renderBusinessSection()}
                      {renderBillsSection()}
                      {renderDebtsSection()}
                      {renderPersonalSection()}
                    </>
                  ) : (
                    <>
                      {renderPersonalSection()}
                      {renderBillsSection()}
                      {renderDebtsSection()}
                      {renderBusinessSection()}
                    </>
                  )}
                </>
              );
            })()}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsCreating(true)}
          className="bg-elevated border-border text-muted-foreground hover:bg-border hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {isCreating && (
        <div className="flex gap-2">
          <Input
            autoFocus
            type="text"
            placeholder="New category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-elevated border border-[var(--color-primary)] text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleCreateCategory}
            disabled={creatingCategory || !newCategoryName.trim()}
            className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setIsCreating(false);
              setNewCategoryName('');
            }}
            className="bg-elevated border-border text-muted-foreground hover:bg-border hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
