'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FolderPlus, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { CategoryForm } from '@/components/categories/category-form';
import { CategoryCard } from '@/components/categories/category-card';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { HouseholdLoadingState } from '@/components/household/household-loading-state';
import { NoHouseholdError } from '@/components/household/no-household-error';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'savings';
  monthlyBudget: number;
  dueDate?: number | null;
  usageCount: number;
  parentId?: string | null;
  isBudgetGroup?: boolean;
  targetAllocation?: number | null;
}

const CATEGORY_TYPES = ['income', 'expense', 'savings'];

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  savings: 'Savings',
};

export default function CategoriesPage() {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [createMode, setCreateMode] = useState<'category' | 'parent'>('category');

  // Fetch categories
  useEffect(() => {
    // Don't fetch if household context isn't initialized yet
    if (!initialized || householdLoading) {
      return;
    }

    // Don't fetch if no household is selected
    if (!selectedHouseholdId || !householdId) {
      setLoading(false);
      return;
    }

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await fetchWithHousehold('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Failed to load categories' }));
          
          // Handle 403 errors gracefully
          if (response.status === 403) {
            toast.error(errorData.error || 'You do not have access to this household.');
          } else {
            toast.error(errorData.error || 'Failed to load categories');
          }
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Error loading categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [initialized, householdLoading, selectedHouseholdId, householdId, fetchWithHousehold]);

  // Create or update category
  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);

      if (selectedCategory) {
        // Update category
        const response = await putWithHousehold(`/api/categories/${selectedCategory.id}`, formData);

        if (response.ok) {
          toast.success('Category updated successfully');

          // Update local state
          setCategories(
            categories.map((cat) =>
              cat.id === selectedCategory.id
                ? { ...cat, ...formData }
                : cat
            )
          );

          // Close dialog
          setIsDialogOpen(false);
          setSelectedCategory(null);
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to update category');
        }
      } else {
        // Create category
        const response = await postWithHousehold('/api/categories', formData);

        if (response.ok) {
          const result = await response.json();
          toast.success('Category created successfully');

          // Refresh categories list
          const fetchResponse = await fetchWithHousehold('/api/categories');
          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            setCategories(data);
          }

          // Close dialog
          setIsDialogOpen(false);
          setSelectedCategory(null);
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to create category');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(selectedCategory ? 'Error updating category' : 'Error creating category');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete category
  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Transactions using this category will not be affected.')) {
      return;
    }

    try {
      const response = await deleteWithHousehold(`/api/categories/${categoryId}`);

      if (response.ok) {
        toast.success('Category deleted successfully');
        setCategories(categories.filter((cat) => cat.id !== categoryId));
      } else {
        toast.error('Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Error deleting category');
    }
  };

  // Open create dialog for regular category
  const handleNewCategory = (parentId?: string) => {
    setSelectedCategory(parentId ? { parentId } as Category : null);
    setCreateMode('category');
    setIsDialogOpen(true);
  };

  // Open create dialog for parent category
  const handleNewParentCategory = () => {
    setSelectedCategory(null);
    setCreateMode('parent');
    setIsDialogOpen(true);
  };

  // Open edit dialog
  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setCreateMode(category.isBudgetGroup ? 'parent' : 'category');
    setIsDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCategory(null);
    setCreateMode('category');
  };

  // Toggle expanded state for parent categories
  const toggleExpanded = (categoryId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Get parent categories (budget groups)
  const parentCategories = categories.filter(c => c.isBudgetGroup);
  
  // Get regular categories (not budget groups)
  const regularCategories = categories.filter(c => !c.isBudgetGroup);

  // Filter categories by type
  const filteredParents = filterType === 'all'
    ? parentCategories
    : parentCategories.filter((cat) => cat.type === filterType);
  
  const filteredRegular = filterType === 'all'
    ? regularCategories
    : regularCategories.filter((cat) => cat.type === filterType);

  // Show loading state while household context initializes
  if (!initialized || householdLoading) {
    return <HouseholdLoadingState />;
  }

  // Show error state if no household is selected
  if (!selectedHouseholdId || !householdId) {
    return <NoHouseholdError />;
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-elevated rounded-lg w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-elevated rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Categories</h1>
            <p className="text-muted-foreground">Manage your transaction categories and budgets</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleNewParentCategory}
              variant="outline"
              className="bg-elevated border-border text-foreground hover:bg-border"
            >
              <FolderPlus className="mr-2 h-5 w-5" />
              Add Parent Category
            </Button>
            <Button
              onClick={() => handleNewCategory()}
              className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 font-medium"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Category
            </Button>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'bg-elevated text-muted-foreground hover:bg-elevated'
            }`}
          >
            All
          </button>
          {CATEGORY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === type
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'bg-elevated text-muted-foreground hover:bg-elevated'
              }`}
            >
              {CATEGORY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Categories Display */}
        {categories.length === 0 ? (
          <div className="p-12 border border-border bg-card rounded-xl text-center">
            <p className="text-muted-foreground mb-4">
              No categories yet. Create your first category to get started.
            </p>
            <Button
              onClick={() => handleNewCategory()}
              className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 font-medium"
            >
              <Plus className="mr-2 h-5 h-5" />
              Create First Category
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Parent Categories with Children */}
            {filteredParents.length > 0 && (
              <div className="space-y-4">
                {filteredParents.map((parent) => {
                  const children = filteredRegular.filter(c => c.parentId === parent.id);
                  const isExpanded = expandedGroups.has(parent.id);
                  
                  return (
                    <div key={parent.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Parent Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-elevated">
                        <button
                          onClick={() => toggleExpanded(parent.id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          )}
                          <div>
                            <span className="font-semibold text-foreground">{parent.name}</span>
                            {parent.targetAllocation && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                {parent.targetAllocation}% target
                              </span>
                            )}
                            <span className="ml-2 text-sm text-muted-foreground">
                              ({children.length} {children.length === 1 ? 'category' : 'categories'})
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleNewCategory(parent.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditCategory(parent)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(parent.id)}
                            className="text-muted-foreground hover:text-[var(--color-error)]"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      
                      {/* Children */}
                      {isExpanded && (
                        <div className="p-4">
                          {children.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {children.map((category) => (
                                <CategoryCard
                                  key={category.id}
                                  category={category}
                                  onEdit={handleEditCategory}
                                  onDelete={handleDelete}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No categories in this group yet.{' '}
                              <button
                                onClick={() => handleNewCategory(parent.id)}
                                className="text-[var(--color-primary)] hover:underline"
                              >
                                Add one
                              </button>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ungrouped Categories */}
            {(() => {
              const ungrouped = filteredRegular.filter(c => !c.parentId);
              if (ungrouped.length === 0) return null;
              
              return (
                <div>
                  {filteredParents.length > 0 && (
                    <h2 className="text-lg font-semibold text-foreground mb-3">Ungrouped Categories</h2>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ungrouped.map((category) => (
                      <CategoryCard
                        key={category.id}
                        category={category}
                        onEdit={handleEditCategory}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* No results for filter */}
            {filteredParents.length === 0 && filteredRegular.length === 0 && (
              <div className="p-12 border border-border bg-card rounded-xl text-center">
                <p className="text-muted-foreground">
                  No categories match the selected filter.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Category Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card border border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {selectedCategory?.id 
                  ? (selectedCategory.isBudgetGroup ? 'Edit Parent Category' : 'Edit Category')
                  : (createMode === 'parent' ? 'Create Parent Category' : 'Create New Category')
                }
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {createMode === 'parent'
                  ? 'Parent categories group related subcategories together (e.g., Needs, Wants, Savings for 50/30/20 budgeting)'
                  : 'Organize your transactions by creating custom income, expense, or savings categories'
                }
              </DialogDescription>
            </DialogHeader>
            <CategoryForm
              category={selectedCategory}
              onSubmit={handleSubmit}
              onCancel={handleCloseDialog}
              isLoading={isSubmitting}
              isParentCategory={createMode === 'parent'}
              parentCategories={parentCategories}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
