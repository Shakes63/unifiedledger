'use client';

import { useState } from 'react';
import { RulesManager } from '@/components/rules/rules-manager';
import { RuleBuilder } from '@/components/rules/rule-builder';
import { BulkApplyRules } from '@/components/rules/bulk-apply-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import type { ConditionGroup, Condition } from '@/lib/rules/condition-evaluator';
import type { RuleAction, SplitConfig } from '@/lib/rules/types';

interface Rule {
  id: string;
  name: string;
  categoryId?: string;
  actions?: RuleAction[];
  priority: number;
  isActive: boolean;
}

export default function RulesPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold } = useHouseholdFetch();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    priority: 1,
    isActive: true,
  });
  const [conditions, setConditions] = useState<ConditionGroup | Condition>({
    logic: 'AND',
    conditions: [],
  } as ConditionGroup);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreateRule = () => {
    setEditingRule(null);
    setFormData({
      name: '',
      priority: 1,
      isActive: true,
    });
    setConditions({
      logic: 'AND',
      conditions: [],
    } as ConditionGroup);
    setActions([]);
    setShowBuilder(true);
  };

  const handleEditRule = async (rule: Rule) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household to edit rules');
      return;
    }

    try {
      // Fetch full rule details including conditions and actions
      const response = await fetchWithHousehold(`/api/rules?id=${rule.id}`);
      if (!response.ok) throw new Error('Failed to fetch rule details');

      const fullRule = await response.json();

      setEditingRule(rule);
      setFormData({
        name: fullRule.name,
        priority: fullRule.priority,
        isActive: fullRule.isActive,
      });
      setConditions(fullRule.conditions || { logic: 'AND', conditions: [] } as ConditionGroup);
      setActions(fullRule.actions || []);
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

    if (actions.length === 0) {
      toast.error('Please add at least one action');
      return;
    }

    // Validate actions
    for (const action of actions) {
      if (action.type === 'set_category' && !action.value) {
        toast.error('Please select a category for all set_category actions');
        return;
      }
      if (action.type === 'set_merchant' && !action.value) {
        toast.error('Please select a merchant for all set_merchant actions');
        return;
      }
      if (action.type.includes('description') && !action.pattern) {
        toast.error('Please enter a pattern for all description actions');
        return;
      }
      if (action.type === 'convert_to_transfer' && action.config) {
        const { matchTolerance, matchDayRange } = action.config;

        if (typeof matchTolerance === 'number' && (matchTolerance < 0 || matchTolerance > 10)) {
          toast.error('Amount tolerance must be between 0% and 10%');
          return;
        }

        if (typeof matchDayRange === 'number' && (matchDayRange < 1 || matchDayRange > 30)) {
          toast.error('Date range must be between 1 and 30 days');
          return;
        }
      }

      // Validate set_account actions
      if (action.type === 'set_account') {
        if (!action.value) {
          toast.error('Please select a target account for set_account action');
          return;
        }
      }

      // Validate set_sales_tax actions
      if (action.type === 'set_sales_tax') {
        if (typeof action.config?.value !== 'boolean') {
          toast.error('Please select whether transactions should be taxable or not taxable');
          return;
        }
      }

      // Validate create_split actions
      if (action.type === 'create_split') {
        const splitsValue = (action.config as { splits?: unknown } | undefined)?.splits;
        if (!Array.isArray(splitsValue) || splitsValue.length === 0) {
          toast.error('Split action must have at least one split configured');
          return;
        }
        const splits = splitsValue as SplitConfig[];

        // Validate each split
        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];

          // Category required
          if (!split.categoryId) {
            toast.error(`Split ${i + 1}: Category is required`);
            return;
          }

          // Amount validation based on type
          if (split.isPercentage) {
            if (!split.percentage || split.percentage <= 0 || split.percentage > 100) {
              toast.error(`Split ${i + 1}: Percentage must be between 0.1% and 100%`);
              return;
            }
          } else {
            if (!split.amount || split.amount <= 0) {
              toast.error(`Split ${i + 1}: Amount must be greater than 0`);
              return;
            }
          }
        }

        // Validate total percentage doesn't exceed 100%
        const totalPercentage = splits
          .filter((s) => s.isPercentage)
          .reduce((sum: number, s) => sum + (s.percentage || 0), 0);

        if (totalPercentage > 100) {
          toast.error('Total split percentage cannot exceed 100%');
          return;
        }
      }
    }

    if (!selectedHouseholdId) {
      toast.error('Please select a household to save rules');
      return;
    }

    try {
      setSaving(true);

      const body = editingRule
        ? {
            id: editingRule.id,
            name: formData.name,
            priority: formData.priority,
            isActive: formData.isActive,
            conditions,
            actions,
          }
        : {
            name: formData.name,
            priority: formData.priority,
            isActive: formData.isActive,
            conditions,
            actions,
          };

      const response = editingRule
        ? await putWithHousehold('/api/rules', body)
        : await postWithHousehold('/api/rules', body);

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

  // Show warning if no household selected
  if (!selectedHouseholdId) {
    return (
      <div className="p-6">
        <div className="bg-(--color-warning)/20 border border-(--color-warning)/40 rounded-lg p-4 text-(--color-warning) flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">No household selected</p>
            <p className="text-sm mt-1">Please select a household from the sidebar to manage rules.</p>
          </div>
        </div>
      </div>
    );
  }

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

          {/* Conditions & Actions */}
          <RuleBuilder
            initialConditions={conditions}
            onConditionsChange={setConditions}
            initialActions={actions}
            onActionsChange={setActions}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              onClick={handleSaveRule}
              disabled={saving}
              className="flex-1 bg-(--color-primary) text-(--color-primary-foreground) hover:opacity-90"
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
