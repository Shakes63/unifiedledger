'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, History, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { FIELD_LABELS, formatAmount, formatBoolean, formatTransactionType } from '@/lib/transactions/audit-utils';

interface TransactionChange {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  oldDisplayValue?: string;
  newDisplayValue?: string;
}

interface AuditEntry {
  id: string;
  transactionId: string;
  userId: string;
  householdId: string;
  userName: string | null;
  actionType: 'created' | 'updated' | 'deleted';
  changes: TransactionChange[] | null;
  snapshot: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface TransactionAuditLogProps {
  transactionId: string;
  defaultExpanded?: boolean;
}

export function TransactionAuditLog({
  transactionId,
  defaultExpanded = false,
}: TransactionAuditLogProps) {
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [total, setTotal] = useState(0);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const fetchAuditLog = useCallback(async () => {
    if (!selectedHouseholdId || !expanded) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetchWithHousehold(
        `/api/transactions/${transactionId}/audit?limit=50`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setEntries([]);
          setTotal(0);
          return;
        }
        throw new Error('Failed to fetch audit log');
      }

      const data = await response.json();
      setEntries(data.data);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [transactionId, selectedHouseholdId, expanded, fetchWithHousehold]);

  useEffect(() => {
    if (expanded && selectedHouseholdId) {
      fetchAuditLog();
    }
  }, [expanded, selectedHouseholdId, fetchAuditLog]);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const toggleEntryExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const getActionBadge = (actionType: string) => {
    const color = actionType === 'created' ? 'var(--color-success)' : actionType === 'deleted' ? 'var(--color-destructive)' : 'var(--color-primary)';
    const label = actionType === 'created' ? 'Created' : actionType === 'deleted' ? 'Deleted' : 'Updated';
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`, color }}>
        {label}
      </span>
    );
  };

  const formatFieldValue = (
    field: string,
    value: string | number | boolean | null,
    displayValue?: string
  ): string => {
    // Use display value if available (for foreign keys)
    if (displayValue) return displayValue;

    // Handle null/undefined
    if (value === null || value === undefined) return 'None';

    // Format based on field type
    switch (field) {
      case 'amount':
        return formatAmount(value as number);
      case 'type':
        return formatTransactionType(value as string);
      case 'isPending':
      case 'isTaxDeductible':
      case 'isSalesTaxable':
        return formatBoolean(value as boolean);
      case 'date':
        return format(new Date(value as string), 'MMM d, yyyy');
      default:
        return String(value);
    }
  };

  const renderChange = (change: TransactionChange) => {
    const label = FIELD_LABELS[change.field] || change.field;
    const oldVal = formatFieldValue(change.field, change.oldValue, change.oldDisplayValue);
    const newVal = formatFieldValue(change.field, change.newValue, change.newDisplayValue);

    return (
      <div key={change.field} className="flex items-start gap-2 text-[12px]">
        <span className="min-w-[100px]" style={{ color: 'var(--color-muted-foreground)' }}>{label}:</span>
        <span className="line-through" style={{ color: 'var(--color-destructive)' }}>{oldVal}</span>
        <span style={{ color: 'var(--color-muted-foreground)' }}>→</span>
        <span style={{ color: 'var(--color-success)' }}>{newVal}</span>
      </div>
    );
  };

  const renderSnapshot = (snapshot: Record<string, unknown>) => {
    const relevantFields = [
      { key: 'amount', label: 'Amount' },
      { key: 'description', label: 'Description' },
      { key: 'date', label: 'Date' },
      { key: 'accountName', label: 'Account' },
      { key: 'categoryName', label: 'Category' },
      { key: 'merchantName', label: 'Merchant' },
      { key: 'type', label: 'Type' },
    ];

    return (
      <div className="space-y-1">
        {relevantFields.map(({ key, label }) => {
          const value = snapshot[key];
          if (value === null || value === undefined) return null;

          let displayValue = String(value);
          if (key === 'amount') {
            displayValue = formatAmount(value as number);
          } else if (key === 'type') {
            displayValue = formatTransactionType(value as string);
          } else if (key === 'date') {
            displayValue = format(new Date(value as string), 'MMM d, yyyy');
          }

          return (
            <div key={key} className="flex items-start gap-2 text-[12px]">
              <span className="min-w-[100px]" style={{ color: 'var(--color-muted-foreground)' }}>{label}:</span>
              <span style={{ color: 'var(--color-foreground)' }}>{displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <button onClick={toggleExpanded} className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:opacity-80" style={{ backgroundColor: expanded ? 'var(--color-elevated)' : 'var(--color-background)' }}>
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Change History</span>
          {total > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}>
              {total} {total === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {loading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
            </div>
          )}
          {error && (
            <div className="m-4 px-3 py-2.5 rounded-lg text-[12px]" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)', color: 'var(--color-destructive)' }}>
              {error}
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center p-8 text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>No change history available</div>
          )}
          {!loading && !error && entries.length > 0 && (
            <div className="p-4 space-y-4">
              <div className="relative">
                <div className="absolute left-[19px] top-6 bottom-6 w-px" style={{ backgroundColor: 'var(--color-border)' }} />
                {entries.map(entry => {
                  const isEntryExpanded = expandedEntries.has(entry.id);
                  const hasDetails = entry.changes?.length || entry.snapshot;
                  const dotColor = entry.actionType === 'created' ? 'var(--color-success)' : entry.actionType === 'deleted' ? 'var(--color-destructive)' : 'var(--color-primary)';

                  return (
                    <div key={entry.id} className="relative pl-12 pb-5 last:pb-0">
                      <div className="absolute left-3 w-3 h-3 rounded-full border-2" style={{ top: '6px', backgroundColor: dotColor, borderColor: dotColor }} />
                      <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
                              <User className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                            </div>
                            <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{entry.userName || 'Unknown User'}</span>
                            {getActionBadge(entry.actionType)}
                          </div>
                          <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }} title={format(new Date(entry.createdAt), 'PPpp')}>
                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {hasDetails && (
                          <Button variant="ghost" size="sm" onClick={() => toggleEntryExpanded(entry.id)} className="mt-2 h-7 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                            {isEntryExpanded ? <><ChevronUp className="w-3.5 h-3.5 mr-1" />Hide details</> : <><ChevronDown className="w-3.5 h-3.5 mr-1" />{entry.actionType === 'updated' ? `Show ${entry.changes?.length || 0} change${(entry.changes?.length || 0) === 1 ? '' : 's'}` : 'Show details'}</>}
                          </Button>
                        )}
                        {isEntryExpanded && hasDetails && (
                          <div className="mt-2 pt-2 space-y-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                            {entry.actionType === 'updated' && entry.changes && entry.changes.map(change => renderChange(change))}
                            {(entry.actionType === 'created' || entry.actionType === 'deleted') && entry.snapshot && (
                              <div>
                                <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                  {entry.actionType === 'created' ? 'Initial values:' : 'Transaction at time of deletion:'}
                                </p>
                                {renderSnapshot(entry.snapshot)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

