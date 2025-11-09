'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const GOAL_CATEGORIES = [
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'education', label: 'Education' },
  { value: 'home', label: 'Home' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'debt_payoff', label: 'Debt Payoff' },
  { value: 'other', label: 'Other' },
];

const GOAL_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

interface GoalFormProps {
  goal?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function GoalForm({ goal, onSubmit, onCancel, isLoading = false }: GoalFormProps) {
  const [formData, setFormData] = useState({
    name: goal?.name || '',
    description: goal?.description || '',
    targetAmount: goal?.targetAmount || '',
    currentAmount: goal?.currentAmount || 0,
    category: goal?.category || 'other',
    color: goal?.color || '#10b981',
    targetDate: goal?.targetDate || '',
    priority: goal?.priority || 0,
    monthlyContribution: goal?.monthlyContribution || '',
    notes: goal?.notes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleColorChange = (color: string) => {
    setFormData((prev) => ({
      ...prev,
      color,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Goal name is required');
      return;
    }

    if (!formData.targetAmount || parseFloat(formData.targetAmount) <= 0) {
      toast.error('Target amount must be greater than 0');
      return;
    }

    onSubmit({
      ...formData,
      targetAmount: parseFloat(formData.targetAmount),
      currentAmount: parseFloat(String(formData.currentAmount)),
      monthlyContribution: formData.monthlyContribution ? parseFloat(formData.monthlyContribution) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name and Target Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Goal Name</Label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Vacation Fund"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Target Amount</Label>
          <Input
            name="targetAmount"
            type="number"
            value={formData.targetAmount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Current Amount and Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Current Amount</Label>
          <Input
            name="currentAmount"
            type="number"
            value={formData.currentAmount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Priority</Label>
          <Input
            name="priority"
            type="number"
            value={formData.priority}
            onChange={handleChange}
            placeholder="0"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Category and Target Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Category</Label>
          <Select value={formData.category} onValueChange={(v) => handleSelectChange('category', v)}>
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {GOAL_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value} className="text-foreground">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Target Date</Label>
          <Input
            name="targetDate"
            type="date"
            value={formData.targetDate}
            onChange={handleChange}
            className="bg-elevated border-border text-foreground"
          />
        </div>
      </div>

      {/* Monthly Contribution */}
      <div>
        <Label className="text-muted-foreground text-sm mb-1">Monthly Contribution (Optional)</Label>
        <Input
          name="monthlyContribution"
          type="number"
          value={formData.monthlyContribution}
          onChange={handleChange}
          placeholder="0.00"
          step="0.01"
          min="0"
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Color Picker */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2">Color</Label>
        <div className="flex gap-2">
          {GOAL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorChange(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.color === color ? 'border-foreground scale-110' : 'border-border'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <Label className="text-muted-foreground text-sm mb-1">Description (Optional)</Label>
        <Textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Why is this goal important to you?"
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground min-h-20"
        />
      </div>

      {/* Notes */}
      <div>
        <Label className="text-muted-foreground text-sm mb-1">Notes (Optional)</Label>
        <Textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Additional notes..."
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground min-h-20"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
        >
          {isLoading ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="flex-1 border-border text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
