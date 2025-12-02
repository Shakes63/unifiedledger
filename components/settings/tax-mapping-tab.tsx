'use client';

import { useState, useEffect } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  FileText, 
  AlertCircle,
  ChevronRight,
  Building2,
  User,
} from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';

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
  form_1040: 'Form 1040 (General)',
  other: 'Other',
};

export function TaxMappingTab() {
  const { selectedHouseholdId, fetchWithHousehold } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  
  // Data
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [groupedTaxCategories, setGroupedTaxCategories] = useState<GroupedTaxCategories>({});
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [unmappedTaxDeductible, setUnmappedTaxDeductible] = useState<BudgetCategory[]>([]);
  const [unmappedOther, setUnmappedOther] = useState<BudgetCategory[]>([]);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [formData, setFormData] = useState({
    budgetCategoryId: '',
    taxCategoryId: '',
    allocationPercentage: '100',
    notes: '',
  });

  // Year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Fetch tax categories on mount
  useEffect(() => {
    fetchTaxCategories();
  }, []);

  // Fetch mappings when household or year changes
  useEffect(() => {
    if (selectedHouseholdId) {
      fetchMappings();
    }
  }, [selectedHouseholdId, taxYear]);

  const fetchTaxCategories = async () => {
    try {
      const response = await fetch('/api/tax/categories', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTaxCategories(data.data || []);
        setGroupedTaxCategories(data.grouped || {});
        
        // If no categories exist, show seed option
        if (!data.data || data.data.length === 0) {
          toast.info('No tax categories found. Click "Setup Tax Categories" to add standard IRS categories.');
        }
      }
    } catch (error) {
      console.error('Error fetching tax categories:', error);
      toast.error('Failed to load tax categories');
    }
  };

  const fetchMappings = async () => {
    if (!selectedHouseholdId) return;
    
    setLoading(true);
    try {
      const response = await fetchWithHousehold(`/api/tax/mappings?year=${taxYear}`);
      if (response.ok) {
        const data = await response.json();
        setMappings(data.data || []);
        setUnmappedTaxDeductible(data.unmappedTaxDeductible || []);
        setUnmappedOther(data.unmappedOther || []);
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Failed to load tax mappings');
    } finally {
      setLoading(false);
    }
  };

  const seedTaxCategories = async () => {
    setSeeding(true);
    try {
      const response = await fetch('/api/tax/categories', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Tax categories ready: ${data.created} created, ${data.skipped} already existed`);
        await fetchTaxCategories();
      } else {
        throw new Error('Failed to seed tax categories');
      }
    } catch (error) {
      console.error('Error seeding tax categories:', error);
      toast.error('Failed to setup tax categories');
    } finally {
      setSeeding(false);
    }
  };

  const openCreateDialog = (budgetCategory?: BudgetCategory) => {
    setEditingMapping(null);
    setFormData({
      budgetCategoryId: budgetCategory?.id || '',
      taxCategoryId: '',
      allocationPercentage: '100',
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (mapping: Mapping) => {
    setEditingMapping(mapping);
    setFormData({
      budgetCategoryId: mapping.budgetCategoryId,
      taxCategoryId: mapping.taxCategoryId,
      allocationPercentage: (mapping.allocationPercentage ?? 100).toString(),
      notes: mapping.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!formData.budgetCategoryId || !formData.taxCategoryId) {
      toast.error('Please select both a budget category and tax category');
      return;
    }

    const allocation = parseFloat(formData.allocationPercentage);
    if (isNaN(allocation) || allocation < 0 || allocation > 100) {
      toast.error('Allocation percentage must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      if (editingMapping) {
        // Update existing mapping
        const response = await fetch(`/api/tax/mappings/${editingMapping.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            taxCategoryId: formData.taxCategoryId,
            allocationPercentage: allocation,
            notes: formData.notes || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update mapping');
        }

        toast.success('Mapping updated successfully');
      } else {
        // Create new mapping
        const response = await fetchWithHousehold('/api/tax/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budgetCategoryId: formData.budgetCategoryId,
            taxCategoryId: formData.taxCategoryId,
            taxYear,
            allocationPercentage: allocation,
            notes: formData.notes || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create mapping');
        }

        toast.success('Mapping created successfully');
      }

      setDialogOpen(false);
      await fetchMappings();
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const response = await fetch(`/api/tax/mappings/${mappingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete mapping');
      }

      toast.success('Mapping deleted');
      await fetchMappings();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete mapping');
    }
  };

  const getDeductionTypeBadge = (category: string) => {
    if (category.includes('business')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
          <Building2 className="w-3 h-3" />
          Business
        </span>
      );
    }
    if (category.includes('personal') || category === 'personal_deduction') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success)]/20 text-[var(--color-success)]">
          <User className="w-3 h-3" />
          Personal
        </span>
      );
    }
    return null;
  };

  // Get unmapped categories for the dropdown
  const allUnmappedCategories = [...unmappedTaxDeductible, ...unmappedOther];

  if (loading && !taxCategories.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tax Category Mappings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Map your budget categories to IRS tax categories for automatic deduction tracking in the Tax Dashboard.
        </p>
      </div>

      {/* Setup Section (if no tax categories) */}
      {taxCategories.length === 0 && (
        <Card className="border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <AlertCircle className="w-5 h-5 text-[var(--color-warning)]" />
              Setup Required
            </CardTitle>
            <CardDescription>
              Standard IRS tax categories need to be initialized before you can create mappings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={seedTaxCategories}
              disabled={seeding}
              className="bg-[var(--color-primary)] hover:opacity-90"
            >
              {seeding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Setup Tax Categories
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Year Selector & Actions */}
      {taxCategories.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="taxYear" className="text-foreground whitespace-nowrap">
              Tax Year:
            </Label>
            <Select
              value={taxYear.toString()}
              onValueChange={(v) => setTaxYear(parseInt(v))}
            >
              <SelectTrigger
                id="taxYear"
                name="taxYear"
                aria-label="Select tax year"
                className="w-32 bg-background border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => openCreateDialog()}
            className="bg-[var(--color-primary)] hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Mapping
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && taxCategories.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {/* Mappings List */}
      {!loading && mappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Mapped Categories ({mappings.length})
            </CardTitle>
            <CardDescription>
              Transactions with these categories will be tracked in your Tax Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-elevated/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">
                          {mapping.budgetCategoryName}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">
                          {mapping.taxCategoryName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-elevated rounded">
                          {FORM_TYPE_LABELS[mapping.taxCategoryFormType] || mapping.taxCategoryFormType}
                          {mapping.taxCategoryLineNumber && ` Line ${mapping.taxCategoryLineNumber}`}
                        </span>
                        {getDeductionTypeBadge(mapping.taxCategoryCategory)}
                        {mapping.allocationPercentage !== 100 && (
                          <span className="text-xs text-muted-foreground">
                            ({mapping.allocationPercentage}% allocation)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(mapping)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMapping(mapping.id)}
                      className="text-muted-foreground hover:text-[var(--color-error)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmapped Tax-Deductible Categories */}
      {!loading && unmappedTaxDeductible.length > 0 && (
        <Card className="border-[var(--color-warning)]/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--color-warning)]" />
              Unmapped Tax-Deductible Categories ({unmappedTaxDeductible.length})
            </CardTitle>
            <CardDescription>
              These categories are marked as tax-deductible but not yet mapped to IRS categories
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {unmappedTaxDeductible.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-4 hover:bg-elevated/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{cat.name}</span>
                    {cat.isBusinessCategory && (
                      <span className="text-xs px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded">
                        Business
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCreateDialog(cat)}
                    className="text-[var(--color-primary)] border-[var(--color-primary)]"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Map
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && mappings.length === 0 && unmappedTaxDeductible.length === 0 && taxCategories.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No Tax Mappings Yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Create mappings to automatically track tax deductions when you use specific budget categories.
            </p>
            <Button
              onClick={() => openCreateDialog()}
              className="bg-[var(--color-primary)] hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Mapping
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingMapping ? 'Edit Tax Mapping' : 'Create Tax Mapping'}
            </DialogTitle>
            <DialogDescription>
              {editingMapping
                ? 'Update the tax category mapping for this budget category.'
                : 'Link a budget category to an IRS tax category for automatic tracking.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Budget Category */}
            <div className="space-y-2">
              <Label htmlFor="budgetCategory" className="text-foreground">
                Budget Category
              </Label>
              <Select
                value={formData.budgetCategoryId}
                onValueChange={(v) => setFormData({ ...formData, budgetCategoryId: v })}
                disabled={!!editingMapping}
              >
                <SelectTrigger
                  id="budgetCategory"
                  name="budgetCategory"
                  aria-label="Select budget category"
                  className="bg-background border-border"
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {editingMapping ? (
                    <SelectItem value={editingMapping.budgetCategoryId}>
                      {editingMapping.budgetCategoryName}
                    </SelectItem>
                  ) : (
                    allUnmappedCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <span>{cat.name}</span>
                          {cat.isTaxDeductible && (
                            <span className="text-xs px-1 py-0.5 bg-[var(--color-success)]/20 text-[var(--color-success)] rounded">
                              Tax Deductible
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Tax Category */}
            <div className="space-y-2">
              <Label htmlFor="taxCategory" className="text-foreground">
                IRS Tax Category
              </Label>
              <Select
                value={formData.taxCategoryId}
                onValueChange={(v) => setFormData({ ...formData, taxCategoryId: v })}
              >
                <SelectTrigger
                  id="taxCategory"
                  name="taxCategory"
                  aria-label="Select IRS tax category"
                  className="bg-background border-border"
                >
                  <SelectValue placeholder="Select a tax category" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(groupedTaxCategories).map(([formType, cats]) => (
                    <SelectGroup key={formType}>
                      <SelectLabel className="text-muted-foreground font-semibold">
                        {FORM_TYPE_LABELS[formType] || formType}
                      </SelectLabel>
                      {cats.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <span>{cat.name}</span>
                            {cat.lineNumber && (
                              <span className="text-xs text-muted-foreground">
                                (Line {cat.lineNumber})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Allocation Percentage */}
            <div className="space-y-2">
              <Label htmlFor="allocation" className="text-foreground">
                Allocation Percentage
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="allocation"
                  name="allocation"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.allocationPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, allocationPercentage: e.target.value })
                  }
                  className="bg-background border-border w-24"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                What percentage of transactions in this category should be counted as tax deductible?
                Use 50% for meals (only 50% deductible).
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-foreground">
                Notes (Optional)
              </Label>
              <Input
                id="notes"
                name="notes"
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., Business office supplies"
                className="bg-background border-border"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMapping}
              disabled={saving || !formData.budgetCategoryId || !formData.taxCategoryId}
              className="bg-[var(--color-primary)] hover:opacity-90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingMapping ? 'Save Changes' : 'Create Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

