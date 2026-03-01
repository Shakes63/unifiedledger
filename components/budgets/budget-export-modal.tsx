'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { getLocalMonthString } from '@/lib/utils/local-date';

interface BudgetExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string; // YYYY-MM format
}

export function BudgetExportModal({
  isOpen,
  onClose,
  currentMonth,
}: BudgetExportModalProps) {
  const { selectedHouseholdId: _selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeVariableBills, setIncludeVariableBills] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'income' | 'expenses' | 'savings'>('all');
  const [exporting, setExporting] = useState(false);

  // Generate list of months for selection (last 24 months + current month + next 12 months)
  const generateMonthOptions = () => {
    const options: Array<{ value: string; label: string }> = [];
    const now = new Date();

    // Generate from 24 months ago to 12 months in future
    for (let i = -24; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = getLocalMonthString(date); // YYYY-MM
      const label = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      options.push({ value, label });
    }

    return options;
  };

  const monthOptions = generateMonthOptions();

  // Calculate preview info
  const getPreviewInfo = () => {
    const start = new Date(startMonth + '-01');
    const end = new Date(endMonth + '-01');

    if (start > end) {
      return { valid: false, message: 'Start month cannot be after end month' };
    }

    const monthDiff =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1;

    if (monthDiff > 12) {
      return {
        valid: false,
        message: 'Cannot export more than 12 months at a time',
      };
    }

    return {
      valid: true,
      message: `Exporting ${monthDiff} month${monthDiff > 1 ? 's' : ''} of budget data`,
    };
  };

  const preview = getPreviewInfo();

  const handleExport = async () => {
    if (!preview.valid) {
      toast.error(preview.message);
      return;
    }

    try {
      setExporting(true);

      // Build query parameters
      const params = new URLSearchParams({
        startMonth,
        endMonth,
        includeSummary: includeSummary ? 'true' : 'false',
        includeVariableBills: includeVariableBills ? 'true' : 'false',
      });

      // Add category filter if not 'all'
      if (categoryFilter !== 'all') {
        let types: string[] = [];
        switch (categoryFilter) {
          case 'income':
            types = ['income'];
            break;
          case 'expenses':
            types = ['expense'];
            break;
          case 'savings':
            types = ['savings'];
            break;
        }
        if (types.length > 0) {
          params.append('categoryTypes', types.join(','));
        }
      }

      // Trigger download
      const url = `/api/budgets/export?${params.toString()}`;
      const response = await fetchWithHousehold(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export budget data');
      }

      // Download the CSV
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `budget-export-${startMonth}${startMonth !== endMonth ? `-to-${endMonth}` : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast.success('Budget data exported successfully!');
      onClose();
    } catch (error) {
      console.error('Error exporting budget:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export budget');
    } finally {
      setExporting(false);
    }
  };

  const fs = { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' };
  const lbl = 'text-[11px] font-medium uppercase tracking-wide block mb-1.5';
  const lblS = { color: 'var(--color-muted-foreground)' };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}>
              <Download className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
            </div>
            Export Budget Data
          </DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Download your budget data as a CSV file for external analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={lblS} htmlFor="start-month">Start Month</label>
              <select id="start-month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-[13px] h-9" style={fs}>
                {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl} style={lblS} htmlFor="end-month">End Month</label>
              <select id="end-month" value={endMonth} onChange={e => setEndMonth(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-[13px] h-9" style={fs}>
                {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl} style={lblS} htmlFor="category-filter">Category Filter</label>
            <select id="category-filter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as 'all' | 'income' | 'expenses' | 'savings')}
              className="w-full rounded-lg px-3 py-2 text-[13px] h-9" style={fs}>
              <option value="all">All Categories</option>
              <option value="income">Income Only</option>
              <option value="expenses">Expenses Only</option>
              <option value="savings">Savings Only</option>
            </select>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {[
              { id: 'include-summary', checked: includeSummary, onChange: setIncludeSummary, label: 'Include summary row' },
              { id: 'include-variable-bills', checked: includeVariableBills, onChange: setIncludeVariableBills, label: 'Include variable bills section' },
            ].map(({ id, checked, onChange, label }, i, arr) => (
              <div key={id} className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: 'var(--color-elevated)', borderBottom: i < arr.length - 1 ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none' }}>
                <Checkbox id={id} checked={checked} onCheckedChange={v => onChange(v as boolean)} />
                <label htmlFor={id} className="text-[13px] cursor-pointer" style={{ color: 'var(--color-foreground)' }}>{label}</label>
              </div>
            ))}
          </div>

          <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: preview.valid ? 'color-mix(in oklch, var(--color-primary) 6%, transparent)' : 'color-mix(in oklch, var(--color-destructive) 6%, transparent)', border: `1px solid ${preview.valid ? 'color-mix(in oklch, var(--color-primary) 20%, transparent)' : 'color-mix(in oklch, var(--color-destructive) 20%, transparent)'}` }}>
            <p className="text-[12px]" style={{ color: preview.valid ? 'var(--color-primary)' : 'var(--color-destructive)' }}>{preview.message}</p>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} className="h-9 text-[13px]">Cancel</Button>
          <Button onClick={handleExport} disabled={!preview.valid || exporting} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {exporting ? 'Generating…' : 'Generate CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
