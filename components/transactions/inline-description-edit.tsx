'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineDescriptionEditProps {
  value: string;
  transactionId: string;
  onUpdate: (transactionId: string, field: 'description', value: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineDescriptionEdit({
  value,
  transactionId,
  onUpdate,
  disabled = false,
  className,
}: InlineDescriptionEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isUpdating, setIsUpdating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    // Validate: description is required
    if (!trimmedValue) {
      setEditValue(value); // Revert to original
      setIsEditing(false);
      return;
    }

    // No change, just close
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      setIsUpdating(true);
      await onUpdate(transactionId, 'description', trimmedValue);
      setIsEditing(false);
    } catch (_error) {
      // Revert on error
      setEditValue(value);
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
      setEditValue(value);
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

  // Edit mode: show textarea
  if (isEditing) {
    return (
      <div 
        className={cn("flex items-start gap-1", className)}
        onClick={(e) => e.preventDefault()}
      >
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isUpdating}
          rows={2}
          className={cn(
            "text-xs px-2 py-1 min-w-[200px] max-w-[300px] min-h-[40px] max-h-[80px]",
            "bg-elevated border-border rounded resize-none",
            "focus:ring-1 focus:ring-offset-0 focus:border-primary",
            isUpdating && "opacity-60"
          )}
          onClick={(e) => e.stopPropagation()}
        />
        {isUpdating && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground mt-1" />
        )}
      </div>
    );
  }

  // Display mode: show text with line clamp for up to 2 lines
  return (
    <p
      className={cn(
        "text-xs text-muted-foreground cursor-pointer line-clamp-2",
        "hover:text-foreground hover:underline",
        "transition-colors duration-150",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
      onClick={handleClick}
      title={`${value} (click to edit)`}
    >
      {value}
    </p>
  );
}

