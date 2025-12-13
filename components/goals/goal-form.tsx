'use client';

import { useState, useMemo } from 'react';
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
import { Lightbulb, Check } from 'lucide-react';
import {
  calculateRecommendedMonthlySavings,
  formatCurrency,
} from '@/lib/goals/calculate-recommended-savings';
import type { GoalFormData } from '@/lib/types';

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
  goal?: Partial<GoalFormData> | null;
  onSubmit: (data: Partial<GoalFormData>) => void;
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate recommended monthly savings based on current form values
  const recommendation = useMemo(() => {
    const targetAmount = parseFloat(String(formData.targetAmount)) || 0;
    const currentAmount = parseFloat(String(formData.currentAmount)) || 0;
    const targetDate = formData.targetDate || null;

    if (targetAmount <= 0) {
      return null;
    }

    return calculateRecommendedMonthlySavings(targetAmount, currentAmount, targetDate);
  }, [formData.targetAmount, formData.currentAmount, formData.targetDate]);

  // Check if current monthly contribution matches recommendation
  const isRecommendationApplied = useMemo(() => {
    if (!recommendation?.recommendedMonthly) return false;
    const currentMonthly = parseFloat(String(formData.monthlyContribution)) || 0;
    return Math.abs(currentMonthly - recommendation.recommendedMonthly) < 0.01;
  }, [recommendation, formData.monthlyContribution]);

  const handleApplyRecommendation = () => {
    if (recommendation?.recommendedMonthly) {
      setFormData((prev) => ({
        ...prev,
        monthlyContribution: recommendation.recommendedMonthly!.toFixed(2),
      }));
      toast.success('Recommended amount applied');
    }
  };

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

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Goal name is required';
    }

    if (!formData.targetAmount || parseFloat(String(formData.targetAmount)) <= 0) {
      newErrors.targetAmount = 'Target amount must be greater than 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(Object.values(newErrors)[0]);
      return;
    }

    setErrors({});

    onSubmit({
      ...formData,
      targetAmount: parseFloat(String(formData.targetAmount)),
      currentAmount: parseFloat(String(formData.currentAmount)),
      monthlyContribution: formData.monthlyContribution ? parseFloat(String(formData.monthlyContribution)) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name and Target Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className={`text-sm mb-1 ${errors.name ? 'text-(--color-error)' : 'text-muted-foreground'}`}>
            Goal Name
          </Label>
          <Input
            name="name"
            value={formData.name}
            onChange={(e) => {
              handleChange(e);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            placeholder="e.g., Vacation Fund"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.name ? 'border-(--color-error)' : 'border-border'
            }`}
          />
          {errors.name && (
            <p className="text-(--color-error) text-xs mt-1">{errors.name}</p>
          )}
        </div>
        <div>
          <Label className={`text-sm mb-1 ${errors.targetAmount ? 'text-(--color-error)' : 'text-muted-foreground'}`}>
            Target Amount
          </Label>
          <Input
            name="targetAmount"
            type="number"
            value={formData.targetAmount}
            onChange={(e) => {
              handleChange(e);
              if (errors.targetAmount) setErrors(prev => ({ ...prev, targetAmount: '' }));
            }}
            placeholder="Enter amount"
            step="0.01"
            min="0"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.targetAmount ? 'border-(--color-error)' : 'border-border'
            }`}
          />
          {errors.targetAmount && (
            <p className="text-(--color-error) text-xs mt-1">{errors.targetAmount}</p>
          )}
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

      {/* Recommended Monthly Savings */}
      {recommendation && (
        <div className="bg-elevated border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-(--color-primary)/10 flex-shrink-0">
              <Lightbulb className="w-4 h-4 text-(--color-primary)" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground mb-1">
                Recommended Monthly Savings
              </p>
              {recommendation.recommendedMonthly !== null ? (
                <>
                  <p className="text-xl font-semibold text-(--color-primary) font-mono">
                    {formatCurrency(recommendation.recommendedMonthly)}
                    <span className="text-sm font-normal text-muted-foreground ml-1">/month</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {recommendation.message}
                  </p>
                  {recommendation.isTightTimeline && (
                    <p className="text-xs text-(--color-warning) mt-1">
                      Tight timeline - consider adjusting your target date
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyRecommendation}
                    disabled={isRecommendationApplied}
                    className={`mt-3 ${
                      isRecommendationApplied
                        ? 'bg-(--color-success)/20 text-(--color-success) cursor-default'
                        : 'bg-(--color-primary) hover:opacity-90 text-(--color-primary-foreground)'
                    }`}
                  >
                    {isRecommendationApplied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Applied
                      </>
                    ) : (
                      'Apply Recommendation'
                    )}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {recommendation.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
          className="flex-1 bg-(--color-primary) hover:opacity-90 text-(--color-primary-foreground)"
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
