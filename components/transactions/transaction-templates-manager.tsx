'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2, Copy, Loader2 } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Template {
  id: string;
  name: string;
  description?: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  notes?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

interface _Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface TransactionTemplatesManagerProps {
  onTemplateSelected?: (template: Template) => void;
  showTrigger?: boolean;
}

export function TransactionTemplatesManager({
  onTemplateSelected,
  showTrigger = true,
}: TransactionTemplatesManagerProps) {
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [_showNewForm, _setShowNewForm] = useState(false);
  const [_newTemplate, _setNewTemplate] = useState({
    name: '',
    description: '',
    accountId: '',
    amount: '',
  });

  const fetchTemplates = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetchWithHousehold('/api/transactions/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (selectedHouseholdId) {
      fetchTemplates();
    }
  }, [selectedHouseholdId, fetchTemplates]);

  const handleDelete = async (templateId: string) => {
    setDeletingId(templateId);
    try {
      const response = await fetch(`/api/transactions/templates/${templateId}`, { credentials: 'include', method: 'DELETE', });
      if (!response.ok) throw new Error('Failed to delete template');
      setTemplates(templates.filter((t) => t.id !== templateId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUseTemplate = (template: Template) => {
    if (onTemplateSelected) {
      onTemplateSelected(template);
      setOpen(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-income/20 text-income';
      case 'expense':
        return 'bg-expense/20 text-expense';
      case 'transfer_in':
      case 'transfer_out':
        return 'bg-transfer/20 text-transfer';
      default:
        return 'bg-muted/20 text-muted-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'transfer_in':
        return 'Transfer In';
      case 'transfer_out':
        return 'Transfer Out';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  if (!showTrigger) {
    if (loading) return <div style={{ color: 'var(--color-muted-foreground)' }}>Loading templates...</div>;
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-[12px]">
          <Copy className="w-3.5 h-3.5 mr-1.5" />Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}>
              <Copy className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
            </div>
            Transaction Templates
          </DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Quick-start transactions from your saved templates
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="px-3 py-2.5 rounded-lg text-[12px]" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)', color: 'var(--color-destructive)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center p-8 text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>No templates yet</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto mt-1">
            {templates.map(template => {
              const typeColor = template.type === 'income' ? 'var(--color-income)' : template.type === 'expense' ? 'var(--color-destructive)' : 'var(--color-primary)';
              return (
                <div key={template.id} className="rounded-xl p-3 flex items-start justify-between gap-3 cursor-pointer transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                  <div className="flex-1 min-w-0" onClick={() => handleUseTemplate(template)}>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>{template.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `color-mix(in oklch, ${typeColor} 12%, transparent)`, color: typeColor }}>
                        {getTypeLabel(template.type)}
                      </span>
                    </div>
                    {template.description && <p className="text-[11px] mb-1" style={{ color: 'var(--color-muted-foreground)' }}>{template.description}</p>}
                    <div className="flex items-center gap-2.5 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                      <span className="font-mono tabular-nums">${template.amount.toFixed(2)}</span>
                      {template.usageCount > 0 && <span>Used {template.usageCount} times</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={e => { e.stopPropagation(); handleDelete(template.id); }} disabled={deletingId === template.id}>
                    {deletingId === template.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
