'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Edit2,
  Trash2,
  Tags,
} from 'lucide-react';
import { toast } from 'sonner';
import { CategoryForm } from '@/components/categories/category-form';
import { CategoryRow } from '@/components/categories/category-card';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { HouseholdLoadingState } from '@/components/household/household-loading-state';
import { NoHouseholdError } from '@/components/household/no-household-error';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'savings';
  monthlyBudget: number;
  dueDate?: number | null;
  usageCount: number;
  parentId?: string | null;
  isBudgetGroup?: boolean;
  targetAllocation?: number | null;
  isTaxDeductible?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  income:  'var(--color-income)',
  expense: 'var(--color-expense)',
  savings: 'var(--color-primary)',
};

const TYPE_LABELS: Record<string, string> = {
  income:  'Income',
  expense: 'Expense',
  savings: 'Savings',
};

const CATEGORY_TYPES = ['income', 'expense', 'savings'] as const;

// ── Type section ──────────────────────────────────────────────────────────────
function TypeSection({
  type,
  parents,
  regular,
  expandedGroups,
  onToggleGroup,
  onEdit,
  onDelete,
  onAddChild,
  onEditParent,
  onDeleteParent,
}: {
  type: string;
  parents: Category[];
  regular: Category[];
  expandedGroups: Set<string>;
  onToggleGroup: (id: string) => void;
  onEdit: (c: Category) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onEditParent: (c: Category) => void;
  onDeleteParent: (id: string) => void;
}) {
  const color = TYPE_COLORS[type];
  const ungrouped = regular.filter(c => !c.parentId);
  const totalCount = parents.length + regular.length;
  if (totalCount === 0) return null;

  const totalBudget = regular
    .filter(c => c.type === 'expense' && c.monthlyBudget > 0)
    .reduce((s, c) => s + c.monthlyBudget, 0);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="text-[11px] font-bold uppercase tracking-widest shrink-0"
          style={{ color }}
        >
          {TYPE_LABELS[type]}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }} />
        <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
          {regular.length} {regular.length === 1 ? 'category' : 'categories'}
          {totalBudget > 0 && (
            <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 55%, transparent)' }}>
              {' '}· ${totalBudget.toFixed(0)}/mo
            </span>
          )}
        </span>
      </div>

      {/* Connected list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: `1px solid var(--color-border)`, borderLeft: `3px solid ${color}`, backgroundColor: 'var(--color-background)' }}
      >
        {/* Parent groups */}
        {parents.map((parent, pIdx) => {
          const children = regular.filter(c => c.parentId === parent.id);
          const isExpanded = expandedGroups.has(parent.id);
          const isLast = pIdx === parents.length - 1 && ungrouped.length === 0;

          return (
            <div key={parent.id}>
              {/* Parent group header */}
              <div
                className="flex items-center gap-2 px-4 py-2.5"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-elevated) 70%, transparent)',
                  borderBottom: !isLast || isExpanded ? '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' : 'none',
                }}
              >
                {/* Expand toggle */}
                <button
                  onClick={() => onToggleGroup(parent.id)}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
                    : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />}
                  <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-foreground)' }}>
                    {parent.name}
                  </span>
                  {parent.targetAllocation && (
                    <span
                      className="text-[10px] px-1.5 py-px rounded-full shrink-0"
                      style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`, color }}
                    >
                      {parent.targetAllocation}%
                    </span>
                  )}
                  <span className="text-[11px] shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                    {children.length} {children.length === 1 ? 'item' : 'items'}
                  </span>
                </button>

                {/* Group actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onAddChild(parent.id)}
                    className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium transition-colors"
                    style={{ color: color, backgroundColor: `color-mix(in oklch, ${color} 10%, transparent)` }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = `color-mix(in oklch, ${color} 18%, transparent)`)}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = `color-mix(in oklch, ${color} 10%, transparent)`)}
                  >
                    <Plus className="w-2.5 h-2.5" /> Add
                  </button>
                  <button
                    onClick={() => onEditParent(parent)}
                    className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
                    }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteParent(parent.id)}
                    className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-error) 10%, transparent)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Children */}
              {isExpanded && (
                <div>
                  {children.length > 0 ? (
                    children.map((child, ci) => (
                      <CategoryRow
                        key={child.id}
                        category={child}
                        color={color}
                        isChild
                        isLast={ci === children.length - 1 && ungrouped.length === 0 && pIdx === parents.length - 1}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))
                  ) : (
                    <div className="px-10 py-3 text-[12px]" style={{ color: 'var(--color-muted-foreground)', borderBottom: !isLast ? '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' : 'none' }}>
                      No categories in this group.{' '}
                      <button onClick={() => onAddChild(parent.id)} className="underline" style={{ color }}>Add one</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped categories */}
        {ungrouped.map((cat, i) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            color={color}
            isLast={i === ungrouped.length - 1}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}

        {/* Empty state within section */}
        {regular.length === 0 && parents.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>No {TYPE_LABELS[type].toLowerCase()} categories yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [createMode, setCreateMode] = useState<'category' | 'parent'>('category');

  useEffect(() => {
    if (!initialized || householdLoading) return;
    if (!selectedHouseholdId || !householdId) { setLoading(false); return; }
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await fetchWithHousehold('/api/categories');
        if (res.ok) {
          setCategories(await res.json());
        } else {
          const err = await res.json().catch(() => ({ error: 'Failed to load categories' }));
          toast.error(err.error || 'Failed to load categories');
        }
      } catch { toast.error('Error loading categories'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [initialized, householdLoading, selectedHouseholdId, householdId, fetchWithHousehold]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    try {
      setIsSubmitting(true);
      if (selectedCategory?.id) {
        const res = await putWithHousehold(`/api/categories/${selectedCategory.id}`, formData);
        if (res.ok) {
          toast.success('Category updated');
          setCategories(prev => prev.map(c => c.id === selectedCategory.id ? { ...c, ...formData } as Category : c));
          setIsDialogOpen(false); setSelectedCategory(null);
        } else { const e = await res.json(); toast.error(e.error || 'Failed to update'); }
      } else {
        const res = await postWithHousehold('/api/categories', formData);
        if (res.ok) {
          const newCat = await res.json();
          toast.success('Category created');
          setCategories(prev => [...prev, newCat]);
          setIsDialogOpen(false); setSelectedCategory(null);
        } else { const e = await res.json(); toast.error(e.error || 'Failed to create'); }
      }
    } catch { toast.error('Error saving category'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? Transactions will not be affected.')) return;
    try {
      const res = await deleteWithHousehold(`/api/categories/${id}`);
      if (res.ok) { toast.success('Category deleted'); setCategories(prev => prev.filter(c => c.id !== id)); }
      else toast.error('Failed to delete');
    } catch { toast.error('Error deleting category'); }
  };

  const openCreate = (parentId?: string) => {
    setSelectedCategory(parentId ? { parentId } as Category : null);
    setCreateMode('category');
    setIsDialogOpen(true);
  };

  const openCreateParent = () => { setSelectedCategory(null); setCreateMode('parent'); setIsDialogOpen(true); };

  const openEdit = (cat: Category) => {
    setSelectedCategory(cat);
    setCreateMode(cat.isBudgetGroup ? 'parent' : 'category');
    setIsDialogOpen(true);
  };

  const toggleGroup = (id: string) =>
    setExpandedGroups(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  // ── Derived ───────────────────────────────────────────────────────────────
  const parents   = categories.filter(c => c.isBudgetGroup);
  const regular   = categories.filter(c => !c.isBudgetGroup);

  const visibleTypes = filterType === 'all' ? CATEGORY_TYPES : [filterType as typeof CATEGORY_TYPES[number]];

  const incomeCount  = regular.filter(c => c.type === 'income').length;
  const expenseCount = regular.filter(c => c.type === 'expense').length;
  const savingsCount = regular.filter(c => c.type === 'savings').length;
  const total = regular.length;

  // ── Loading / error guards ────────────────────────────────────────────────
  if (!initialized || householdLoading) return <HouseholdLoadingState />;
  if (!selectedHouseholdId || !householdId) return <NoHouseholdError />;

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-28 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="flex gap-2">
              <div className="w-28 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-28 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
              Categories
            </h1>

            {/* Inline type counts */}
            {total > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
                {incomeCount > 0 && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-income)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-income)' }} />
                    {incomeCount}
                  </span>
                )}
                {expenseCount > 0 && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-expense)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-expense)' }} />
                    {expenseCount}
                  </span>
                )}
                {savingsCount > 0 && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                    {savingsCount}
                  </span>
                )}
              </div>
            )}

            <div className="flex-1" />

            {/* Filter pills */}
            <div
              className="hidden sm:flex rounded-lg overflow-hidden shrink-0"
              style={{ border: '1px solid var(--color-border)' }}
            >
              {['all', ...CATEGORY_TYPES].map((f, i) => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className="px-2.5 py-1 text-[11px] font-medium capitalize transition-colors"
                  style={{
                    backgroundColor: filterType === f ? 'var(--color-primary)' : 'transparent',
                    color: filterType === f ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                    borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {f === 'all' ? 'All' : TYPE_LABELS[f]}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-[11px] shrink-0"
              onClick={openCreateParent}
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Group</span>
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 px-3 text-[11px] font-medium shrink-0"
              onClick={() => openCreate()}
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Category</span>
            </Button>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Mobile filter */}
        <div
          className="sm:hidden flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--color-border)' }}
        >
          {['all', ...CATEGORY_TYPES].map((f, i) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className="flex-1 py-1.5 text-[11px] font-medium capitalize transition-colors"
              style={{
                backgroundColor: filterType === f ? 'var(--color-primary)' : 'transparent',
                color: filterType === f ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {f === 'all' ? 'All' : TYPE_LABELS[f]}
            </button>
          ))}
        </div>

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {categories.length === 0 && (
          <div
            className="rounded-xl py-16 text-center"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
            >
              <Tags className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No categories yet</p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>
              Create your first category to start organizing transactions.
            </p>
            <Button
              size="sm"
              onClick={() => openCreate()}
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Category
            </Button>
          </div>
        )}

        {/* ── Type sections ────────────────────────────────────────────────── */}
        {categories.length > 0 && (
          <div className="space-y-6">
            {visibleTypes.map(type => {
              const typeParents  = parents.filter(p => p.type === type);
              const typeRegular  = regular.filter(c => c.type === type);
              return (
                <TypeSection
                  key={type}
                  type={type}
                  parents={typeParents}
                  regular={typeRegular}
                  expandedGroups={expandedGroups}
                  onToggleGroup={toggleGroup}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onAddChild={openCreate}
                  onEditParent={openEdit}
                  onDeleteParent={handleDelete}
                />
              );
            })}

            {/* No results for filter */}
            {visibleTypes.every(type => {
              const p = parents.filter(g => g.type === type);
              const r = regular.filter(c => c.type === type);
              return p.length === 0 && r.length === 0;
            }) && (
              <div
                className="rounded-xl py-12 text-center"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
              >
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                  No {filterType !== 'all' ? TYPE_LABELS[filterType].toLowerCase() : ''} categories found.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: '1rem',
            maxWidth: '34rem',
            boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {selectedCategory?.id
                ? (selectedCategory.isBudgetGroup ? 'Edit Group' : 'Edit Category')
                : (createMode === 'parent' ? 'New Category Group' : 'New Category')}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {createMode === 'parent'
                ? 'Groups organize related categories (e.g., Needs, Wants, Savings for 50/30/20 budgeting).'
                : 'Organize transactions with income, expense, or savings categories.'}
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
            category={selectedCategory}
            onSubmit={handleSubmit}
            onCancel={() => { setIsDialogOpen(false); setSelectedCategory(null); setCreateMode('category'); }}
            isLoading={isSubmitting}
            isParentCategory={createMode === 'parent'}
            parentCategories={parents}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
