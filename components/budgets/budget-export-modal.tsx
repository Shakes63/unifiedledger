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
  const { selectedHouseholdId } = useHousehold();
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
      const value = date.toISOString().slice(0, 7); // YYYY-MM
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
            types = ['variable_expense', 'monthly_bill', 'non_monthly_bill', 'debt'];
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Export Budget Data</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Download your budget data as a CSV file for external analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Range Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-month" className="text-sm text-muted-foreground">
                Start Month
              </Label>
              <select
                id="start-month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="mt-1 w-full bg-input border border-border text-foreground rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="end-month" className="text-sm text-muted-foreground">
                End Month
              </Label>
              <select
                id="end-month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="mt-1 w-full bg-input border border-border text-foreground rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <Label htmlFor="category-filter" className="text-sm text-muted-foreground">
              Category Filter
            </Label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'income' | 'expenses' | 'savings')}
              className="mt-1 w-full bg-input border border-border text-foreground rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Categories</option>
              <option value="income">Income Only</option>
              <option value="expenses">Expenses Only</option>
              <option value="savings">Savings Only</option>
            </select>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">Export Options</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-summary"
                checked={includeSummary}
                onCheckedChange={(checked) => setIncludeSummary(checked as boolean)}
              />
              <label
                htmlFor="include-summary"
                className="text-sm text-foreground cursor-pointer"
              >
                Include summary row
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-variable-bills"
                checked={includeVariableBills}
                onCheckedChange={(checked) => setIncludeVariableBills(checked as boolean)}
              />
              <label
                htmlFor="include-variable-bills"
                className="text-sm text-foreground cursor-pointer"
              >
                Include variable bills section
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className={`p-3 rounded-lg ${preview.valid ? 'bg-accent/10' : 'bg-[var(--color-error)]/10'}`}>
            <p className={`text-sm ${preview.valid ? 'text-foreground' : 'text-[var(--color-error)]'}`}>
              {preview.message}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={!preview.valid || exporting}
            className="bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Generating...' : 'Generate CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
