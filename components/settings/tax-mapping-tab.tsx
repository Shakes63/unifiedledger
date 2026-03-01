'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Loader2, Plus, Pencil, Trash2, FileText, AlertCircle,
  ChevronRight, Building2, User, Receipt,
} from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface TaxCategory {
  id: string;
  name: string;
  description: string | null;
  formType: string;
  lineNumber: string | null;
  category: string;
  deductible: boolean | null;
}

interface Mapping {
  id: string;
  budgetCategoryId: string;
  budgetCategoryName: string;
  budgetCategoryType: string;
  taxCategoryId: string;
  taxCategoryName: string;
  taxCategoryFormType: string;
  taxCategoryLineNumber: string | null;
  taxCategoryCategory: string;
  taxYear: number;
  allocationPercentage: number | null;
  notes: string | null;
}

interface BudgetCategory {
  id: string;
  name: string;
  type: string;
  isTaxDeductible: boolean;
  isBusinessCategory: boolean;
}

interface GroupedTaxCategories {
  [formType: string]: TaxCategory[];
}

const FORM_TYPE_LABELS: Record<string, string> = {
  schedule_c: 'Schedule C (Business)',
  schedule_a: 'Schedule A (Itemized)',
  schedule_d: 'Schedule D (Capital Gains)',
  schedule_e: 'Schedule E (Rental)',
  form_1040:  'Form 1040 (General)',
  other:      'Other',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  action,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string | React.ReactNode;
  accent?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest flex-1" style={{ color: accent }}>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function DeductionBadge({ category }: { category: string }) {
  if (category.includes('business')) return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>
      <Building2 className="w-2.5 h-2.5" /> Business
    </span>
  );
  if (category.includes('personal') || category === 'personal_deduction') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}>
      <User className="w-2.5 h-2.5" /> Personal
    </span>
  );
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TaxMappingTab() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());

  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [groupedTaxCategories, setGroupedTaxCategories] = useState<GroupedTaxCategories>({});
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [unmappedTaxDeductible, setUnmappedTaxDeductible] = useState<BudgetCategory[]>([]);
  const [unmappedOther, setUnmappedOther] = useState<BudgetCategory[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [formData, setFormData] = useState({ budgetCategoryId: '', taxCategoryId: '', allocationPercentage: '100', notes: '' });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const allUnmappedCategories = [...unmappedTaxDeductible, ...unmappedOther];

  useEffect(() => { fetchTaxCategories(); }, []);

  const fetchTaxCategories = async () => {
    try {
      const res = await fetch('/api/tax/categories', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setTaxCategories(d.data || []);
        setGroupedTaxCategories(d.grouped || {});
        if (!d.data || d.data.length === 0) {
          toast.info('No tax categories found. Click "Setup Tax Categories" to add standard IRS categories.');
        }
      }
    } catch { toast.error('Failed to load tax categories'); }
  };

  const fetchMappings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    setLoading(true);
    try {
      const res = await fetchWithHousehold(`/api/tax/mappings?year=${taxYear}`);
      if (res.ok) {
        const d = await res.json();
        setMappings(d.data || []);
        setUnmappedTaxDeductible(d.unmappedTaxDeductible || []);
        setUnmappedOther(d.unmappedOther || []);
      }
    } catch { toast.error('Failed to load tax mappings'); }
    finally { setLoading(false); }
  }, [fetchWithHousehold, selectedHouseholdId, taxYear]);

  useEffect(() => {
    if (selectedHouseholdId) fetchMappings();
  }, [selectedHouseholdId, taxYear, fetchMappings]);

  const seedTaxCategories = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/tax/categories', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        toast.success(`Tax categories ready: ${d.created} created, ${d.skipped} already existed`);
        await fetchTaxCategories();
      } else throw new Error('Failed');
    } catch { toast.error('Failed to setup tax categories'); }
    finally { setSeeding(false); }
  };

  const openCreateDialog = (cat?: BudgetCategory) => {
    setEditingMapping(null);
    setFormData({ budgetCategoryId: cat?.id || '', taxCategoryId: '', allocationPercentage: '100', notes: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (m: Mapping) => {
    setEditingMapping(m);
    setFormData({ budgetCategoryId: m.budgetCategoryId, taxCategoryId: m.taxCategoryId, allocationPercentage: (m.allocationPercentage ?? 100).toString(), notes: m.notes || '' });
    setDialogOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!formData.budgetCategoryId || !formData.taxCategoryId) { toast.error('Please select both categories'); return; }
    const allocation = parseFloat(formData.allocationPercentage);
    if (isNaN(allocation) || allocation < 0 || allocation > 100) { toast.error('Allocation must be 0–100'); return; }
    setSaving(true);
    try {
      if (editingMapping) {
        const res = await fetch(`/api/tax/mappings/${editingMapping.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ taxCategoryId: formData.taxCategoryId, allocationPercentage: allocation, notes: formData.notes || null }) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Mapping updated');
      } else {
        const res = await fetchWithHousehold('/api/tax/mappings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ budgetCategoryId: formData.budgetCategoryId, taxCategoryId: formData.taxCategoryId, taxYear, allocationPercentage: allocation, notes: formData.notes || null }) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        toast.success('Mapping created');
      }
      setDialogOpen(false);
      await fetchMappings();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save mapping'); }
    finally { setSaving(false); }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Delete this mapping?')) return;
    try {
      const res = await fetch(`/api/tax/mappings/${mappingId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Mapping deleted');
      await fetchMappings();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to delete'); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !taxCategories.length) {
    return (
      <div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }} />
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Setup required ────────────────────────────────────────────── */}
      {taxCategories.length === 0 && (
        <div
          className="rounded-xl px-4 py-5 flex items-start gap-3"
          style={{ border: '1px solid color-mix(in oklch, var(--color-warning) 40%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-warning) 7%, transparent)', borderLeft: '3px solid var(--color-warning)' }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Setup Required</p>
              <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Standard IRS tax categories need to be initialized before you can create mappings.</p>
            </div>
            <Button onClick={seedTaxCategories} disabled={seeding} size="sm" className="text-[12px] h-8 px-4 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {seeding ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Setting up…</> : <><FileText className="w-3.5 h-3.5 mr-1.5" /> Setup Tax Categories</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Year selector + Add button ────────────────────────────────── */}
      {taxCategories.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="taxYear" className="text-[12px] font-medium whitespace-nowrap" style={{ color: 'var(--color-muted-foreground)' }}>Tax Year</Label>
            <Select value={taxYear.toString()} onValueChange={v => setTaxYear(parseInt(v))}>
              <SelectTrigger id="taxYear" name="taxYear" aria-label="Select tax year" className="h-8 w-24 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => openCreateDialog()} size="sm" className="text-[12px] h-8 px-3 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Mapping
          </Button>
        </div>
      )}

      {/* ── Loading (data only) ───────────────────────────────────────── */}
      {loading && taxCategories.length > 0 && (
        <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }} />
      )}

      {/* ── Mapped categories ─────────────────────────────────────────── */}
      {!loading && mappings.length > 0 && (
        <Section
          icon={FileText}
          label={`Mapped Categories · ${mappings.length}`}
          action={<span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Tax year {taxYear}</span>}
        >
          <div className="divide-y" style={{ borderColor: 'color-mix(in oklch, var(--color-border) 45%, transparent)' }}>
            {mappings.map(m => (
              <div key={m.id} className="px-4 py-3 flex items-center gap-3 group transition-colors" onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 30%, transparent)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{m.budgetCategoryName}</span>
                    <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
                    <span className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>{m.taxCategoryName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}>
                      {FORM_TYPE_LABELS[m.taxCategoryFormType] || m.taxCategoryFormType}
                      {m.taxCategoryLineNumber && ` Line ${m.taxCategoryLineNumber}`}
                    </span>
                    <DeductionBadge category={m.taxCategoryCategory} />
                    {m.allocationPercentage !== 100 && (
                      <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>({m.allocationPercentage}% allocation)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditDialog(m)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ color: 'var(--color-muted-foreground)' }} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteMapping(m.id)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ color: 'var(--color-destructive)' }} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Unmapped tax-deductible categories ───────────────────────── */}
      {!loading && unmappedTaxDeductible.length > 0 && (
        <Section
          icon={AlertCircle}
          label={`Unmapped Tax-Deductible · ${unmappedTaxDeductible.length}`}
          accent="var(--color-warning)"
        >
          <div className="divide-y" style={{ borderColor: 'color-mix(in oklch, var(--color-border) 45%, transparent)' }}>
            {unmappedTaxDeductible.map(cat => (
              <div key={cat.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{cat.name}</span>
                  {cat.isBusinessCategory && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>Business</span>
                  )}
                </div>
                <Button onClick={() => openCreateDialog(cat)} size="sm" variant="outline" className="h-7 px-2.5 text-[12px] shrink-0" style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}>
                  <Plus className="w-3 h-3 mr-1" /> Map
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!loading && mappings.length === 0 && unmappedTaxDeductible.length === 0 && taxCategories.length > 0 && (
        <div className="rounded-xl py-12 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-3" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)' }}>
            <Receipt className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No Tax Mappings Yet</p>
          <p className="text-[12px] mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
            Create mappings to automatically track tax deductions when you use specific categories.
          </p>
          <Button onClick={() => openCreateDialog()} size="sm" className="text-[12px] h-8 px-4 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Mapping
          </Button>
        </div>
      )}

      {/* ── Create / Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '1rem', maxWidth: '28rem', boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)' }}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {editingMapping ? 'Edit Tax Mapping' : 'Create Tax Mapping'}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {editingMapping ? 'Update the tax category mapping.' : 'Link a budget category to an IRS tax category.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="budgetCategory" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Budget Category</Label>
              <Select value={formData.budgetCategoryId} onValueChange={v => setFormData({ ...formData, budgetCategoryId: v })} disabled={!!editingMapping}>
                <SelectTrigger id="budgetCategory" name="budgetCategory" aria-label="Select budget category" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {editingMapping
                    ? <SelectItem value={editingMapping.budgetCategoryId}>{editingMapping.budgetCategoryName}</SelectItem>
                    : allUnmappedCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            {cat.name}
                            {cat.isTaxDeductible && <span className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}>Deductible</span>}
                          </div>
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="taxCategory" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>IRS Tax Category</Label>
              <Select value={formData.taxCategoryId} onValueChange={v => setFormData({ ...formData, taxCategoryId: v })}>
                <SelectTrigger id="taxCategory" name="taxCategory" aria-label="Select IRS tax category" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                  <SelectValue placeholder="Select a tax category" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(groupedTaxCategories).map(([formType, cats]) => (
                    <SelectGroup key={formType}>
                      <SelectLabel className="text-[11px] font-semibold" style={{ color: 'var(--color-muted-foreground)' }}>{FORM_TYPE_LABELS[formType] || formType}</SelectLabel>
                      {cats.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-1.5">
                            {cat.name}
                            {cat.lineNumber && <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Line {cat.lineNumber}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="allocation" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Allocation %</Label>
              <div className="flex items-center gap-2">
                <Input id="allocation" name="allocation" type="number" min="0" max="100" value={formData.allocationPercentage} onChange={e => setFormData({ ...formData, allocationPercentage: e.target.value })} className="h-9 w-24 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
                <span className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>% of transactions counted as deductible (50% for meals)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Notes (Optional)</Label>
              <Input id="notes" name="notes" type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="e.g., Business office supplies" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-[13px]" style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}>Cancel</Button>
            <Button onClick={handleSaveMapping} disabled={saving || !formData.budgetCategoryId || !formData.taxCategoryId} className="text-[13px] font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingMapping ? 'Save Changes' : 'Create Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
