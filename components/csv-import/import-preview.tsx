'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, AlertTriangle, CreditCard, ArrowLeftRight, RefreshCw, Receipt, DollarSign, Percent, Gift, ChevronDown, ChevronRight } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { CCTransactionType } from '@/lib/csv-import';

export interface StagingRecord {
  rowNumber: number;
  status: 'pending' | 'review' | 'approved' | 'skipped' | 'imported';
  validationErrors?: string[];
  duplicateOf?: string;
  duplicateScore?: number;
  duplicateMatchReason?: 'levenshtein' | 'merchant_name';
  duplicateMerchantName?: string;
  // Matched transaction info for display
  matchedTransaction?: {
    id: string;
    date: string;
    description: string;
    amount: number;
    accountName?: string;
  };
  data?: Record<string, string | number | boolean | null>;
  // Phase 12: Credit card specific fields
  ccTransactionType?: CCTransactionType;
  potentialTransferId?: string;
  transferMatchConfidence?: number;
  // Account number transfer detection
  accountNumberTransfer?: {
    accountId: string;
    accountName: string;
    last4: string;
    matchReason: string;
    // If a matching transaction already exists in the target account
    existingMatch?: {
      id: string;
      date: string;
      description: string;
      amount: number;
      type: string;
      hasTransferLink: boolean; // true if already linked to another transaction
    };
  };
}

/**
 * Transfer decision for a row - how to import the transaction
 */
export interface TransferDecision {
  rowNumber: number;
  importType: 'transfer' | 'link_existing' | 'regular';
  targetAccountId?: string;
  existingTransactionId?: string; // For link_existing option
}

interface ImportPreviewProps {
  staging: StagingRecord[];
  fileName: string;
  totalRows: number;
  validRows: number;
  reviewRows: number;
  duplicateRows: number;
  onConfirm: (recordIds?: string[], transferDecisions?: TransferDecision[]) => Promise<void>;
  onBack?: () => void;
  isLoading?: boolean;
  // Phase 12: Credit card detection info
  sourceType?: 'bank' | 'credit_card' | 'auto';
  detectedIssuer?: string;
  statementInfo?: {
    statementBalance?: number;
    statementDate?: string;
    dueDate?: string;
    minimumPayment?: number;
    creditLimit?: number;
  };
}

/**
 * Get icon for credit card transaction type
 */
function getCCTypeIcon(type: CCTransactionType | undefined): React.ReactNode {
  switch (type) {
    case 'payment':
      return <DollarSign className="w-3 h-3 text-success" />;
    case 'refund':
      return <RefreshCw className="w-3 h-3 text-income" />;
    case 'interest':
      return <Percent className="w-3 h-3 text-warning" />;
    case 'fee':
      return <Receipt className="w-3 h-3 text-error" />;
    case 'balance_transfer':
      return <ArrowLeftRight className="w-3 h-3 text-primary" />;
    case 'reward':
      return <Gift className="w-3 h-3 text-success" />;
    case 'cash_advance':
      return <DollarSign className="w-3 h-3 text-warning" />;
    default:
      return <CreditCard className="w-3 h-3 text-muted-foreground" />;
  }
}

/**
 * Get display name for credit card transaction type
 */
function getCCTypeLabel(type: CCTransactionType | undefined): string {
  switch (type) {
    case 'payment': return 'Payment';
    case 'refund': return 'Refund';
    case 'interest': return 'Interest';
    case 'fee': return 'Fee';
    case 'balance_transfer': return 'Balance Transfer';
    case 'reward': return 'Reward';
    case 'cash_advance': return 'Cash Advance';
    case 'purchase': return 'Purchase';
    default: return '';
  }
}

/**
 * Individual record row component
 */
