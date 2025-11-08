'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CategoryForm } from '@/components/categories/category-form';
import { CategoryCard } from '@/components/categories/category-card';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'variable_expense' | 'monthly_bill' | 'savings' | 'debt' | 'non_monthly_bill';
  monthlyBudget: number;
  dueDate?: number | null;
  usageCount: number;
}

const CATEGORY_TYPES = [
  'income',
  'variable_expense',
  'monthly_bill',
  'savings',
  'debt',
  'non_monthly_bill',
];

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  variable_expense: 'Variable Expense',
  monthly_bill: 'Monthly Bill',
  savings: 'Savings',
  debt: 'Debt',
  non_monthly_bill: 'Non-Monthly Bill',
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        } else {
          toast.error('Failed to load categories');
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Error loading categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Create or update category
  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);

      if (selectedCategory) {
        // Update category
        const response = await fetch(`/api/categories/${selectedCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

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
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const result = await response.json();
          toast.success('Category created successfully');

          // Refresh categories list
          const fetchResponse = await fetch('/api/categories');
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
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

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

  // Open create dialog
  const handleNewCategory = () => {
    setSelectedCategory(null);
    setIsDialogOpen(true);
  };

  // Open edit dialog
  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setIsDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCategory(null);
  };

  // Filter categories
  const filteredCategories =
    filterType === 'all'
      ? categories
      : categories.filter((cat) => cat.type === filterType);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-[#242424] rounded-lg w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-[#242424] rounded-lg"></div>
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
            <h1 className="text-4xl font-bold text-white mb-2">Categories</h1>
            <p className="text-gray-400">Manage your transaction categories and budgets</p>
          </div>
          <Button
            onClick={handleNewCategory}
            className="bg-emerald-500 text-white hover:bg-emerald-600 font-medium"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Category
          </Button>
        </div>

        {/* Filter Buttons */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-emerald-500 text-white'
                : 'bg-[#242424] text-gray-400 hover:bg-[#2a2a2a]'
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
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#242424] text-gray-400 hover:bg-[#2a2a2a]'
              }`}
            >
              {CATEGORY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Categories Grid */}
        {filteredCategories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onEdit={handleEditCategory}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="p-12 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl text-center">
            <p className="text-gray-400 mb-4">
              {categories.length === 0
                ? 'No categories yet. Create your first category to get started.'
                : 'No categories match the selected filter.'}
            </p>
            {categories.length === 0 && (
              <Button
                onClick={handleNewCategory}
                className="bg-emerald-500 text-white hover:bg-emerald-600 font-medium"
              >
                <Plus className="mr-2 h-5 h-5" />
                Create First Category
              </Button>
            )}
          </div>
        )}

        {/* Create/Edit Category Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] border border-[#2a2a2a] max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedCategory ? 'Edit Category' : 'Create New Category'}
              </DialogTitle>
            </DialogHeader>
            <CategoryForm
              category={selectedCategory}
              onSubmit={handleSubmit}
              onCancel={handleCloseDialog}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
