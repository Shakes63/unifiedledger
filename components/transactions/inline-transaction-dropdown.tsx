'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  name: string;
  type?: string;
}

interface InlineTransactionDropdownProps {
  type: 'category' | 'merchant';
  value: string | null;
  transactionId: string;
  transactionType: 'income' | 'expense' | 'transfer_out' | 'transfer_in';
  options: Option[];
  onUpdate: (transactionId: string, field: 'categoryId' | 'merchantId', value: string) => Promise<void>;
  onCreate: (transactionId: string, type: 'category' | 'merchant', name: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineTransactionDropdown({
  type,
  value,
  transactionId,
  transactionType,
  options,
  onUpdate,
  onCreate,
  disabled = false,
  className,
}: InlineTransactionDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const isMissing = !value;
  const field = type === 'category' ? 'categoryId' : 'merchantId';
  const placeholder = type === 'category' ? 'Category...' : 'Merchant...';

  // Filter categories based on transaction type
  const filteredOptions = type === 'category'
    ? options.filter(opt => {
        if (transactionType === 'income') return opt.type === 'income';
        return opt.type === 'variable_expense' || opt.type === 'monthly_bill' || opt.type === 'income';
      })
    : options;

  const handleSelect = async (selectedValue: string) => {
    if (selectedValue === '__create_new__') {
      setIsCreating(true);
      return;
    }

    try {
      setIsUpdating(true);
      await onUpdate(transactionId, field, selectedValue);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      setIsCreatingNew(true);
      await onCreate(transactionId, type, newName.trim());
      setNewName('');
      setIsCreating(false);
    } finally {
      setIsCreatingNew(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleCreate();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewName('');
    }
  };

  // In "create new" mode, show inline input
  if (isCreating) {
    return (
      <div 
        className={cn("flex items-center gap-1", className)}
        onClick={(e) => e.preventDefault()}
      >
        <Input
          autoFocus
          type="text"
          placeholder={`New ${type}...`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isCreatingNew}
          className="h-6 text-xs px-2 py-0.5 min-w-[80px] max-w-[120px] bg-elevated border-[var(--color-primary)]"
          onClick={(e) => e.stopPropagation()}
        />
        <Button
          type="button"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCreate();
          }}
          disabled={isCreatingNew || !newName.trim()}
          className="h-6 w-6 p-0 bg-[var(--color-primary)] hover:opacity-90"
        >
          {isCreatingNew ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsCreating(false);
            setNewName('');
          }}
          disabled={isCreatingNew}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  // Normal dropdown mode
  return (
    <div 
      className={cn("inline-flex items-center", className)}
      onClick={(e) => e.preventDefault()}
    >
      <Select
        value={value || ''}
        onValueChange={handleSelect}
        disabled={disabled || isUpdating}
      >
        <SelectTrigger
          className={cn(
            "h-6 text-xs px-2 py-0.5 min-w-[80px] max-w-[140px] bg-elevated rounded",
            "focus:ring-1 focus:ring-offset-0",
            isMissing
              ? "border-[1.5px] border-[var(--color-warning)] text-muted-foreground"
              : "border border-border text-foreground",
            isUpdating && "opacity-60"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : null}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          className="bg-card border-border max-h-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          <SelectItem 
            value="__create_new__" 
            className="font-medium"
            style={{ color: 'var(--color-primary)' }}
          >
            + New {type}...
          </SelectItem>
          {filteredOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

