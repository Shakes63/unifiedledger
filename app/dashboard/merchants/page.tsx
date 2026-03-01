'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  ArrowLeft,
  Search,
  Store,
  Edit2,
  Trash2,
  X,
  ArrowUpDown,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { format, parseISO, isValid } from 'date-fns';

interface Merchant {
  id: string;
  name: string;
  categoryId?: string;
  isSalesTaxExempt?: boolean;
  usageCount: number;
  lastUsedAt?: string;
  totalSpent: number;
  averageTransaction: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

type SortKey = 'name' | 'usage' | 'total' | 'recent';
type SortDir = 'asc' | 'desc';

// ── Merchant initial avatar ───────────────────────────────────────────────────
const AVATAR_COLORS = [
  'var(--color-income)',
  'var(--color-expense)',
  'var(--color-primary)',
  'var(--color-warning)',
  'oklch(65% 0.18 220)',
  'oklch(65% 0.16 300)',
  'oklch(65% 0.15 160)',
  'oklch(65% 0.17 30)',
];

function getAvatarColor(name: string): string {
  const idx = Math.abs(
    name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  ) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function MerchantAvatar({ name }: { name: string }) {
  const color = getAvatarColor(name);
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold select-none"
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
        color,
        border: `1px solid color-mix(in oklch, ${color} 25%, transparent)`,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Column header row ─────────────────────────────────────────────────────────
function ColumnHeader({
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const labels: Record<SortKey, string> = {
    name: 'MERCHANT',
    usage: 'USES',
    total: 'TOTAL',
    recent: 'LAST USED',
  };
  const isActive = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-0.5 transition-colors"
      style={{ color: isActive ? 'var(--color-foreground)' : 'var(--color-muted-foreground)' }}
    >
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${isActive ? 'font-bold' : ''}`}>
        {labels[sortKey]}
      </span>
      <ArrowUpDown
        className="w-2.5 h-2.5"
        style={{ opacity: isActive ? 1 : 0.35, transform: isActive && currentDir === 'asc' ? 'scaleY(-1)' : 'none' }}
      />
    </button>
  );
}

// ── Merchant row ──────────────────────────────────────────────────────────────
function MerchantRow({
  merchant,
  categories,
  isLast,
  onEdit,
  onDelete,
  onToggleTax,
}: {
  merchant: Merchant;
  categories: Category[];
  isLast: boolean;
  onEdit: (m: Merchant) => void;
  onDelete: (id: string) => void;
  onToggleTax: (id: string, val: boolean) => void;
}) {
  const category = categories.find(c => c.id === merchant.categoryId);
  const lastUsed = merchant.lastUsedAt
    ? (() => {
        try {
          const d = parseISO(merchant.lastUsedAt);
          return isValid(d) ? format(d, 'MMM d') : '—';
        } catch { return '—'; }
      })()
    : '—';

  return (
    <div
      className="group flex items-center gap-3 px-4 py-2.5 transition-colors"
      style={{ borderBottom: !isLast ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none' }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
    >
      {/* Avatar */}
      <MerchantAvatar name={merchant.name} />

      {/* Name + badges */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
          {merchant.name}
        </span>
        {merchant.isSalesTaxExempt && (
          <button
            onClick={() => onToggleTax(merchant.id, false)}
            title="Sales tax exempt — click to remove"
            className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-px rounded shrink-0 transition-opacity hover:opacity-70"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-income) 12%, transparent)',
              color: 'var(--color-income)',
            }}
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            Tax
          </button>
        )}
        <EntityIdBadge id={merchant.id} label="Mer" />
      </div>

      {/* Category */}
      <div className="w-28 shrink-0 hidden sm:block">
        {category ? (
          <span
            className="text-[11px] px-1.5 py-px rounded truncate block max-w-full"
            style={{
              backgroundColor: 'var(--color-elevated)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            {category.name}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 40%, transparent)' }}>—</span>
        )}
      </div>

      {/* Last used */}
      <span
        className="text-[11px] tabular-nums shrink-0 w-14 text-right hidden md:block"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {lastUsed}
      </span>

      {/* Usage */}
      <span
        className="text-[12px] font-mono tabular-nums shrink-0 w-10 text-right"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {merchant.usageCount}×
      </span>

      {/* Total spent */}
      <span
        className="text-[12px] font-mono tabular-nums shrink-0 w-20 text-right"
        style={{ color: merchant.totalSpent > 0 ? 'var(--color-foreground)' : 'var(--color-muted-foreground)' }}
      >
        ${(merchant.totalSpent || 0).toFixed(0)}
      </span>

      {/* Avg transaction */}
      <span
        className="text-[11px] font-mono tabular-nums shrink-0 w-16 text-right hidden lg:block"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        ${(merchant.averageTransaction || 0).toFixed(0)}
      </span>

      {/* Actions — hover revealed */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-14 justify-end">
        {!merchant.isSalesTaxExempt && (
          <button
            onClick={() => onToggleTax(merchant.id, true)}
            title="Mark as sales tax exempt"
            className="w-6 h-6 rounded flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-muted-foreground)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-income) 10%, transparent)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-income)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)';
            }}
          >
            <ShieldCheck className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={() => onEdit(merchant)}
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
          onClick={() => onDelete(merchant.id)}
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
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MerchantsPage() {
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold, selectedHouseholdId } = useHouseholdFetch();

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', categoryId: '', isSalesTaxExempt: false });

  // Search + sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('usage');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    if (!selectedHouseholdId) { setLoading(false); return; }
    const load = async () => {
      try {
        setLoading(true);
        const [mr, cr] = await Promise.all([
          fetchWithHousehold('/api/merchants?limit=1000'),
          fetchWithHousehold('/api/categories'),
        ]);
        if (mr.ok) {
          const d = await mr.json();
          setMerchants(Array.isArray(d) ? d : (d.data || []));
        } else { toast.error('Failed to load merchants'); }
        if (cr.ok) setCategories(await cr.json());
      } catch { toast.error('Error loading data'); }
      finally { setLoading(false); }
    };
    load();
  }, [selectedHouseholdId, fetchWithHousehold]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Merchant name is required'); return; }
    try {
      setIsSubmitting(true);
      const body = { name: formData.name, categoryId: formData.categoryId || null, isSalesTaxExempt: formData.isSalesTaxExempt };
      if (selectedMerchant) {
        const res = await putWithHousehold(`/api/merchants/${selectedMerchant.id}`, body);
        if (res.ok) {
          const updated = await res.json();
          toast.success('Merchant updated');
          setMerchants(prev => prev.map(m => m.id === selectedMerchant.id ? updated : m));
          closeDialog();
        } else { const e = await res.json(); toast.error(e.error || 'Failed to update'); }
      } else {
        const res = await postWithHousehold('/api/merchants', body);
        if (res.ok) {
          const created = await res.json();
          toast.success('Merchant created');
          setMerchants(prev => [created, ...prev]);
          closeDialog();
        } else { const e = await res.json(); toast.error(e.error || 'Failed to create'); }
      }
    } catch { toast.error('Error saving merchant'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this merchant? This cannot be undone.')) return;
    try {
      const res = await deleteWithHousehold(`/api/merchants/${id}`);
      if (res.ok) { toast.success('Merchant deleted'); setMerchants(prev => prev.filter(m => m.id !== id)); }
      else { const e = await res.json(); toast.error(e.error || 'Failed to delete'); }
    } catch { toast.error('Error deleting merchant'); }
  };

  const handleToggleTax = async (id: string, val: boolean) => {
    try {
      const res = await putWithHousehold(`/api/merchants/${id}`, { isSalesTaxExempt: val });
      if (res.ok) {
        const updated = await res.json();
        setMerchants(prev => prev.map(m => m.id === id ? updated : m));
        toast.success(val ? 'Marked as tax exempt' : 'Tax exempt removed');
      }
    } catch { toast.error('Error updating merchant'); }
  };

  const openEdit = (m: Merchant) => {
    setSelectedMerchant(m);
    setFormData({ name: m.name, categoryId: m.categoryId || '', isSalesTaxExempt: m.isSalesTaxExempt || false });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setSelectedMerchant(null);
    setFormData({ name: '', categoryId: '', isSalesTaxExempt: false });
    setIsDialogOpen(true);
  };

  const closeDialog = () => { setIsDialogOpen(false); setSelectedMerchant(null); setFormData({ name: '', categoryId: '', isSalesTaxExempt: false }); };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // ── Filtered + sorted list ──────────────────────────────────────────────────
  const displayList = useMemo(() => {
    let list = merchants;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name')   cmp = a.name.localeCompare(b.name);
      if (sortKey === 'usage')  cmp = (b.usageCount || 0) - (a.usageCount || 0);
      if (sortKey === 'total')  cmp = (b.totalSpent || 0) - (a.totalSpent || 0);
      if (sortKey === 'recent') {
        const da = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const db_ = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        cmp = db_ - da;
      }
      return sortDir === 'asc' ? -cmp : cmp;
    });
  }, [merchants, searchQuery, sortKey, sortDir]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalSpend   = merchants.reduce((s, m) => s + (m.totalSpent || 0), 0);
  const totalUses    = merchants.reduce((s, m) => s + (m.usageCount || 0), 0);
  const avgTx        = totalUses > 0 ? totalSpend / totalUses : 0;
  const topMerchant  = merchants.length > 0 ? [...merchants].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))[0] : null;

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-24 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="w-28 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-11 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 60}ms` }} />
          ))}
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
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            <h1 className="text-lg font-semibold tracking-tight shrink-0" style={{ color: 'var(--color-foreground)' }}>
              Merchants
            </h1>

            {merchants.length > 0 && (
              <span
                className="text-[11px] font-mono tabular-nums px-1.5 py-px rounded shrink-0"
                style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}
              >
                {merchants.length}
              </span>
            )}

            {/* Inline search */}
            <div className="flex-1 relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--color-muted-foreground)' }} />
              <input
                type="text"
                placeholder="Search merchants…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg text-[12px] outline-none transition-colors"
                style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1" />

            <Button
              size="sm"
              onClick={openCreate}
              className="h-8 gap-1.5 px-3 text-[11px] font-medium shrink-0"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Merchant</span>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        {merchants.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div className="grid grid-cols-4 divide-x" style={{ ['--tw-divide-opacity' as string]: '1' }}>
              {[
                { label: 'Merchants', value: String(merchants.length) },
                { label: 'Total Spend', value: `$${totalSpend.toFixed(0)}` },
                { label: 'Transactions', value: String(totalUses) },
                { label: 'Avg. Transaction', value: `$${avgTx.toFixed(2)}` },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="px-4 py-3 text-center"
                  style={{ borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none' }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    {stat.label}
                  </p>
                  <p className="text-[15px] font-mono font-semibold tabular-nums" style={{ color: 'var(--color-foreground)' }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            {topMerchant && (
              <div
                className="px-4 py-2 flex items-center gap-2"
                style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)' }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
                  Top Spender
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 40%, transparent)' }} />
                <MerchantAvatar name={topMerchant.name} />
                <span className="text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>{topMerchant.name}</span>
                <span className="text-[12px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                  ${(topMerchant.totalSpent || 0).toFixed(0)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {merchants.length === 0 && (
          <div
            className="rounded-xl py-16 text-center"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
            >
              <Store className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No merchants yet</p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>
              Merchants are created automatically when you add transactions, or create one manually.
            </p>
            <Button
              size="sm"
              onClick={openCreate}
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Merchant
            </Button>
          </div>
        )}

        {/* ── Merchant list ─────────────────────────────────────────────────── */}
        {merchants.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            {/* Column headers + sort */}
            <div
              className="flex items-center gap-3 px-4 py-2"
              style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)' }}
            >
              <div className="w-7 shrink-0" />
              <div className="flex-1">
                <ColumnHeader sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-28 shrink-0 hidden sm:block">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>CATEGORY</span>
              </div>
              <div className="w-14 shrink-0 hidden md:block">
                <ColumnHeader sortKey="recent" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-10 shrink-0">
                <ColumnHeader sortKey="usage" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-20 shrink-0 text-right">
                <ColumnHeader sortKey="total" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              </div>
              <div className="w-16 shrink-0 hidden lg:block">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>AVG</span>
              </div>
              <div className="w-14 shrink-0" />
            </div>

            {/* Rows */}
            {displayList.length > 0 ? (
              displayList.map((merchant, i) => (
                <MerchantRow
                  key={merchant.id}
                  merchant={merchant}
                  categories={categories}
                  isLast={i === displayList.length - 1}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onToggleTax={handleToggleTax}
                />
              ))
            ) : (
              <div className="py-10 text-center">
                <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  No merchants match &ldquo;{searchQuery}&rdquo;.
                </p>
                <button onClick={() => setSearchQuery('')} className="text-[12px] mt-1 underline" style={{ color: 'var(--color-primary)' }}>
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          style={{
            color: 'var(--color-foreground)',
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: '1rem',
            maxWidth: '26rem',
            boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {selectedMerchant ? 'Edit Merchant' : 'New Merchant'}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {selectedMerchant
                ? 'Update the merchant name, default category, or tax status.'
                : 'Add a vendor to enable auto-categorization on future transactions.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                Merchant Name
              </Label>
              <Input
                autoFocus
                placeholder="e.g., Amazon, Starbucks"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="h-9 text-[13px]"
                style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              />
            </div>

            {/* Default category */}
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                Default Category
              </Label>
              <Select
                value={formData.categoryId || 'none'}
                onValueChange={v => setFormData(p => ({ ...p, categoryId: v === 'none' ? '' : v }))}
              >
                <SelectTrigger
                  className="h-9 text-[13px]"
                  style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                >
                  <SelectValue placeholder="None (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                New transactions from this merchant will auto-apply this category.
              </p>
            </div>

            {/* Tax exempt toggle */}
            <div
              className="flex items-center justify-between rounded-lg px-3 py-2.5"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}
            >
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Sales Tax Exempt</p>
                <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Exclude from sales tax calculations</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, isSalesTaxExempt: !p.isSalesTaxExempt }))}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                style={{ backgroundColor: formData.isSalesTaxExempt ? 'var(--color-income)' : 'var(--color-border)' }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{ transform: formData.isSalesTaxExempt ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="flex-1 h-9 text-[13px] font-medium"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                {isSubmitting ? 'Saving…' : selectedMerchant ? 'Update Merchant' : 'Create Merchant'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                className="h-9 px-4 text-[13px]"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
