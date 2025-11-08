'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  type: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const getCategoryType = (): string => {
    if (transactionType === 'income') return 'income';
    return 'variable_expense'; // default for expenses
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          // Filter categories based on transaction type
          const filteredCategories = data.filter((cat: Category) => {
            if (transactionType === 'income') return cat.type === 'income';
            if (transactionType === 'transfer_in' || transactionType === 'transfer_out')
              return false;
            return cat.type === 'variable_expense' || cat.type === 'monthly_bill';
          });
          setCategories(filteredCategories);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [transactionType]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          type: getCategoryType(),
          monthlyBudget: 0,
        }),
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
      <label className="text-sm font-medium text-white">Category</label>
      {!isCreating ? (
        <div className="flex gap-2">
          <Select value={selectedCategory || ''} onValueChange={onCategoryChange}>
            <SelectTrigger className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg">
              <SelectValue placeholder="Select or skip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Skip (No category)</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsCreating(true)}
            className="bg-[#242424] border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]"
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
            className="flex-1 bg-[#1a1a1a] border border-[#3b82f6] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleCreateCategory}
            disabled={creatingCategory || !newCategoryName.trim()}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
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
            className="bg-[#242424] border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
