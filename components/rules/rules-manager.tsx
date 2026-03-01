'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Zap,
  Tag,
  Store,
  FileText,
  ArrowRightLeft,
  Scissors,
  Banknote,
  CheckCircle2,
  XCircle,
  Workflow,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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

interface CategoryItem { id: string; name: string; type?: string; }
interface MerchantItem  { id: string; name: string; }
interface AccountItem   { id: string; name: string; }

interface RulesManagerProps {
  onCreateRule?: () => void;
  onEditRule?: (rule: Rule) => void;
  onDeleteRule?: (ruleId: string) => void;
  onToggleRule?: (ruleId: string, isActive: boolean) => void;
  onChangePriority?: (ruleId: string, newPriority: number) => void;
}

// ── Action label helpers ──────────────────────────────────────────────────────
function getActionLabel(action: RuleAction, categoryName?: string, merchantName?: string, accountName?: string): string {
  switch (action.type) {
    case 'set_category':         return categoryName || 'Set Category';
    case 'set_merchant':         return merchantName || 'Set Merchant';
    case 'set_description':      return `"${(action.pattern || '').substring(0, 22)}${(action.pattern?.length || 0) > 22 ? '…' : ''}"`;
    case 'prepend_description':  return `+${(action.pattern || '').substring(0, 20)}`;
    case 'append_description':   return `${(action.pattern || '').substring(0, 20)}+`;
    case 'set_tax_deduction':    return 'Tax Deductible';
    case 'set_sales_tax':        return action.config?.value === false ? 'Not Taxable' : 'Taxable';
    case 'convert_to_transfer':  return accountName ? `→ ${accountName}` : 'To Transfer';
    case 'create_split': {
      const count = Array.isArray((action.config as { splits?: unknown })?.splits)
        ? (action.config as { splits: unknown[] }).splits.length
        : 0;
      return `Split ×${count}`;
    }
    case 'set_account':          return accountName ? `→ ${accountName}` : 'Set Account';
    default:                     return String(action.type).replace(/_/g, ' ');
  }
}

