'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineAmountEditProps {
  value: number;
  transactionId: string;
  type: 'income' | 'expense' | 'transfer_out' | 'transfer_in';
  sign: string; // '+', '-', or ''
  color: string; // CSS color variable
  onUpdate: (transactionId: string, field: 'amount', value: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineAmountEdit({
  value,
  transactionId,
  type: _type,
  sign,
  color,
  onUpdate,
  disabled = false,
  className,
}: InlineAmountEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(Math.abs(value).toFixed(2));
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(Math.abs(value).toFixed(2));
    }
  }, [value, isEditing]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const numericValue = parseFloat(editValue);
    
    // Validate: amount must be positive number
    if (isNaN(numericValue) || numericValue <= 0) {
      setEditValue(Math.abs(value).toFixed(2)); // Revert to original
      setIsEditing(false);
      return;
    }

    // Round to 2 decimal places
    const roundedValue = Math.round(numericValue * 100) / 100;

    // No change, just close
    if (roundedValue === Math.abs(value)) {
      setIsEditing(false);
      return;
    }

    try {
      setIsUpdating(true);
      await onUpdate(transactionId, 'amount', roundedValue);
      setIsEditing(false);
    } catch (_error) {
      // Revert on error
      setEditValue(Math.abs(value).toFixed(2));
      setIsEditing(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(Math.abs(value).toFixed(2));
      setIsEditing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUpdating) {
      setIsEditing(true);
    }
  };

  // Edit mode: show numeric input
  if (isEditing) {
    return (
      <div 
        className={cn("inline-flex items-center gap-1", className)}
        onClick={(e) => e.preventDefault()}
      >
        <span className="text-sm font-semibold" style={{ color }}>
          {sign}$
        </span>
        <Input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isUpdating}
          className={cn(
            "h-6 text-sm font-semibold px-1 py-0.5 w-[80px] bg-elevated border-border rounded text-right",
            "focus:ring-1 focus:ring-offset-0 focus:border-[var(--color-primary)]",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            isUpdating && "opacity-60"
          )}
          style={{ color }}
          onClick={(e) => e.stopPropagation()}
        />
        {isUpdating && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  // Display mode: show formatted amount
  return (
    <p
      className={cn(
        "font-semibold text-sm cursor-pointer",
        "hover:opacity-75",
        "transition-opacity duration-150",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      style={{ color }}
      onClick={handleClick}
      title={`$${Math.abs(value).toFixed(2)} (click to edit)`}
    >
      {sign}${Math.abs(value).toFixed(2)}
    </p>
  );
}
















