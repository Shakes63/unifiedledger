'use client';

import { useState, useEffect } from 'react';
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
}

export function CategorySelector({
  selectedCategory,
  onCategoryChange,
  transactionType,
}: CategorySelectorProps) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const getCategoryType = (): string => {
    if (transactionType === 'income') return 'income';
    return 'variable_expense'; // default for expenses
  };

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch categories
        const categoriesResponse = await fetchWithHousehold('/api/categories');
        if (categoriesResponse.ok) {
          const data = await categoriesResponse.json();
          // Filter categories based on transaction type
          const filteredCategories = data.filter((cat: Category) => {
            if (transactionType === 'income') return cat.type === 'income';
            if (transactionType === 'transfer_in' || transactionType === 'transfer_out')
              return false;
            return cat.type === 'variable_expense' || cat.type === 'monthly_bill';
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
            const billsWithCategories = (billsData.data || [])
              .filter((item: any) => item.bill?.categoryId)
              .map((item: any) => ({
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
            const debtsWithCategories = (debtsData || [])
              .filter((debt: any) => debt.categoryId)
              .map((debt: any) => ({
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
        setLoading(false);
      }
    };

    fetchData();
    // Note: fetchWithHousehold is memoized in useHouseholdFetch hook, so we don't need it in dependencies
  }, [transactionType, selectedHouseholdId]);

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
      });

      if (response.ok) {
        const newCategory = await response.json();
        // Add to categories list
        setCategories([...categories, newCategory]);
        // Auto-select the new category
        onCategoryChange(newCategory.id);
        // Reset creation UI
        setNewCategoryName('');
        setIsCreating(false);
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
      {!isCreating ? (
        <div className="flex gap-2">
          <Select value={selectedCategory || 'none'} onValueChange={(value) => onCategoryChange(value === 'none' ? null : value)}>
            <SelectTrigger className="flex-1 bg-elevated border-border text-foreground rounded-lg">
              <SelectValue placeholder="Select or skip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Skip (No category)</SelectItem>

              {(() => {
                // Track which categoryIds we've already shown to prevent duplicates
                const shownCategoryIds = new Set<string>();

                // Collect all items to display
                const billItems: React.ReactElement[] = [];
                const debtItems: React.ReactElement[] = [];
                const categoryItems: React.ReactElement[] = [];

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

                // Add regular categories (excluding those used by bills/debts)
                categories.forEach((category) => {
                  if (!shownCategoryIds.has(category.id)) {
                    shownCategoryIds.add(category.id);
                    categoryItems.push(
                      <SelectItem key={`cat-${category.id}`} value={category.id}>
                        {category.name}
                      </SelectItem>
                    );
                  }
                });

                return (
                  <>
                    {/* Bills Section */}
                    {billItems.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Bills</SelectLabel>
                          {billItems}
                        </SelectGroup>
                      </>
                    )}

                    {/* Debts Section */}
                    {debtItems.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Debts</SelectLabel>
                          {debtItems}
                        </SelectGroup>
                      </>
                    )}

                    {/* Regular Categories Section */}
                    {categoryItems.length > 0 && (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Categories</SelectLabel>
                          {categoryItems}
                        </SelectGroup>
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
      ) : (
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
