'use client';

import { useState } from 'react';
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

interface InlineTransferAccountSelectProps {
  /** The current account ID (may be undefined/null if unknown) */
  value: string | null | undefined;
  /** The transaction ID */
  transactionId: string;
  /** The transaction type (transfer_out or transfer_in) */
  transactionType: 'transfer_out' | 'transfer_in';
  /** The account this transaction belongs to (to exclude from dropdown) */
  excludeAccountId?: string;
  /** List of available accounts */
  accounts: Account[];
  /** Callback to update the transfer's linked account */
  onUpdate: (transactionId: string, transactionType: 'transfer_out' | 'transfer_in', accountId: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

/**
 * Inline selector for the "other" account in a transfer transaction.
 * Shows "Unknown" as clickable text when the account is not found,
 * allowing the user to select the correct account.
 */
export function InlineTransferAccountSelect({
  value,
  transactionId,
  transactionType,
  excludeAccountId,
  accounts,
  onUpdate,
  disabled = false,
  className,
}: InlineTransferAccountSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter out the excluded account (the account the transaction belongs to)
  const availableAccounts = excludeAccountId
    ? accounts.filter(a => a.id !== excludeAccountId)
    : accounts;

  const currentAccount = value ? accounts.find(a => a.id === value) : null;
  const displayName = currentAccount?.name || 'Unknown';
  const isUnknown = !currentAccount;

  const handleSelect = async (selectedValue: string) => {
    // Don't process empty selections or same value
    if (!selectedValue || selectedValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      setIsUpdating(true);
      await onUpdate(transactionId, transactionType, selectedValue);
    } catch (error) {
      console.error('Error updating transfer account:', error);
    } finally {
      setIsUpdating(false);
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

  // Display mode: show text that can be clicked to edit
  if (!isEditing) {
    return (
      <span
        className={cn(
          "cursor-pointer",
          "hover:underline transition-colors duration-150",
          isUnknown && "text-warning hover:text-warning/80",
          !isUnknown && "hover:text-foreground/80",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        onClick={handleClick}
        title={isUnknown ? "Click to select account" : `${displayName} (click to change)`}
      >
        {displayName}
      </span>
    );
  }

  // Edit mode: show dropdown
  return (
    <Select
      value={value || undefined}
      onValueChange={handleSelect}
      disabled={disabled || isUpdating}
      defaultOpen={true}
      onOpenChange={(open) => {
        if (!open && !isUpdating) {
          setIsEditing(false);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "h-6 text-xs px-2 py-0.5 min-w-[80px] max-w-[120px] bg-elevated rounded",
          "border border-primary text-foreground",
          "focus:ring-1 focus:ring-offset-0",
          isUpdating && "opacity-60",
          className
        )}
      >
        {isUpdating ? (
          <Loader2 className="w-3 h-3 animate-spin mr-1" />
        ) : null}
        <SelectValue placeholder="Select account...">
          <span className="truncate">{displayName}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-card border-border max-h-[200px] z-[100]">
        {availableAccounts.length === 0 ? (
          <div className="px-2 py-1 text-xs text-muted-foreground">No accounts available</div>
        ) : (
          availableAccounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
