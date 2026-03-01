'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RulesManager } from '@/components/rules/rules-manager';
import { RuleBuilder } from '@/components/rules/rule-builder';
import { BulkApplyRules } from '@/components/rules/bulk-apply-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertCircle, Plus, Workflow } from 'lucide-react';
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
  const [formData, setFormData] = useState({ name: '', priority: 1, isActive: true });
  const [conditions, setConditions] = useState<ConditionGroup | Condition>({
    logic: 'AND',
    conditions: [],
  } as ConditionGroup);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleCreateRule = () => {
    setEditingRule(null);
    setFormData({ name: '', priority: 1, isActive: true });
    setConditions({ logic: 'AND', conditions: [] } as ConditionGroup);
    setActions([]);
    setShowBuilder(true);
  };

  const handleEditRule = async (rule: Rule) => {
    if (!selectedHouseholdId) { toast.error('Please select a household to edit rules'); return; }
    try {
      const res = await fetchWithHousehold(`/api/rules?id=${rule.id}`);
      if (!res.ok) throw new Error('Failed to fetch rule details');
      const fullRule = await res.json();
      setEditingRule(rule);
      setFormData({ name: fullRule.name, priority: fullRule.priority, isActive: fullRule.isActive });
      setConditions(fullRule.conditions || { logic: 'AND', conditions: [] } as ConditionGroup);
      setActions(fullRule.actions || []);
      setShowBuilder(true);
    } catch { toast.error('Failed to load rule details'); }
  };

  const handleSaveRule = async () => {
    if (!formData.name.trim()) { toast.error('Please enter a rule name'); return; }
    if (actions.length === 0) { toast.error('Please add at least one action'); return; }

    for (const action of actions) {
      if (action.type === 'set_category' && !action.value) { toast.error('Please select a category for all set_category actions'); return; }
      if (action.type === 'set_merchant' && !action.value) { toast.error('Please select a merchant for all set_merchant actions'); return; }
      if (action.type.includes('description') && !action.pattern) { toast.error('Please enter a pattern for all description actions'); return; }
      if (action.type === 'convert_to_transfer' && action.config) {
        const { matchTolerance, matchDayRange } = action.config;
        if (typeof matchTolerance === 'number' && (matchTolerance < 0 || matchTolerance > 10)) { toast.error('Amount tolerance must be between 0% and 10%'); return; }
        if (typeof matchDayRange === 'number' && (matchDayRange < 1 || matchDayRange > 30)) { toast.error('Date range must be between 1 and 30 days'); return; }
      }
      if (action.type === 'set_account' && !action.value) { toast.error('Please select a target account for set_account action'); return; }
      if (action.type === 'set_sales_tax' && typeof action.config?.value !== 'boolean') { toast.error('Please select whether transactions should be taxable or not taxable'); return; }
      if (action.type === 'create_split') {
        const splitsValue = (action.config as { splits?: unknown } | undefined)?.splits;
        if (!Array.isArray(splitsValue) || splitsValue.length === 0) { toast.error('Split action must have at least one split configured'); return; }
        const splits = splitsValue as SplitConfig[];
        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];
          if (!split.categoryId) { toast.error(`Split ${i + 1}: Category is required`); return; }
          if (split.isPercentage) {
            if (!split.percentage || split.percentage <= 0 || split.percentage > 100) { toast.error(`Split ${i + 1}: Percentage must be between 0.1% and 100%`); return; }
          } else {
            if (!split.amount || split.amount <= 0) { toast.error(`Split ${i + 1}: Amount must be greater than 0`); return; }
          }
        }
        const totalPct = splits.filter(s => s.isPercentage).reduce((s, x) => s + (x.percentage || 0), 0);
        if (totalPct > 100) { toast.error('Total split percentage cannot exceed 100%'); return; }
      }
    }
    if (!selectedHouseholdId) { toast.error('Please select a household to save rules'); return; }

    try {
      setSaving(true);
      const body = editingRule
        ? { id: editingRule.id, name: formData.name, priority: formData.priority, isActive: formData.isActive, conditions, actions }
        : { name: formData.name, priority: formData.priority, isActive: formData.isActive, conditions, actions };
      const res = editingRule ? await putWithHousehold('/api/rules', body) : await postWithHousehold('/api/rules', body);
      if (!res.ok) throw new Error('Failed to save rule');
      toast.success(editingRule ? 'Rule updated' : 'Rule created');
      setShowBuilder(false);
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save rule');
    } finally { setSaving(false); }
  };

  if (!selectedHouseholdId) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div
            className="flex gap-3 rounded-xl p-4"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-warning) 30%, var(--color-border))',
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>No household selected</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Select a household from the sidebar to manage rules.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            {showBuilder ? (
              <button
                onClick={() => setShowBuilder(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0"
                style={{ color: 'var(--color-muted-foreground)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
            )}

            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
              {showBuilder ? (editingRule ? `Edit: ${editingRule.name}` : 'New Rule') : 'Rules'}
            </h1>

            <div className="flex-1" />

            {showBuilder ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBuilder(false)}
                  className="h-8 px-3 text-[11px]"
                  style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveRule}
                  disabled={saving}
                  className="h-8 px-3 text-[11px] font-medium"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {saving ? 'Saving…' : editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleCreateRule}
                className="h-8 gap-1.5 px-3 text-[11px] font-medium shrink-0"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Rule</span>
              </Button>
            )}
          </div>
        </div>
        {/* Accent line */}
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
        {!showBuilder ? (
          <div className="space-y-4">
            <RulesManager
              key={refreshTrigger}
              onCreateRule={handleCreateRule}
              onEditRule={handleEditRule}
            />
            <BulkApplyRules
              onComplete={(result) => {
                if (result.totalUpdated > 0) {
                  toast.success(`Categorized ${result.totalUpdated} transactions`);
                }
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rule name + priority */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
            >
              <div
                className="px-4 py-2.5"
                style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)' }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>
                  Rule Settings
                </span>
              </div>
              <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
                    Rule Name
                  </Label>
                  <Input
                    autoFocus
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Grocery Store Purchases"
                    className="h-9 text-[13px]"
                    style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
                    Priority
                    <span className="normal-case font-normal ml-1" style={{ opacity: 0.65 }}>(lower = first)</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.priority}
                    onChange={e => setFormData(p => ({ ...p, priority: parseInt(e.target.value) || 1 }))}
                    className="h-9 text-[13px] font-mono"
                    style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                  />
                </div>
              </div>
            </div>

            {/* Rule builder */}
            <RuleBuilder
              initialConditions={conditions}
              onConditionsChange={setConditions}
              initialActions={actions}
              onActionsChange={setActions}
            />

            {/* Bottom save strip */}
            <div
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
            >
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                {editingRule ? 'Changes will apply to future transactions.' : 'Rules only apply to uncategorized transactions.'}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBuilder(false)}
                  className="h-8 px-3 text-[11px]"
                  style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveRule}
                  disabled={saving}
                  className="h-8 px-4 text-[11px] font-medium"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {saving ? 'Saving…' : editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
