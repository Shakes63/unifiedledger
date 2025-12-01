'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
        return 'bg-[var(--color-income)]/20 text-[var(--color-income)]';
      case 'expense':
        return 'bg-[var(--color-expense)]/20 text-[var(--color-expense)]';
      case 'transfer_in':
      case 'transfer_out':
        return 'bg-[var(--color-transfer)]/20 text-[var(--color-transfer)]';
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
    if (loading) return <div className="text-muted-foreground">Loading templates...</div>;
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-card text-foreground border-border hover:bg-elevated">
          <Copy className="w-4 h-4 mr-2" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaction Templates</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Quick-start transactions from your saved templates
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-[var(--color-error)]/20 border border-[var(--color-error)]/40 rounded-lg text-[var(--color-error)] text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center p-8">
            <p className="text-muted-foreground">No templates yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="p-4 border-border bg-elevated hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => handleUseTemplate(template)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-foreground">{template.name}</p>
                      <Badge className={getTypeColor(template.type)}>
                        {getTypeLabel(template.type)}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mb-1">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>${template.amount.toFixed(2)}</span>
                      {template.usageCount > 0 && (
                        <span>Used {template.usageCount} times</span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(template.id);
                    }}
                    disabled={deletingId === template.id}
                  >
                    {deletingId === template.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
