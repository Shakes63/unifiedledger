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
import { Plus } from 'lucide-react';

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

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white">Category</label>
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
        <Button variant="outline" size="icon" className="bg-[#242424] border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
