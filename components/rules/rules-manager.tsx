'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, ArrowUp, ArrowDown, Edit2, Trash2, Eye, EyeOff, Plus, Zap, Tag, Store, FileText, ArrowRightLeft, Scissors, Banknote, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { toastInfoWithHelp } from '@/lib/help/toast-with-help';
import { HELP_SECTIONS } from '@/lib/help/help-sections';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import type { RuleAction } from '@/lib/rules/types';

interface Rule {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  actions?: RuleAction[];
  priority: number;
  isActive: boolean;
  matchCount: number;
  lastMatchedAt?: string;
  description?: string;
}

interface CategoryItem {
  id: string;
  name: string;
  type?: string;
}

interface RulesManagerProps {
  onCreateRule?: () => void;
  onEditRule?: (rule: Rule) => void;
  onDeleteRule?: (ruleId: string) => void;
  onToggleRule?: (ruleId: string, isActive: boolean) => void;
  onChangePriority?: (ruleId: string, newPriority: number) => void;
}

// Helper function to get action label
function getActionLabel(action: RuleAction, categoryName?: string, merchantName?: string, accountName?: string): string {
  switch (action.type) {
    case 'set_category':
      return `Category: ${categoryName || 'Unknown'}`;
    case 'set_merchant':
      return `Merchant: ${merchantName || 'Unknown'}`;
    case 'set_description':
      return `Set: "${action.pattern?.substring(0, 30)}${(action.pattern?.length || 0) > 30 ? '...' : ''}"`;
    case 'prepend_description':
      return `Prepend: "${action.pattern}"`;
    case 'append_description':
      return `Append: "${action.pattern}"`;
    case 'set_tax_deduction':
      return 'Tax Deductible';
    case 'set_sales_tax':
      const salesTaxValue = action.config?.value;
      return salesTaxValue === false ? 'Mark Not Taxable' : 'Mark Taxable';
    case 'convert_to_transfer':
      if (action.config?.targetAccountId && accountName) {
        return `Transfer to ${accountName}`;
      }
      return 'Convert to Transfer';
    case 'create_split':
      const splitsValue = (action.config as { splits?: unknown } | undefined)?.splits;
      const splitCount = Array.isArray(splitsValue) ? splitsValue.length : 0;
      return `Split into ${splitCount} ${splitCount === 1 ? 'category' : 'categories'}`;
    case 'set_account':
      return accountName ? `Move to ${accountName}` : 'Set Account';
    default:
      return String(action.type).replace(/_/g, ' ');
  }
}

