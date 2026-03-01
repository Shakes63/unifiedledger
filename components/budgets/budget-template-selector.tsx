'use client';

import React, { useState, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChevronDown, FileText, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { toastWarningWithHelp } from '@/lib/help/toast-with-help';
import { HELP_SECTIONS } from '@/lib/help/help-sections';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  rules: Record<string, number>;
}

interface SuggestedBudget {
  categoryId: string;
  categoryName: string;
  monthlyBudget: number;
  allocation: string;
}

interface BudgetTemplateSelectorProps {
  onApplyTemplate: (budgets: SuggestedBudget[]) => void;
  variant?: 'page' | 'modal';
}

export function BudgetTemplateSelector({
  onApplyTemplate,
  variant = 'page',
}: BudgetTemplateSelectorProps) {
  const { fetchWithHousehold, postWithHousehold } = useHouseholdFetch();
  const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BudgetTemplate | null>(null);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (templates.length > 0) return; // Already fetched

    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/budgets/templates');

      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load budget templates');
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold, templates.length]);

  const handleDropdownOpenChange = (open: boolean) => {
    setDropdownOpen(open);
    if (open) {
      fetchTemplates();
    }
  };

  const handleTemplateSelect = (template: BudgetTemplate) => {
    setSelectedTemplate(template);
    setMonthlyIncome('');
    setIsIncomeDialogOpen(true);
    setDropdownOpen(false);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    const income = parseFloat(monthlyIncome);
    if (isNaN(income) || income <= 0) {
      toast.error('Please enter a valid monthly income greater than $0');
      return;
    }

    try {
      setApplying(true);
      const response = await postWithHousehold('/api/budgets/templates', {
        templateId: selectedTemplate.id,
        monthlyIncome: income,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to apply template');
      }

      const data = await response.json();

      if (data.suggestedBudgets && data.suggestedBudgets.length > 0) {
        onApplyTemplate(data.suggestedBudgets);
        toast.success(`${selectedTemplate.name} template applied successfully`);
        setIsIncomeDialogOpen(false);
        setSelectedTemplate(null);
      } else {
        toastWarningWithHelp('No budget suggestions generated', {
          description: 'Categories with budget amounts are required for templates.',
          helpSection: HELP_SECTIONS.CATEGORIES,
        });
      }
    } catch (error) {
      console.error('Error applying template:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to apply budget template');
      }
    } finally {
      setApplying(false);
    }
  };

  const buttonClassName =
    variant === 'page'
      ? 'px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-elevated transition-colors flex items-center gap-1'
      : 'px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-elevated transition-colors text-sm flex items-center gap-1';

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
        <DropdownMenuTrigger asChild>
          <button className={buttonClassName}>
            Use Template
            <ChevronDown className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Budget Templates
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading templates...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No templates available.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                Create categories first to use budget templates.
              </p>
            </div>
          ) : (
            templates.map(template => (
              <DropdownMenuItem
                key={template.id}
                className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                onSelect={() => handleTemplateSelect(template)}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>{template.name}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-sm">{template.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-xs line-clamp-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  {template.description}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent className="max-w-[400px]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="text-[15px]" style={{ color: 'var(--color-foreground)' }}>Apply {selectedTemplate?.name}</DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Enter your total monthly income to calculate budget allocations based on this template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {selectedTemplate && (
              <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>{selectedTemplate.description}</p>
              </div>
            )}
            <div>
              <label htmlFor="monthly-income" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Monthly Income</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
                <input id="monthly-income" type="number" min="0" step="0.01" placeholder="0.00" value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)}
                  className="w-full rounded-lg pl-7 pr-3 h-9 text-[13px] tabular-nums outline-none"
                  style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                  autoFocus />
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>
                The template will distribute this amount across your expense and savings categories.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button onClick={() => setIsIncomeDialogOpen(false)} disabled={applying}
              className="h-9 px-4 rounded-lg text-[13px] transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
              Cancel
            </button>
            <button onClick={handleApplyTemplate} disabled={applying || !monthlyIncome}
              className="h-9 px-4 rounded-lg text-[13px] flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {applying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Applying…</> : 'Apply Template'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
