'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RuleBuilder } from '@/components/rules/rule-builder';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { nanoid } from 'nanoid';
import type { ConditionGroup, Condition } from '@/lib/rules/condition-evaluator';
import type { RuleAction, SplitConfig } from '@/lib/rules/types';

interface CreateRuleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the condition with this description */
  prefillDescription?: string;
  /** The transaction ID to optionally apply the rule to */
  transactionId?: string;
  /** Callback when a rule is successfully created */
  onRuleCreated?: () => void;
}

export function CreateRuleSheet({
  open,
  onOpenChange,
  prefillDescription,
  transactionId,
  onRuleCreated,
}: CreateRuleSheetProps) {
  const { selectedHouseholdId } = useHousehold();
  const { postWithHousehold, putWithHousehold } = useHouseholdFetch();
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'save' | 'apply-one' | 'apply-all'>('save');

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [priority, setPriority] = useState(1);
  const [actions, setActions] = useState<RuleAction[]>([]);

  // Track a key that changes each time the sheet opens to force RuleBuilder remount
  const [builderKey, setBuilderKey] = useState(0);

  // Create conditions that will be passed to RuleBuilder - computed fresh when sheet opens
  const [conditions, setConditions] = useState<ConditionGroup | Condition>(() => ({
    id: nanoid(),
    logic: 'AND',
    conditions: prefillDescription ? [
      {
        id: nanoid(),
        field: 'description',
        operator: 'contains',
        value: prefillDescription,
      },
    ] : [],
  }));

  // Reset form when sheet opens with prefilled description
  useEffect(() => {
    if (open) {
      // Reset form with new prefill
      setRuleName('');
      setPriority(1);
      setConditions({
        id: nanoid(),
        logic: 'AND',
        conditions: [
          {
            id: nanoid(),
            field: 'description',
            operator: 'contains',
            value: prefillDescription || '',
          },
        ],
      });
      setActions([]);
      // Increment key to force RuleBuilder to remount with new initial conditions
      setBuilderKey(k => k + 1);
    }
  }, [open, prefillDescription]);

  const validateForm = (): boolean => {
    if (!ruleName.trim()) {
      toast.error('Please enter a rule name');
      return false;
    }

    if (actions.length === 0) {
      toast.error('Please add at least one action');
      return false;
    }

    // Validate actions
    for (const action of actions) {
      if (action.type === 'set_category' && !action.value) {
        toast.error('Please select a category for all set_category actions');
        return false;
      }
      if (action.type === 'set_merchant' && !action.value) {
        toast.error('Please select a merchant for all set_merchant actions');
        return false;
      }
      if (action.type.includes('description') && !action.pattern) {
        toast.error('Please enter a pattern for all description actions');
        return false;
      }
      if (action.type === 'convert_to_transfer' && action.config) {
        const { matchTolerance, matchDayRange } = action.config;
        if (typeof matchTolerance === 'number' && (matchTolerance < 0 || matchTolerance > 10)) {
          toast.error('Amount tolerance must be between 0% and 10%');
          return false;
        }
        if (typeof matchDayRange === 'number' && (matchDayRange < 1 || matchDayRange > 30)) {
          toast.error('Date range must be between 1 and 30 days');
          return false;
        }
      }
      if (action.type === 'set_account' && !action.value) {
        toast.error('Please select a target account for set_account action');
        return false;
      }
      if (action.type === 'set_sales_tax' && typeof action.config?.value !== 'boolean') {
        toast.error('Please select whether transactions should be taxable or not taxable');
        return false;
      }
      if (action.type === 'create_split') {
        const splitsValue = (action.config as { splits?: unknown } | undefined)?.splits;
        if (!Array.isArray(splitsValue) || splitsValue.length === 0) {
          toast.error('Split action must have at least one split configured');
          return false;
        }
        const splits = splitsValue as SplitConfig[];
        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];
          if (!split.categoryId) {
            toast.error(`Split ${i + 1}: Category is required`);
            return false;
          }
          if (split.isPercentage) {
            if (!split.percentage || split.percentage <= 0 || split.percentage > 100) {
              toast.error(`Split ${i + 1}: Percentage must be between 0.1% and 100%`);
              return false;
            }
          } else {
            if (!split.amount || split.amount <= 0) {
              toast.error(`Split ${i + 1}: Amount must be greater than 0`);
              return false;
            }
          }
        }
        const totalPercentage = splits
          .filter((s) => s.isPercentage)
          .reduce((sum: number, s) => sum + (s.percentage || 0), 0);
        if (totalPercentage > 100) {
          toast.error('Total split percentage cannot exceed 100%');
          return false;
        }
      }
    }

    if (!selectedHouseholdId) {
      toast.error('Please select a household to save rules');
      return false;
    }

    return true;
  };

  const applyActionsToTransaction = async (txnId: string): Promise<boolean> => {
    // Build update payload from actions
    const updatePayload: Record<string, unknown> = {};

    for (const action of actions) {
      if (action.type === 'set_category' && action.value) {
        updatePayload.categoryId = action.value;
      }
      if (action.type === 'set_merchant' && action.value) {
        updatePayload.merchantId = action.value;
      }
      if (action.type === 'set_description' && action.pattern) {
        updatePayload.description = action.pattern;
      }
      if (action.type === 'set_tax_deduction' && action.config?.value !== undefined) {
        updatePayload.isTaxDeductible = action.config.value;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const response = await putWithHousehold(`/api/transactions/${txnId}`, updatePayload);
      return response.ok;
    }
    return true;
  };

  const handleSave = async (mode: 'save' | 'apply-one' | 'apply-all') => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      setSaveMode(mode);

      // Step 1: Create the rule
      const response = await postWithHousehold('/api/rules', {
        name: ruleName,
        priority,
        isActive: true,
        conditions,
        actions,
      });

      if (!response.ok) throw new Error('Failed to save rule');

      const createdRule = await response.json();

      // Step 2: Apply based on mode
      if (mode === 'apply-one' && transactionId) {
        const success = await applyActionsToTransaction(transactionId);
        if (success) {
          toast.success('Rule created and applied to transaction');
        } else {
          toast.success('Rule created, but failed to apply to transaction');
        }
      } else if (mode === 'apply-all') {
        // Use bulk apply API with the new rule ID
        const bulkResponse = await postWithHousehold(
          `/api/rules/apply-bulk?ruleId=${createdRule.id}&limit=1000`,
          {}
        );

        if (bulkResponse.ok) {
          const result = await bulkResponse.json();
          toast.success(`Rule created and applied to ${result.totalUpdated} matching transactions`);
        } else {
          toast.success('Rule created, but failed to apply to matching transactions');
        }
      } else {
        toast.success('Rule created successfully');
      }

      onOpenChange(false);
      onRuleCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
      setSaveMode('save');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto px-6"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            Create Rule from Transaction
          </SheetTitle>
          <SheetDescription>
            Create a rule to automatically categorize similar transactions in the future.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Rule Name & Priority */}
          <div className="space-y-4 rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <div>
              <Label className="text-sm mb-2 block" style={{ color: 'var(--color-muted-foreground)' }}>Rule Name</Label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g., Amazon Purchases"
                style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              />
            </div>

            <div>
              <Label className="text-sm mb-2 block" style={{ color: 'var(--color-muted-foreground)' }}>
                Priority (lower = higher priority)
              </Label>
              <Input
                type="number"
                min="1"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 1)}
                className="w-24"
                style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              />
            </div>
          </div>

          {/* Prefilled Description Preview */}
          {prefillDescription && (
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Pre-filled from transaction:
              </p>
              <p className="text-sm font-medium mt-1 truncate" style={{ color: 'var(--color-foreground)' }}>
                &ldquo;{prefillDescription}&rdquo;
              </p>
            </div>
          )}

          {/* Rule Builder */}
          <RuleBuilder
            key={builderKey}
            initialConditions={conditions}
            onConditionsChange={setConditions}
            initialActions={actions}
            onActionsChange={setActions}
          />

          {/* Actions */}
          <div className="space-y-3 pt-4 sticky bottom-0 pb-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div className="flex gap-2">
              <Button
                onClick={() => handleSave('save')}
                disabled={saving}
                variant="outline"
                className="flex-1 hover:opacity-90"
                style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              >
                {saving && saveMode === 'save' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Rule'
                )}
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant="ghost"
                style={{ color: 'var(--color-muted-foreground)' }}
                className="hover:opacity-90"
              >
                Cancel
              </Button>
            </div>
            {transactionId && (
              <Button
                onClick={() => handleSave('apply-one')}
                disabled={saving}
                className="w-full hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                {saving && saveMode === 'apply-one' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving & Applying...
                  </>
                ) : (
                  'Save & Apply to This Transaction'
                )}
              </Button>
            )}
            <Button
              onClick={() => handleSave('apply-all')}
              disabled={saving}
              variant="secondary"
              className="w-full"
            >
              {saving && saveMode === 'apply-all' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving & Applying...
                </>
              ) : (
                'Save & Apply to All Matching'
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
