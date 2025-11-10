'use client';

import { useState, useEffect } from 'react';
import { RulesManager } from '@/components/rules/rules-manager';
import { RuleBuilder } from '@/components/rules/rule-builder';
import { BulkApplyRules } from '@/components/rules/bulk-apply-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import type { ConditionGroup, Condition } from '@/lib/rules/condition-evaluator';

interface Category {
  id: string;
  name: string;
}

interface Rule {
  id: string;
  name: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
}

export default function RulesPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    priority: 1,
    isActive: true,
  });
  const [conditions, setConditions] = useState<ConditionGroup | Condition>({
    logic: 'AND',
    conditions: [],
  } as ConditionGroup);
  const [saving, setSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      categoryId: '',
      priority: 1,
      isActive: true,
    });
    setConditions({
      logic: 'AND',
      conditions: [],
    } as ConditionGroup);
    setShowBuilder(true);
  };

  const handleEditRule = async (rule: Rule) => {
    try {
      // Fetch full rule details including conditions
      const response = await fetch(`/api/rules?id=${rule.id}`);
      if (!response.ok) throw new Error('Failed to fetch rule details');

      const fullRule = await response.json();

      setEditingRule(rule);
      setFormData({
        name: fullRule.name,
        categoryId: fullRule.categoryId,
        priority: fullRule.priority,
        isActive: fullRule.isActive,
      });
      setConditions(fullRule.conditions || { logic: 'AND', conditions: [] } as ConditionGroup);
      setShowBuilder(true);
    } catch (err) {
      toast.error('Failed to load rule details');
      console.error('Error fetching rule:', err);
    }
  };

  const handleSaveRule = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (!formData.categoryId) {
      toast.error('Please select a category');
      return;
    }

    try {
      setSaving(true);

      const method = editingRule ? 'PUT' : 'POST';
      const body = editingRule
        ? {
            id: editingRule.id,
            name: formData.name,
            categoryId: formData.categoryId,
            priority: formData.priority,
            isActive: formData.isActive,
            conditions,
          }
        : {
            name: formData.name,
            categoryId: formData.categoryId,
            priority: formData.priority,
            isActive: formData.isActive,
            conditions,
          };

      const response = await fetch('/api/rules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to save rule');

      toast.success(editingRule ? 'Rule updated successfully' : 'Rule created successfully');
      setShowBuilder(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {!showBuilder ? (
        <>
          <RulesManager
            key={refreshTrigger}
            onCreateRule={handleCreateRule}
            onEditRule={handleEditRule}
          />

          {/* Bulk Apply Rules Section */}
          <BulkApplyRules
            onComplete={(result) => {
              if (result.totalUpdated > 0) {
                toast.success(`Successfully categorized ${result.totalUpdated} transactions!`);
              }
            }}
          />
        </>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Define conditions to automatically categorize transactions
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowBuilder(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Form */}
          <div className="space-y-4 bg-card border border-border rounded-xl p-6">
            {/* Rule Name */}
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Rule Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Grocery Store Purchases"
                className="bg-elevated border-border text-foreground"
              />
            </div>

            {/* Category */}
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">
                Priority (lower number = higher priority)
              </Label>
              <Input
                type="number"
                min="1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                className="bg-elevated border-border text-foreground"
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Conditions</h3>
              <p className="text-sm text-muted-foreground">
                Define when this rule should be applied
              </p>
            </div>
            <RuleBuilder
              initialConditions={conditions}
              onConditionsChange={setConditions}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              onClick={handleSaveRule}
              disabled={saving}
              className="flex-1 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90"
            >
              {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
            <Button
              onClick={() => setShowBuilder(false)}
              variant="outline"
              className="flex-1 bg-elevated border-border text-foreground hover:bg-elevated"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
