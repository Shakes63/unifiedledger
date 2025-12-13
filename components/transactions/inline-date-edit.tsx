'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseISO, format } from 'date-fns';

interface InlineDateEditProps {
  value: string; // ISO date string (YYYY-MM-DD)
  transactionId: string;
  onUpdate: (transactionId: string, field: 'date', value: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineDateEdit({
  value,
  transactionId,
  onUpdate,
  disabled = false,
  className,
}: InlineDateEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track if we're updating to prevent blur from closing prematurely
  const isUpdatingRef = useRef(false);

  // Format display date
  const displayDate = format(parseISO(value), 'MMM d');

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    // Validate: date is required
    if (!editValue) {
      setEditValue(value); // Revert to original
      setIsEditing(false);
      return;
    }

    // No change, just close
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      isUpdatingRef.current = true;
      setIsUpdating(true);
      await onUpdate(transactionId, 'date', editValue);
      setIsEditing(false);
    } catch (_error) {
      // Revert on error
      setEditValue(value);
      setIsEditing(false);
    } finally {
      isUpdatingRef.current = false;
      setIsUpdating(false);
    }
  };

  // Handle date change - save immediately when a date is selected from picker
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    
    // If value is valid and different, save immediately
    if (newValue && newValue !== value) {
      try {
        isUpdatingRef.current = true;
        setIsUpdating(true);
        await onUpdate(transactionId, 'date', newValue);
        setIsEditing(false);
      } catch (_error) {
        // Revert on error
        setEditValue(value);
      } finally {
        isUpdatingRef.current = false;
        setIsUpdating(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    // Don't close if we're in the middle of updating
    if (isUpdatingRef.current) {
      return;
    }
    // Small delay to allow date picker selection to complete
    setTimeout(() => {
      if (!isUpdatingRef.current) {
        setEditValue(value); // Revert if no selection was made
        setIsEditing(false);
      }
    }, 150);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUpdating) {
      setIsEditing(true);
    }
  };

  // Edit mode: show date input with solid background to cover content behind
  // Uses absolute positioning to overlay on top of adjacent content
  if (isEditing) {
    return (
      <div 
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md z-50",
          className
        )}
        style={{
          backgroundColor: 'var(--color-card)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <Input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isUpdating}
          className={cn(
            "h-7 text-xs px-2 py-1 w-[120px] rounded",
            "border border-[var(--color-primary)]",
            "focus:ring-1 focus:ring-offset-0 focus:border-[var(--color-primary)]",
            "[&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
            "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
            isUpdating && "opacity-60"
          )}
          style={{
            backgroundColor: 'var(--color-elevated)',
            color: 'var(--color-foreground)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
        {isUpdating && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  // Display mode: show formatted date
  return (
    <span
      className={cn(
        "text-xs text-muted-foreground cursor-pointer",
        "hover:text-foreground hover:underline",
        "transition-colors duration-150",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      onClick={handleClick}
      title={`${format(parseISO(value), 'MMMM d, yyyy')} (click to edit)`}
    >
      {displayDate}
    </span>
  );
}

