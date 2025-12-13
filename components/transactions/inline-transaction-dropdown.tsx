'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Use refs to track state for race condition prevention (refs update synchronously)
  const isUpdatingRef = useRef(false);
  const isCreatingRef = useRef(false);
  const selectOpenRef = useRef(false);

  const isMissing = !value;
  const field = type === 'category' ? 'categoryId' : 'merchantId';
  const placeholder = type === 'category' ? 'Category...' : 'Merchant...';

  // Get current option name
  const currentOption = options.find(opt => opt.id === value);
  const displayName = currentOption?.name || placeholder;

  // Filter categories based on transaction type
  const filteredOptions = type === 'category'
    ? options.filter(opt => {
        if (transactionType === 'income') return opt.type === 'income';
        return opt.type === 'expense' || opt.type === 'income';
      })
    : options;

  // Auto-open dropdown when entering edit mode
  useEffect(() => {
    if (isEditing && !isCreating) {
      // Small delay to ensure the Select is mounted
      const timer = setTimeout(() => {
        selectOpenRef.current = true;
        setSelectOpen(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing, isCreating]);

  // Close edit mode when clicking outside
  // Note: We only use this for the "create new" input mode.
  // For the Select dropdown, onOpenChange handles closing.
  // The Select uses a Portal, so clicks on dropdown items appear outside wrapperRef.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        // Don't close if select dropdown is open (it's portaled outside wrapperRef)
        // The Select's onOpenChange will handle closing when dropdown closes
        // Use ref to get current value (avoids stale closure)
        if (selectOpenRef.current) {
          return;
        }
        // Use ref to check updating state to avoid race condition
        if (!isUpdatingRef.current && !isCreatingNew) {
          setIsEditing(false);
          isCreatingRef.current = false;
          setIsCreating(false);
          setNewName('');
          selectOpenRef.current = false;
          setSelectOpen(false);
        }
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing, isCreatingNew]);

  const handleSelect = async (selectedValue: string) => {
    if (selectedValue === '__create_new__') {
      // Set ref immediately to prevent race condition with onOpenChange
      isCreatingRef.current = true;
      setIsCreating(true);
      selectOpenRef.current = false;
      setSelectOpen(false);
      return;
    }

    try {
      // Set ref immediately to prevent race condition with onOpenChange
      isUpdatingRef.current = true;
      setIsUpdating(true);
      await onUpdate(transactionId, field, selectedValue);
      setIsEditing(false);
      selectOpenRef.current = false;
      setSelectOpen(false);
    } finally {
      isUpdatingRef.current = false;
      setIsUpdating(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      setIsCreatingNew(true);
      await onCreate(transactionId, type, newName.trim());
      setNewName('');
      isCreatingRef.current = false;
      setIsCreating(false);
      setIsEditing(false);
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
      e.preventDefault();
      isCreatingRef.current = false;
      setIsCreating(false);
      setIsEditing(false);
      setNewName('');
      selectOpenRef.current = false;
      setSelectOpen(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUpdating) {
      setIsEditing(true);
    }
  };

  // Display mode: show text that can be clicked to edit
  if (!isEditing) {
    return (
      <span
        className={cn(
          "text-xs cursor-pointer inline-flex items-center px-1.5 py-0.5 rounded",
          "transition-colors duration-150",
          isMissing
            ? "border border-(--color-warning) text-muted-foreground bg-transparent hover:bg-elevated"
            : "text-foreground hover:bg-elevated hover:underline",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        onClick={handleClick}
        title={`${displayName} (click to edit)`}
      >
        {displayName}
      </span>
    );
  }

  // In "create new" mode, show inline input
  if (isCreating) {
    return (
      <div 
        ref={wrapperRef}
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
          className="h-6 text-xs px-2 py-0.5 min-w-[80px] max-w-[120px] bg-elevated border-(--color-primary)"
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
          className="h-6 w-6 p-0 bg-(--color-primary) hover:opacity-90"
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
            isCreatingRef.current = false;
            setIsCreating(false);
            setIsEditing(false);
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

  // Edit mode: show dropdown
  return (
    <div 
      ref={wrapperRef}
      className={cn("inline-flex items-center", className)}
      onClick={(e) => e.preventDefault()}
    >
      <Select
        value={value || ''}
        onValueChange={handleSelect}
        disabled={disabled || isUpdating}
        open={selectOpen}
        onOpenChange={(open) => {
          selectOpenRef.current = open;
          setSelectOpen(open);
          // If dropdown closes without selection, exit edit mode
          // Use refs to check state to avoid race condition with stale closures
          if (!open && !isUpdatingRef.current) {
            setTimeout(() => {
              // Double-check refs in timeout as well
              if (!isCreatingRef.current && !isUpdatingRef.current) {
                setIsEditing(false);
              }
            }, 100);
          }
        }}
      >
        <SelectTrigger
          className={cn(
            "h-6 text-xs px-2 py-0.5 min-w-[80px] max-w-[140px] bg-elevated rounded",
            "focus:ring-1 focus:ring-offset-0",
            "border border-(--color-primary) text-foreground",
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
