'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2, Copy, Loader2, Plus } from 'lucide-react';

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

interface Account {
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    accountId: '',
    amount: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/transactions/templates', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

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
        return 'bg-emerald-500/20 text-emerald-400';
      case 'expense':
        return 'bg-red-500/20 text-red-400';
      case 'transfer_in':
      case 'transfer_out':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
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
        <Button variant="outline" className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]">
          <Copy className="w-4 h-4 mr-2" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaction Templates</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Quick-start transactions from your saved templates
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
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
                className="p-4 border-[#2a2a2a] bg-[#242424] hover:bg-[#2a2a2a] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => handleUseTemplate(template)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-white">{template.name}</p>
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
                    className="h-8 w-8 p-0 hover:bg-[#3a3a3a]"
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