function ActionIcon({ action }: { action: RuleAction }) {
  const cls = 'w-2.5 h-2.5 shrink-0';
  switch (action.type) {
    case 'set_category':        return <Tag className={cls} />;
    case 'set_merchant':        return <Store className={cls} />;
    case 'set_tax_deduction':   return <FileText className={cls} />;
    case 'set_sales_tax':       return action.config?.value === false
      ? <XCircle className={cls} style={{ color: 'var(--color-error)' }} />
      : <CheckCircle2 className={cls} style={{ color: 'var(--color-income)' }} />;
    case 'convert_to_transfer': return <ArrowRightLeft className={cls} />;
    case 'create_split':        return <Scissors className={cls} />;
    case 'set_account':         return <Banknote className={cls} />;
    default:                    return <Zap className={cls} />;
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  const now = new Date();
  const mins  = Math.floor((now.getTime() - d.getTime()) / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return 'now';
  if (mins < 60)  return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7)   return `${days}d`;
  return d.toLocaleDateString();
}

// ── Rule row ──────────────────────────────────────────────────────────────────
function RuleRow({
  rule,
  index,
  total,
  isLast,
  onEdit,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
  onApply,
  merchantNameById,
  accountNameById,
}: {
  rule: Rule;
  index: number;
  total: number;
  isLast: boolean;
  onEdit?: (rule: Rule) => void;
  onDelete?: (id: string) => void;
  onToggle?: (id: string, active: boolean) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onApply?: (id: string) => void;
  merchantNameById?: Map<string, string>;
  accountNameById?: Map<string, string>;
}) {
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!onApply) return;
    setApplying(true);
    try { await onApply(rule.id); } finally { setApplying(false); }
  };

  const firstAction = rule.actions?.[0];
  const merchantName = firstAction?.type === 'set_merchant' && typeof firstAction.value === 'string'
    ? merchantNameById?.get(firstAction.value) : undefined;
  const accountName = firstAction?.type === 'set_account' && typeof firstAction.value === 'string'
    ? accountNameById?.get(firstAction.value)
    : firstAction?.type === 'convert_to_transfer' && typeof firstAction.config?.targetAccountId === 'string'
      ? accountNameById?.get(firstAction.config.targetAccountId) : undefined;

  const isActive = rule.isActive;

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 transition-colors"
      style={{
        borderBottom: !isLast ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none',
        opacity: isActive ? 1 : 0.55,
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
    >
      {/* Priority number */}
      <span
        className="text-[11px] font-mono font-semibold w-5 text-right shrink-0 select-none"
        style={{ color: 'var(--color-muted-foreground)', opacity: 0.35 }}
      >
        {String(rule.priority).padStart(2, '0')}
      </span>

      {/* Status dot */}
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-border)' }}
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium truncate block" style={{ color: 'var(--color-foreground)' }}>
          {rule.name}
        </span>
      </div>

      {/* First action pill */}
      {firstAction && (
        <div className="hidden sm:flex items-center gap-1 shrink-0 max-w-[160px]">
          <span
            className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded truncate"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)',
              color: 'var(--color-primary)',
            }}
          >
            <ActionIcon action={firstAction} />
            {getActionLabel(firstAction, rule.categoryName, merchantName, accountName)}
          </span>
          {(rule.actions?.length || 0) > 1 && (
            <span className="text-[10px] shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
              +{(rule.actions?.length || 0) - 1}
            </span>
          )}
        </div>
      )}
      {!firstAction && (
        <span
          className="hidden sm:block text-[10px] px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}
        >
          No actions
        </span>
      )}

      {/* Match count */}
      <span
        className="text-[11px] font-mono tabular-nums shrink-0 w-10 text-right hidden md:block"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {rule.matchCount}×
      </span>

      {/* Last matched */}
      <span
        className="text-[11px] tabular-nums shrink-0 w-10 text-right hidden lg:block"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {formatDate(rule.lastMatchedAt)}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Priority up/down */}
        <button
          onClick={() => onMoveUp?.(rule.id)}
          disabled={index === 0}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-25"
          style={{ color: 'var(--color-muted-foreground)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)'; }}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
          title="Higher priority"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
        <button
          onClick={() => onMoveDown?.(rule.id)}
          disabled={index === total - 1}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-25"
          style={{ color: 'var(--color-muted-foreground)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)'; }}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
          title="Lower priority"
        >
          <ArrowDown className="w-3 h-3" />
        </button>

        {/* Thin divider */}
        <div className="w-px h-3 mx-0.5" style={{ backgroundColor: 'var(--color-border)' }} />

        {/* Apply */}
        <button
          onClick={handleApply}
          disabled={applying || !isActive}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-25"
          style={{ color: applying ? 'var(--color-warning)' : 'var(--color-muted-foreground)' }}
          onMouseEnter={e => {
            if (!e.currentTarget.disabled) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-warning) 12%, transparent)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-warning)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
          }}
          title="Apply to existing uncategorized transactions"
        >
          <Zap className={`w-3 h-3 ${applying ? 'animate-pulse' : ''}`} />
        </button>

        {/* Toggle active */}
        <button
          onClick={() => onToggle?.(rule.id, !isActive)}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
          style={{ color: isActive ? 'var(--color-income)' : 'var(--color-muted-foreground)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = isActive ? 'color-mix(in oklch, var(--color-income) 10%, transparent)' : 'var(--color-elevated)')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
          title={isActive ? 'Deactivate' : 'Activate'}
        >
          {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>

        {/* Edit */}
        <button
          onClick={() => onEdit?.(rule)}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--color-muted-foreground)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
          }}
          title="Edit rule"
        >
          <Edit2 className="w-3 h-3" />
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete?.(rule.id)}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--color-muted-foreground)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-error) 10%, transparent)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
          }}
          title="Delete rule"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
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
  const [merchantNameById, setMerchantNameById] = useState<Map<string, string>>(new Map());
  const [accountNameById, setAccountNameById] = useState<Map<string, string>>(new Map());
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const fetchRules = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      const res = await fetchWithHousehold('/api/rules');
      if (!res.ok) throw new Error('Failed to fetch rules');
      const data = await res.json();

      let categories: CategoryItem[] = [];
      try {
        const cr = await fetchWithHousehold('/api/categories');
        if (cr.ok) categories = await cr.json();
      } catch { /* silent */ }

      const catMap = new Map<string, string>(categories.map(c => [c.id, c.name]));

      let mList: MerchantItem[] = [];
      try {
        const mr = await fetchWithHousehold('/api/merchants');
        if (mr.ok) {
          const mj = await mr.json();
          mList = Array.isArray(mj) ? mj : (mj?.data || []);
        }
      } catch { /* silent */ }

      let aList: AccountItem[] = [];
      try {
        const ar = await fetchWithHousehold('/api/accounts');
        if (ar.ok) {
          const aj = await ar.json();
          aList = Array.isArray(aj) ? aj : (aj?.data || []);
        }
      } catch { /* silent */ }

      setMerchantNameById(new Map(mList.map(m => [m.id, m.name])));
      setAccountNameById(new Map(aList.map(a => [a.id, a.name])));
      setRules(data.map((r: Rule) => r.categoryId ? { ...r, categoryName: catMap.get(r.categoryId) || 'Unknown' } : r));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally { setLoading(false); }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) { setLoading(false); setError('Please select a household to view rules'); return; }
    fetchRules();
  }, [selectedHouseholdId, fetchRules]);

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      const res = await deleteWithHousehold(`/api/rules?id=${ruleId}`);
      if (!res.ok) throw new Error('Failed to delete rule');
      setRules(prev => prev.filter(r => r.id !== ruleId));
      onDeleteRule?.(ruleId);
      toast.success('Rule deleted');
    } catch { toast.error('Failed to delete rule'); }
  };

  const handleToggle = async (ruleId: string, isActive: boolean) => {
    try {
      const res = await putWithHousehold('/api/rules', { id: ruleId, isActive });
      if (!res.ok) throw new Error('Failed to update rule');
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive } : r));
      onToggleRule?.(ruleId, isActive);
      toast.success(`Rule ${isActive ? 'activated' : 'deactivated'}`);
    } catch { toast.error('Failed to update rule'); }
  };

  const handleApplyRule = async (ruleId: string) => {
    try {
      const res = await postWithHousehold(`/api/rules/apply-bulk?ruleId=${ruleId}&limit=100`, {});
      if (!res.ok) throw new Error('Failed to apply rule');
      const result = await res.json();
      if (result.totalUpdated > 0) {
        toast.success(`Applied to ${result.totalUpdated} transaction${result.totalUpdated !== 1 ? 's' : ''}`);
        fetchRules();
      } else {
        toastInfoWithHelp('No matching uncategorized transactions found', {
          description: 'Rules only apply to transactions without a category.',
          helpSection: HELP_SECTIONS.RULES,
        });
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to apply rule'); }
  };

  const handleChangePriority = async (ruleId: string, direction: 'up' | 'down') => {
    const idx = rules.findIndex(r => r.id === ruleId);
    if (idx === -1) return;
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const rule = rules[idx], otherRule = rules[otherIdx];
    if (!otherRule) return;
    const curr = rule.priority, other = otherRule.priority;
    const newRules = rules
      .map(r => r.id === rule.id ? { ...r, priority: other } : r.id === otherRule.id ? { ...r, priority: curr } : r)
      .sort((a, b) => a.priority - b.priority);
    setRules(newRules);
    try {
      await Promise.all([
        putWithHousehold('/api/rules', { id: ruleId, priority: other }),
        putWithHousehold('/api/rules', { id: otherRule.id, priority: curr }),
      ]);
      onChangePriority?.(ruleId, other);
      toast.success('Priorities updated');
    } catch { toast.error('Failed to update priorities'); fetchRules(); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-xl animate-pulse"
            style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error */}
      {error && (
        <div
          className="flex gap-2.5 rounded-xl p-3"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--color-error) 8%, transparent)',
            border: '1px solid color-mix(in oklch, var(--color-error) 25%, var(--color-border))',
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
          <p className="text-[12px]" style={{ color: 'var(--color-error)' }}>{error}</p>
        </div>
      )}

      {/* Empty state */}
      {rules.length === 0 && !error && (
        <div
          className="rounded-xl py-14 text-center"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
          >
            <Workflow className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No rules yet</p>
          <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>
            Create rules to automatically categorize transactions.
          </p>
          <button
            onClick={onCreateRule}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            Create First Rule
          </button>
        </div>
      )}

      {/* Rules list */}
      {rules.length > 0 && (
        <div>
          {/* Section label */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest shrink-0" style={{ color: 'var(--color-primary)' }}>
              Active Pipeline
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }} />
            <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
              {rules.length} rule{rules.length !== 1 ? 's' : ''}
              {' · '}
              <span style={{ color: 'var(--color-income)' }}>
                {rules.filter(r => r.isActive).length} active
              </span>
            </span>
          </div>

          {/* Connected list */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-primary)', backgroundColor: 'var(--color-background)' }}
          >
            {/* Column header */}
            <div
              className="flex items-center gap-3 px-4 py-2"
              style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)' }}
            >
              <div className="w-5 shrink-0" />
              <div className="w-1.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>RULE</span>
              </div>
              <div className="w-40 hidden sm:block">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>ACTION</span>
              </div>
              <div className="w-10 text-right hidden md:block">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>MATCHES</span>
              </div>
              <div className="w-10 text-right hidden lg:block">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>LAST</span>
              </div>
              {/* Controls placeholder */}
              <div className="shrink-0" style={{ width: '144px' }} />
            </div>

            {rules.map((rule, i) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                index={i}
                total={rules.length}
                isLast={i === rules.length - 1}
                onEdit={onEditRule}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onMoveUp={() => handleChangePriority(rule.id, 'up')}
                onMoveDown={() => handleChangePriority(rule.id, 'down')}
                onApply={handleApplyRule}
                merchantNameById={merchantNameById}
                accountNameById={accountNameById}
              />
            ))}
          </div>
        </div>
      )}

      {/* How rules work — collapsible */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        <button
          onClick={() => setHowItWorksOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 60%, transparent)')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
          >
            <Workflow className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex-1">
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>How Rules Work</span>
            <span className="text-[11px] ml-2" style={{ color: 'var(--color-muted-foreground)' }}>
              Priority pipeline · first match wins
            </span>
          </div>
          {howItWorksOpen
            ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
            : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />}
        </button>
        {howItWorksOpen && (
          <div
            className="px-4 pb-4"
            style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
          >
            <ul className="mt-3 space-y-1.5">
              {[
                'Rules are evaluated in order by priority — lowest number runs first.',
                'Only the first matching rule\'s actions are applied to each transaction.',
                'Rules only apply to transactions without a manually selected category.',
                'Toggle rules on/off without deleting them.',
                'Use ⚡ to apply a rule retroactively to existing uncategorized transactions.',
                'Match counts show how often each rule has fired.',
              ].map((tip, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <div
                    className="w-1 h-1 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: 'var(--color-muted-foreground)', opacity: 0.4 }}
                  />
                  <span className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
