'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, History, Loader2, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    switch (actionType) {
      case 'created':
        return (
          <Badge className="bg-success/20 text-success border-0">
            Created
          </Badge>
        );
      case 'updated':
        return (
          <Badge className="bg-primary/20 text-primary border-0">
            Updated
          </Badge>
        );
      case 'deleted':
        return (
          <Badge className="bg-error/20 text-error border-0">
            Deleted
          </Badge>
        );
      default:
        return null;
    }
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
      <div key={change.field} className="flex items-start gap-2 text-sm">
        <span className="text-muted-foreground min-w-[100px]">{label}:</span>
        <span className="text-error line-through">{oldVal}</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-success">{newVal}</span>
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
            <div key={key} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground min-w-[100px]">{label}:</span>
              <span className="text-foreground">{displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border-border bg-card">
      {/* Header - Always visible */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 hover:bg-elevated/50 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-foreground">Change History</span>
          {total > 0 && (
            <Badge variant="secondary" className="bg-elevated text-muted-foreground">
              {total} {total === 1 ? 'entry' : 'entries'}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Content - Expanded */}
      {expanded && (
        <div className="border-t border-border">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="p-4 m-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              No change history available
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="p-4 space-y-4">
              {/* Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border" />

                {/* Entries */}
                {entries.map((entry) => {
                  const isEntryExpanded = expandedEntries.has(entry.id);
                  const hasDetails = entry.changes?.length || entry.snapshot;

                  return (
                    <div key={entry.id} className="relative pl-12 pb-6 last:pb-0">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-3 w-3 h-3 rounded-full border-2 ${
                          entry.actionType === 'created'
                            ? 'bg-success border-success'
                            : entry.actionType === 'deleted'
                            ? 'bg-error border-error'
                            : 'bg-primary border-primary'
                        }`}
                        style={{ top: '6px' }}
                      />

                      {/* Entry card */}
                      <div className="bg-elevated rounded-lg p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center">
                                <User className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <span className="font-medium text-foreground">
                                {entry.userName || 'Unknown User'}
                              </span>
                            </div>
                            {getActionBadge(entry.actionType)}
                          </div>
                          <div
                            className="text-sm text-muted-foreground"
                            title={format(new Date(entry.createdAt), 'PPpp')}
                          >
                            {formatDistanceToNow(new Date(entry.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>

                        {/* Details toggle */}
                        {hasDetails && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEntryExpanded(entry.id)}
                            className="mt-3 h-8 text-muted-foreground hover:text-foreground"
                          >
                            {isEntryExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4 mr-1" />
                                Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 mr-1" />
                                {entry.actionType === 'updated'
                                  ? `Show ${entry.changes?.length || 0} change${
                                      (entry.changes?.length || 0) === 1 ? '' : 's'
                                    }`
                                  : 'Show details'}
                              </>
                            )}
                          </Button>
                        )}

                        {/* Expanded details */}
                        {isEntryExpanded && hasDetails && (
                          <div className="mt-3 pt-3 border-t border-border">
                            {entry.actionType === 'updated' && entry.changes && (
                              <div className="space-y-2">
                                {entry.changes.map(change => renderChange(change))}
                              </div>
                            )}
                            {(entry.actionType === 'created' ||
                              entry.actionType === 'deleted') &&
                              entry.snapshot && (
                                <div className="space-y-2">
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {entry.actionType === 'created'
                                      ? 'Initial values:'
                                      : 'Transaction at time of deletion:'}
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
    </Card>
  );
}

