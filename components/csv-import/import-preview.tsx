'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StagingRecord {
  rowNumber: number;
  status: 'pending' | 'review' | 'approved' | 'skipped' | 'imported';
  validationErrors?: string[];
  duplicateOf?: string;
  duplicateScore?: number;
  data?: any;
}

interface ImportPreviewProps {
  staging: StagingRecord[];
  fileName: string;
  totalRows: number;
  validRows: number;
  reviewRows: number;
  duplicateRows: number;
  onConfirm: (recordIds?: string[]) => Promise<void>;
  onBack?: () => void;
  isLoading?: boolean;
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
}: ImportPreviewProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(
    new Set(staging.filter((r) => r.status === 'approved').map((r) => r.rowNumber))
  );

  const toggleRow = (rowNumber: number) => {
    const updated = new Set(selectedRows);
    if (updated.has(rowNumber)) {
      updated.delete(rowNumber);
    } else {
      updated.add(rowNumber);
    }
    setSelectedRows(updated);
  };

  const toggleAll = () => {
    if (selectedRows.size === validRows) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(
        new Set(
          staging
            .filter((r) => r.status === 'approved')
            .map((r) => r.rowNumber)
        )
      );
    }
  };

  const getStatusIcon = (status: string, errors?: string[]) => {
    if (errors && errors.length > 0) {
      return (
        <AlertCircle className="w-4 h-4 text-[var(--color-error)]" />
      );
    }
    if (status === 'approved') {
      return (
        <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
      );
    }
    return (
      <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Summary</CardTitle>
          <CardDescription>{fileName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Total Rows</div>
              <div className="text-lg font-semibold text-foreground">{totalRows}</div>
            </div>
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Valid</div>
              <div className="text-lg font-semibold text-[var(--color-success)]">{validRows}</div>
            </div>
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Need Review</div>
              <div className="text-lg font-semibold text-[var(--color-warning)]">{reviewRows}</div>
            </div>
            <div className="p-2 bg-elevated rounded">
              <div className="text-xs text-muted-foreground">Duplicates</div>
              <div className="text-lg font-semibold text-[var(--color-error)]">{duplicateRows}</div>
            </div>
          </div>
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
            disabled={validRows === 0}
          >
            {selectedRows.size === validRows ? 'Deselect All' : 'Select All'}
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 border border-border rounded-lg">
            <div className="space-y-2 p-4">
              {staging.length === 0 ? (
                <div className="flex items-center justify-center h-80 text-center">
                  <div className="space-y-2">
                    <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No records found in CSV file</p>
                  </div>
                </div>
              ) : (
                staging.map((record) => (
                  <div
                    key={record.rowNumber}
                    className="p-3 bg-elevated rounded border border-border hover:border-border cursor-pointer transition-colors"
                    onClick={() => toggleRow(record.rowNumber)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(record.rowNumber)}
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
                            <div>
                              <span className="text-muted-foreground">Amount:</span> ${record.data.amount || '0.00'}
                              {record.data.type && (
                                <span className="ml-2 text-muted-foreground">({record.data.type})</span>
                              )}
                            </div>
                            <div className="truncate">
                              <span className="text-muted-foreground">Date:</span> {record.data.date || 'N/A'}
                            </div>
                          </div>
                        )}

                        {record.validationErrors && record.validationErrors.length > 0 && (
                          <div className="text-xs text-[var(--color-error)] mt-2 space-y-1">
                            {record.validationErrors.map((error, i) => (
                              <div key={`error-${record.rowNumber}-${i}`}>{error}</div>
                            ))}
                          </div>
                        )}

                        {record.duplicateOf && (
                          <div className="text-xs text-[var(--color-warning)] mt-2">
                            Possible duplicate ({record.duplicateScore?.toFixed(0)}% match)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
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
            onConfirm(Array.from(selectedRows).map(String));
          }}
          disabled={selectedRows.size === 0 || isLoading}
        >
          {isLoading ? 'Importing...' : `Import ${selectedRows.size} Records`}
        </Button>
      </div>
    </div>
  );
}
