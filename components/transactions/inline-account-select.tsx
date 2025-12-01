'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  name: string;
}

interface InlineAccountSelectProps {
  value: string;
  transactionId: string;
  accounts: Account[];
  onUpdate: (transactionId: string, field: 'accountId', value: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineAccountSelect({
  value,
  transactionId,
  accounts,
  onUpdate,
  disabled = false,
  className,
}: InlineAccountSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const currentAccount = accounts.find(a => a.id === value);
  const displayName = currentAccount?.name || 'Unknown';

  // Auto-open dropdown when entering edit mode
  useEffect(() => {
    if (isEditing) {
      // Small delay to ensure the Select is mounted
      const timer = setTimeout(() => {
        setSelectOpen(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  // Close edit mode when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (!isUpdating) {
          setIsEditing(false);
          setSelectOpen(false);
        }
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing, isUpdating]);

  const handleSelect = async (selectedValue: string) => {
    // No change, just close
    if (selectedValue === value) {
      setIsEditing(false);
      setSelectOpen(false);
      return;
    }

    try {
      setIsUpdating(true);
      await onUpdate(transactionId, 'accountId', selectedValue);
      setIsEditing(false);
      setSelectOpen(false);
    } finally {
      setIsUpdating(false);
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
          "text-xs cursor-pointer truncate max-w-[100px]",
          "text-muted-foreground hover:text-foreground hover:underline",
          "transition-colors duration-150",
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

  // Edit mode: show dropdown
  return (
    <div 
      ref={wrapperRef}
      className={cn("inline-flex items-center", className)}
      onClick={(e) => e.preventDefault()}
    >
      <Select
        value={value}
        onValueChange={handleSelect}
        disabled={disabled || isUpdating}
        open={selectOpen}
        onOpenChange={(open) => {
          setSelectOpen(open);
          // If dropdown closes without selection, exit edit mode
          if (!open && !isUpdating) {
            setTimeout(() => {
              setIsEditing(false);
            }, 100);
          }
        }}
      >
        <SelectTrigger
          className={cn(
            "h-6 text-xs px-2 py-0.5 min-w-[70px] max-w-[100px] bg-elevated rounded",
            "border border-[var(--color-primary)] text-muted-foreground",
            "focus:ring-1 focus:ring-offset-0",
            isUpdating && "opacity-60"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : null}
          <SelectValue placeholder="Account...">
            <span className="truncate">{displayName}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          className="bg-card border-border max-h-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