function RuleCard({
  rule,
  index,
  total,
  onEdit,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
  onApply,
}: {
  rule: Rule;
  index: number;
  total: number;
  onEdit?: (rule: Rule) => void;
  onDelete?: (id: string) => void;
  onToggle?: (id: string, active: boolean) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onApply?: (id: string) => void;
}) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!onApply) return;

    setApplying(true);
    try {
      await onApply(rule.id);
    } finally {
      setApplying(false);
    }
  };
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-card border-border p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Rule Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-foreground text-lg">{rule.name}</h3>
            {!rule.isActive && (
              <Badge variant="outline" className="bg-muted/20 text-foreground border-border">
                Inactive
              </Badge>
            )}
            <Badge className="bg-(--color-primary)/20 text-(--color-primary) border-(--color-primary)">
              Priority {rule.priority}
            </Badge>
          </div>

          {rule.description && (
            <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
          )}

          {/* Action Preview */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {rule.actions && rule.actions.length > 0 ? (
              <>
                {/* Action Count Badge */}
                <Badge className="bg-(--color-primary)/20 text-(--color-primary) border-(--color-primary)/40">
                  <Zap className="w-3 h-3 mr-1" />
                  {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                </Badge>

                {/* First Action Preview */}
                <Badge variant="secondary" className="bg-accent/20 text-accent-foreground border-accent/40">
                  {rule.actions[0].type === 'set_category' && <Tag className="w-3 h-3 mr-1" />}
                  {rule.actions[0].type === 'set_merchant' && <Store className="w-3 h-3 mr-1" />}
                  {rule.actions[0].type === 'set_tax_deduction' && <FileText className="w-3 h-3 mr-1" />}
                  {rule.actions[0].type === 'set_sales_tax' && (
                    rule.actions[0].config?.value === false ? (
                      <XCircle className="w-3 h-3 mr-1 text-(--color-error)" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 mr-1 text-(--color-success)" />
                    )
                  )}
                  {rule.actions[0].type === 'convert_to_transfer' && <ArrowRightLeft className="w-3 h-3 mr-1" />}
                  {rule.actions[0].type === 'create_split' && <Scissors className="w-3 h-3 mr-1 text-(--color-primary)" />}
                  {rule.actions[0].type === 'set_account' && <Banknote className="w-3 h-3 mr-1 text-(--color-primary)" />}
                  {getActionLabel(rule.actions[0], rule.categoryName)}
                </Badge>

                {/* "+X more" Badge */}
                {rule.actions.length > 1 && (
                  <Badge variant="outline" className="bg-elevated text-muted-foreground border-border">
                    +{rule.actions.length - 1} more
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-border">
                No actions
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div>
              <span className="text-muted-foreground font-medium">Matched:</span> {rule.matchCount} times
            </div>
            <div>
              <span className="text-muted-foreground font-medium">Last used:</span> {formatDate(rule.lastMatchedAt)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {/* Priority Controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMoveUp?.(rule.id)}
              disabled={index === 0}
              className="text-muted-foreground hover:text-foreground hover:bg-elevated disabled:opacity-50"
              title="Move up (higher priority)"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMoveDown?.(rule.id)}
              disabled={index === total - 1}
              className="text-muted-foreground hover:text-foreground hover:bg-elevated disabled:opacity-50"
              title="Move down (lower priority)"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>

            {/* Apply Rule */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleApply}
              disabled={applying || !rule.isActive}
              className="text-(--color-warning) hover:bg-(--color-warning)/20 disabled:opacity-50"
              title="Apply this rule to existing uncategorized transactions"
            >
              <Zap className="w-4 h-4" />
            </Button>

            {/* Toggle Active */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggle?.(rule.id, !rule.isActive)}
              className={rule.isActive ? 'text-(--color-income) hover:bg-(--color-income)/20' : 'text-muted-foreground hover:bg-elevated'}
              title={rule.isActive ? 'Deactivate' : 'Activate'}
            >
              {rule.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>

            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit?.(rule)}
              className="text-(--color-primary) hover:bg-(--color-primary)/20"
            >
              <Edit2 className="w-4 h-4" />
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete?.(rule.id)}
              className="text-(--color-error) hover:bg-(--color-error)/20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RulesManager({
  onCreateRule,
  onEditRule,
  onDeleteRule,
  onToggleRule,
  onChangePriority,
}: RulesManagerProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold } = useHouseholdFetch();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/rules');
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();

      // Fetch category names for each rule
      const rulesWithCategories = await Promise.all(
        data.map(async (rule: Rule) => {
          try {
            const catResponse = await fetchWithHousehold('/api/categories');
            if (catResponse.ok) {
              const categories = await catResponse.json();
              const category = categories.find((c: CategoryItem) => c.id === rule.categoryId);
              return { ...rule, categoryName: category?.name || 'Unknown' };
            }
          } catch (err) {
            console.error('Error fetching categories:', err);
          }
          return rule;
        })
      );

      setRules(rulesWithCategories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
      console.error('Error fetching rules:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  // Fetch rules on mount and when household changes
  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      setError('Please select a household to view rules');
      return;
    }
    fetchRules();
  }, [selectedHouseholdId, fetchRules]);

  const handleDelete = async (ruleId: string) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household to delete rules');
      return;
    }

    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await deleteWithHousehold(`/api/rules?id=${ruleId}`);

      if (!response.ok) throw new Error('Failed to delete rule');

      setRules(rules.filter(r => r.id !== ruleId));
      onDeleteRule?.(ruleId);
      toast.success('Rule deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
      toast.error('Failed to delete rule');
    }
  };

  const handleToggle = async (ruleId: string, isActive: boolean) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household to update rules');
      return;
    }

    try {
      const response = await putWithHousehold('/api/rules', { id: ruleId, isActive });

      if (!response.ok) throw new Error('Failed to update rule');

      setRules(rules.map(r => r.id === ruleId ? { ...r, isActive } : r));
      onToggleRule?.(ruleId, isActive);
      toast.success(`Rule ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
      toast.error('Failed to update rule');
    }
  };

  const handleApplyRule = async (ruleId: string) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household to apply rules');
      return;
    }

    try {
      const response = await postWithHousehold(`/api/rules/apply-bulk?ruleId=${ruleId}&limit=100`, {});

      if (!response.ok) throw new Error('Failed to apply rule');

      const result = await response.json();

      if (result.totalUpdated > 0) {
        toast.success(`Applied rule to ${result.totalUpdated} transaction${result.totalUpdated !== 1 ? 's' : ''}`);
        // Refresh rules to update match counts
        fetchRules();
      } else {
        toastInfoWithHelp('No matching uncategorized transactions found', {
          description: 'Rules only apply to transactions without a category.',
          helpSection: HELP_SECTIONS.RULES,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply rule');
    }
  };

  const handleChangePriority = async (ruleId: string, direction: 'up' | 'down') => {
    const ruleIndex = rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return;

    const rule = rules[ruleIndex];
    const otherRule = direction === 'up'
      ? rules[ruleIndex - 1]
      : rules[ruleIndex + 1];

    if (!otherRule) return;

    // Swap priorities
    const newPriority = otherRule.priority;
    const newRules = [...rules];
    newRules[ruleIndex].priority = newPriority;
    newRules[ruleIndex + (direction === 'up' ? -1 : 1)].priority = rule.priority;
    newRules.sort((a, b) => a.priority - b.priority);

    setRules(newRules);

    // Update both rules
    if (!selectedHouseholdId) {
      toast.error('Please select a household to update rule priorities');
      fetchRules(); // Revert on error
      return;
    }

    try {
      await Promise.all([
        putWithHousehold('/api/rules', { id: ruleId, priority: newPriority }),
        putWithHousehold('/api/rules', { id: otherRule.id, priority: rule.priority }),
      ]);

      onChangePriority?.(ruleId, newPriority);
      toast.success('Rule priorities updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priorities');
      toast.error('Failed to update rule priorities');
      // Revert on error
      fetchRules();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading rules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categorization Rules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create rules to automatically categorize transactions
          </p>
        </div>
        <Button
          onClick={onCreateRule}
          className="bg-(--color-primary) text-(--color-primary-foreground) hover:opacity-90 font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-(--color-error)/20 border border-(--color-error)/40 rounded-lg text-(--color-error) text-sm flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card className="bg-card border-border p-8 text-center">
          <div className="text-muted-foreground mb-4">
            <AlertCircle className="w-12 h-12 mx-auto opacity-50 mb-2" />
            <p>No rules created yet</p>
          </div>
          <Button
            onClick={onCreateRule}
            className="bg-(--color-primary) text-(--color-primary-foreground) hover:opacity-90 font-medium"
          >
            Create Your First Rule
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground px-2">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} • Ordered by priority (top = highest priority)
          </div>
          {rules.map((rule, index) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={index}
              total={rules.length}
              onEdit={onEditRule}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onMoveUp={() => handleChangePriority(rule.id, 'up')}
              onMoveDown={() => handleChangePriority(rule.id, 'down')}
              onApply={handleApplyRule}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <Card className="bg-card border-border p-4">
        <div className="text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground mb-2">How Rules Work:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Rules are applied in order by priority (lower number = higher priority)</li>
            <li>The first matching rule&apos;s actions are applied automatically</li>
            <li>Actions can set category, modify description, or set merchant</li>
            <li>Rules only apply to transactions without a manually selected category</li>
            <li>Toggle rules on/off without deleting them</li>
            <li>Match counts help you identify your most effective rules</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