function RecordRow({
  record,
  isSelected,
  onToggle,
  getStatusIcon,
  getCCTypeIcon,
  getCCTypeLabel,
  transferDecision,
  onTransferDecisionChange,
}: {
  record: StagingRecord;
  isSelected: boolean;
  onToggle: () => void;
  getStatusIcon: (status: string, errors?: string[]) => React.ReactNode;
  getCCTypeIcon: (type: CCTransactionType | undefined) => React.ReactNode;
  getCCTypeLabel: (type: CCTransactionType | undefined) => string;
  transferDecision?: 'transfer' | 'link_existing' | 'regular';
  onTransferDecisionChange: (value: 'transfer' | 'link_existing' | 'regular') => void;
}) {
  return (
    <div
      className="p-3 bg-card rounded border border-border hover:border-primary/30 cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="cursor-pointer"
          />
          {getStatusIcon(record.status, record.validationErrors)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            Row {record.rowNumber}
          </div>

          {record.data && (
            <div className="text-xs text-muted-foreground mt-1 space-y-1">
              <div className="truncate">
                <span className="text-muted-foreground">Description:</span> {record.data.description || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Amount:</span> ${record.data.amount || '0.00'}
                {record.data.type && (
                  <span className="ml-2 text-muted-foreground">({record.data.type})</span>
                )}
                {/* Show CC transaction type badge */}
                {record.ccTransactionType && record.ccTransactionType !== 'purchase' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                    {getCCTypeIcon(record.ccTransactionType)}
                    {getCCTypeLabel(record.ccTransactionType)}
                  </span>
                )}
              </div>
              <div className="truncate">
                <span className="text-muted-foreground">Date:</span> {record.data.date || 'N/A'}
              </div>
            </div>
          )}

          {record.validationErrors && record.validationErrors.length > 0 && (
            <div className="text-xs text-error mt-2 space-y-1">
              {record.validationErrors.map((error, i) => (
                <div key={`error-${record.rowNumber}-${i}`}>{error}</div>
              ))}
            </div>
          )}

          {/* Show duplicate with matched transaction details */}
          {record.duplicateOf && (
            <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded text-xs">
              <div className="flex items-center gap-2 text-warning font-medium">
                <AlertTriangle className="w-3 h-3" />
                <span>
                  Possible duplicate ({record.duplicateScore?.toFixed(0)}% match)
                  {record.duplicateMatchReason === 'merchant_name' && record.duplicateMerchantName && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      - Merchant &quot;{record.duplicateMerchantName}&quot; found in description
                    </span>
                  )}
                </span>
              </div>
              {record.matchedTransaction && (
                <div className="mt-1 pl-5 text-muted-foreground">
                  <div className="truncate">
                    Matches: {record.matchedTransaction.description}
                  </div>
                  <div>
                    ${typeof record.matchedTransaction.amount === 'number'
                      ? record.matchedTransaction.amount.toFixed(2)
                      : record.matchedTransaction.amount} on {record.matchedTransaction.date}
                    {record.matchedTransaction.accountName && (
                      <span> ({record.matchedTransaction.accountName})</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show account number transfer detection with import choice */}
          {record.accountNumberTransfer && (
            <div className="mt-2 p-3 bg-primary/10 border border-primary/30 rounded text-xs">
              <div className="flex items-center gap-2 text-primary font-medium mb-2">
                <ArrowLeftRight className="w-3 h-3" />
                <span>Possible transfer detected</span>
              </div>
              <div className="pl-5 text-muted-foreground mb-3">
                <div>
                  {record.accountNumberTransfer.matchReason}
                </div>
                <div>
                  Target: {record.accountNumberTransfer.accountName} (****{record.accountNumberTransfer.last4})
                </div>
              </div>

              {/* Show existing match if found */}
              {record.accountNumberTransfer.existingMatch && (
                <div className="pl-5 mb-3 p-2 bg-success/10 border border-success/30 rounded">
                  <div className="flex items-center gap-2 text-success font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Matching transaction found in target account</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    <div className="truncate">
                      {record.accountNumberTransfer.existingMatch.description}
                    </div>
                    <div>
                      ${Math.abs(record.accountNumberTransfer.existingMatch.amount).toFixed(2)} on {record.accountNumberTransfer.existingMatch.date}
                      <span className="ml-1">({record.accountNumberTransfer.existingMatch.type})</span>
                    </div>
                    {record.accountNumberTransfer.existingMatch.hasTransferLink && (
                      <div className="text-warning mt-1">
                        Already linked to another transfer
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import type selection */}
              <div className="pl-5 pt-2 border-t border-primary/20">
                <div className="text-foreground font-medium mb-2">How should this be imported?</div>
                <RadioGroup
                  value={transferDecision || 'transfer'}
                  onValueChange={(value) => onTransferDecisionChange(value as 'transfer' | 'link_existing' | 'regular')}
                  className="space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Link to existing option - only show if match exists and not already linked */}
                  {record.accountNumberTransfer.existingMatch && !record.accountNumberTransfer.existingMatch.hasTransferLink && (
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="link_existing" id={`link-${record.rowNumber}`} className="mt-0.5" />
                      <Label
                        htmlFor={`link-${record.rowNumber}`}
                        className="text-xs cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-medium text-success">Link to existing transaction</span>
                        <span className="text-muted-foreground ml-1">
                          (recommended - connects this to the matching transaction)
                        </span>
                      </Label>
                    </div>
                  )}
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="transfer" id={`transfer-${record.rowNumber}`} className="mt-0.5" />
                    <Label
                      htmlFor={`transfer-${record.rowNumber}`}
                      className="text-xs cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-medium text-primary">Create new transfer pair</span>
                      <span className="text-muted-foreground ml-1">
                        (creates linked transfer_out/transfer_in transactions)
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem value="regular" id={`regular-${record.rowNumber}`} className="mt-0.5" />
                    <Label
                      htmlFor={`regular-${record.rowNumber}`}
                      className="text-xs cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-medium">Import as regular transaction</span>
                      <span className="text-muted-foreground ml-1">
                        (expense from source account only)
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Show potential transfer match warning (existing behavior) */}
          {record.potentialTransferId && !record.accountNumberTransfer && (
            <div className="flex items-center gap-2 text-xs text-primary mt-2">
              <ArrowLeftRight className="w-3 h-3" />
              <span>
                Potential transfer match ({record.transferMatchConfidence?.toFixed(0)}% confidence)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImportPreview({
  staging,
  fileName,
  totalRows,
  validRows,
  reviewRows,
  duplicateRows,
  onConfirm,
  onBack,
  isLoading = false,
  sourceType,
  detectedIssuer,
  statementInfo,
}: ImportPreviewProps) {
  // Select rows that are approved OR are transfers (but not duplicates)
  // Transfers need review but should be selected by default since user likely wants to import them
  // Duplicates should NOT be selected by default since they're likely already imported
  const [selectedRows, setSelectedRows] = useState<Set<number>>(
    new Set(
      staging
        .filter((r) =>
          r.status === 'approved' ||
          (r.accountNumberTransfer && !r.duplicateOf) // Transfers without duplicates
        )
        .map((r) => r.rowNumber)
    )
  );

  // Track transfer decisions: key is rowNumber, value is import type
  // Default: 'link_existing' if match found, 'transfer' otherwise
  const [transferDecisions, setTransferDecisions] = useState<Map<number, 'transfer' | 'link_existing' | 'regular'>>(() => {
    const initialDecisions = new Map<number, 'transfer' | 'link_existing' | 'regular'>();
    staging.forEach((r) => {
      if (r.accountNumberTransfer) {
        // Default to link_existing if a match exists (and not already linked)
        // Otherwise default to transfer
        if (r.accountNumberTransfer.existingMatch && !r.accountNumberTransfer.existingMatch.hasTransferLink) {
          initialDecisions.set(r.rowNumber, 'link_existing');
        } else {
          initialDecisions.set(r.rowNumber, 'transfer');
        }
      }
    });
    return initialDecisions;
  });

  const setTransferDecision = (rowNumber: number, importType: 'transfer' | 'link_existing' | 'regular') => {
    setTransferDecisions((prev) => {
      const updated = new Map(prev);
      updated.set(rowNumber, importType);
      return updated;
    });
  };

  const toggleRow = (rowNumber: number) => {
    const updated = new Set(selectedRows);
    if (updated.has(rowNumber)) {
      updated.delete(rowNumber);
    } else {
      updated.add(rowNumber);
    }
    setSelectedRows(updated);
  };

  // Count selectable rows (approved + transfers without duplicates)
  const selectableRows = staging.filter(
    (r) => r.status === 'approved' || (r.accountNumberTransfer && !r.duplicateOf)
  );

  const toggleAll = () => {
    if (selectedRows.size === selectableRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(selectableRows.map((r) => r.rowNumber)));
    }
  };

  const getStatusIcon = (status: string, errors?: string[]) => {
    if (errors && errors.length > 0) {
      return (
        <AlertCircle className="w-4 h-4 text-error" />
      );
    }
    if (status === 'approved') {
      return (
        <CheckCircle2 className="w-4 h-4 text-success" />
      );
    }
    return (
      <AlertTriangle className="w-4 h-4 text-warning" />
    );
  };

  // Count transfer matches (both types)
  const transferMatches = staging.filter(r => r.potentialTransferId || r.accountNumberTransfer).length;

  // Separate flagged records from regular records
  const flaggedRecords = staging.filter(
    (r) => r.duplicateOf || r.accountNumberTransfer || r.potentialTransferId || (r.validationErrors && r.validationErrors.length > 0)
  );
  const regularRecords = staging.filter(
    (r) => !r.duplicateOf && !r.accountNumberTransfer && !r.potentialTransferId && (!r.validationErrors || r.validationErrors.length === 0)
  );

  // Collapse state for sections
  const [flaggedExpanded, setFlaggedExpanded] = useState(true);
  const [regularExpanded, setRegularExpanded] = useState(false);

  // Filter state for flagged records
  type FlagFilter = 'all' | 'duplicates' | 'transfers' | 'errors';
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('all');

  // Count each type
  const duplicateCount = flaggedRecords.filter(r => r.duplicateOf).length;
  const transferCount = flaggedRecords.filter(r => r.accountNumberTransfer || r.potentialTransferId).length;
  const errorCount = flaggedRecords.filter(r => r.validationErrors && r.validationErrors.length > 0).length;

  // Filter flagged records based on selected filter
  const filteredFlaggedRecords = flaggedRecords.filter((r) => {
    switch (flagFilter) {
      case 'duplicates':
        return !!r.duplicateOf;
      case 'transfers':
        return !!(r.accountNumberTransfer || r.potentialTransferId);
      case 'errors':
        return !!(r.validationErrors && r.validationErrors.length > 0);
      default:
        return true;
    }
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Summary</CardTitle>
          <CardDescription className="flex items-center gap-2">
            {fileName}
            {sourceType === 'credit_card' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                <CreditCard className="w-3 h-3" />
                Credit Card
              </span>
            )}
            {detectedIssuer && detectedIssuer !== 'other' && (
              <span className="text-xs text-muted-foreground">
                ({detectedIssuer.replace('_', ' ')})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Total Rows</div>
              <div className="text-lg font-semibold text-foreground">{totalRows}</div>
            </div>
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Valid</div>
              <div className="text-lg font-semibold text-success">{validRows}</div>
            </div>
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Need Review</div>
              <div className="text-lg font-semibold text-warning">{reviewRows}</div>
            </div>
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Duplicates</div>
              <div className="text-lg font-semibold text-error">{duplicateRows}</div>
            </div>
          </div>

          {/* Transfer matches warning */}
          {transferMatches > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-warning">
                <ArrowLeftRight className="w-4 h-4" />
                <span className="font-medium">{transferMatches} potential transfer match{transferMatches > 1 ? 'es' : ''}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Some transactions may be the other side of existing transfers. 
                Review these to avoid duplicates.
              </p>
            </div>
          )}

          {/* Statement info for credit cards */}
          {statementInfo && (statementInfo.statementBalance !== undefined || statementInfo.minimumPayment !== undefined) && (
            <div className="p-3 bg-card border border-border rounded-lg">
              <div className="text-xs font-medium text-foreground mb-2">Statement Information</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {statementInfo.statementBalance !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Balance:</span>{' '}
                    <span className="font-mono">${statementInfo.statementBalance.toFixed(2)}</span>
                  </div>
                )}
                {statementInfo.minimumPayment !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Min Payment:</span>{' '}
                    <span className="font-mono">${statementInfo.minimumPayment.toFixed(2)}</span>
                  </div>
                )}
                {statementInfo.dueDate && (
                  <div>
                    <span className="text-muted-foreground">Due Date:</span>{' '}
                    <span>{statementInfo.dueDate}</span>
                  </div>
                )}
                {statementInfo.creditLimit !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Credit Limit:</span>{' '}
                    <span className="font-mono">${statementInfo.creditLimit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Record Details</CardTitle>
            <CardDescription>Review records before import</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
            disabled={selectableRows.length === 0}
          >
            {selectedRows.size === selectableRows.length ? 'Deselect All' : 'Select All'}
          </Button>
        </CardHeader>
        <CardContent>
          {staging.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center border border-border rounded-lg">
              <div className="space-y-2">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No records found in CSV file</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Flagged Records Section */}
              {flaggedRecords.length > 0 && (
                <div className="border border-warning/30 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 bg-warning/10 hover:bg-warning/15 transition-colors"
                    onClick={() => setFlaggedExpanded(!flaggedExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      {flaggedExpanded ? (
                        <ChevronDown className="w-4 h-4 text-warning" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-warning" />
                      )}
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <span className="font-medium text-warning">
                        Needs Review ({flaggedRecords.length})
                      </span>
                    </div>
                  </button>
                  {flaggedExpanded && (
                    <>
                      {/* Filter buttons */}
                      <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-warning/20 bg-warning/5">
                        <button
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            flagFilter === 'all'
                              ? 'bg-warning text-warning-foreground'
                              : 'bg-card hover:bg-elevated text-muted-foreground'
                          }`}
                          onClick={() => setFlagFilter('all')}
                        >
                          All ({flaggedRecords.length})
                        </button>
                        {duplicateCount > 0 && (
                          <button
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              flagFilter === 'duplicates'
                                ? 'bg-warning text-warning-foreground'
                                : 'bg-card hover:bg-elevated text-muted-foreground'
                            }`}
                            onClick={() => setFlagFilter('duplicates')}
                          >
                            Duplicates ({duplicateCount})
                          </button>
                        )}
                        {transferCount > 0 && (
                          <button
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              flagFilter === 'transfers'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-card hover:bg-elevated text-muted-foreground'
                            }`}
                            onClick={() => setFlagFilter('transfers')}
                          >
                            <span className="inline-flex items-center gap-1">
                              <ArrowLeftRight className="w-3 h-3" />
                              Transfers ({transferCount})
                            </span>
                          </button>
                        )}
                        {errorCount > 0 && (
                          <button
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              flagFilter === 'errors'
                                ? 'bg-error text-error-foreground'
                                : 'bg-card hover:bg-elevated text-muted-foreground'
                            }`}
                            onClick={() => setFlagFilter('errors')}
                          >
                            <span className="inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Errors ({errorCount})
                            </span>
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        <div className="space-y-2 p-3">
                          {filteredFlaggedRecords.length === 0 ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                              No records match the selected filter
                            </div>
                          ) : (
                            filteredFlaggedRecords.map((record) => (
                              <RecordRow
                                key={record.rowNumber}
                                record={record}
                                isSelected={selectedRows.has(record.rowNumber)}
                                onToggle={() => toggleRow(record.rowNumber)}
                                getStatusIcon={getStatusIcon}
                                getCCTypeIcon={getCCTypeIcon}
                                getCCTypeLabel={getCCTypeLabel}
                                transferDecision={transferDecisions.get(record.rowNumber)}
                                onTransferDecisionChange={(value) => setTransferDecision(record.rowNumber, value)}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Regular Records Section */}
              {regularRecords.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 bg-elevated hover:bg-elevated/80 transition-colors"
                    onClick={() => setRegularExpanded(!regularExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      {regularExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="font-medium text-foreground">
                        Ready to Import ({regularRecords.length})
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {regularRecords.filter(r => selectedRows.has(r.rowNumber)).length} selected
                    </span>
                  </button>
                  {regularExpanded && (
                    <div className="max-h-80 overflow-y-auto">
                      <div className="space-y-2 p-3">
                        {regularRecords.map((record) => (
                          <RecordRow
                            key={record.rowNumber}
                            record={record}
                            isSelected={selectedRows.has(record.rowNumber)}
                            onToggle={() => toggleRow(record.rowNumber)}
                            getStatusIcon={getStatusIcon}
                            getCCTypeIcon={getCCTypeIcon}
                            getCCTypeLabel={getCCTypeLabel}
                            transferDecision={transferDecisions.get(record.rowNumber)}
                            onTransferDecisionChange={(value) => setTransferDecision(record.rowNumber, value)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        {onBack && (
          <Button
            variant="outline"
            onClick={() => {
              console.log('Back to Mapping clicked');
              onBack();
            }}
            disabled={isLoading}
          >
            Back to Mapping
          </Button>
        )}
        <Button
          onClick={() => {
            console.log('Import button clicked, selectedRows:', selectedRows.size);
            // Build transfer decisions array for selected rows that have transfer detection
            const decisions: TransferDecision[] = [];
            selectedRows.forEach((rowNum) => {
              const record = staging.find((r) => r.rowNumber === rowNum);
              if (record?.accountNumberTransfer) {
                const importType = transferDecisions.get(rowNum) ?? 'transfer';
                decisions.push({
                  rowNumber: rowNum,
                  importType,
                  targetAccountId: record.accountNumberTransfer.accountId,
                  existingTransactionId: importType === 'link_existing'
                    ? record.accountNumberTransfer.existingMatch?.id
                    : undefined,
                });
              }
            });
            onConfirm(Array.from(selectedRows).map(String), decisions.length > 0 ? decisions : undefined);
          }}
          disabled={selectedRows.size === 0 || isLoading}
        >
          {isLoading ? 'Importing...' : `Import ${selectedRows.size} Records`}
        </Button>
      </div>
    </div>
  );
}
