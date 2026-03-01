'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type ColumnMapping } from '@/lib/csv-import';

const APP_FIELDS = [
  { value: 'date', label: 'Date', group: 'Required' },
  { value: 'description', label: 'Description', group: 'Required' },
  { value: 'amount', label: 'Amount', group: 'Amount' },
  { value: 'withdrawal', label: 'Withdrawal (Expense)', group: 'Amount' },
  { value: 'deposit', label: 'Deposit (Income)', group: 'Amount' },
  { value: 'category', label: 'Category', group: 'Optional' },
  { value: 'merchant', label: 'Merchant', group: 'Optional' },
  { value: 'notes', label: 'Notes', group: 'Optional' },
  { value: 'account', label: 'Account', group: 'Optional' },
  { value: 'type', label: 'Type', group: 'Optional' },
  // Phase 12: Credit card specific fields
  { value: 'cc_transaction_type', label: 'CC Transaction Type', group: 'Credit Card' },
  { value: 'reference_number', label: 'Reference Number', group: 'Credit Card' },
  { value: 'statement_balance', label: 'Statement Balance', group: 'Statement Info' },
  { value: 'statement_date', label: 'Statement Date', group: 'Statement Info' },
  { value: 'statement_due_date', label: 'Due Date', group: 'Statement Info' },
  { value: 'minimum_payment', label: 'Minimum Payment', group: 'Statement Info' },
  { value: 'credit_limit', label: 'Credit Limit', group: 'Statement Info' },
  { value: 'available_credit', label: 'Available Credit', group: 'Statement Info' },
];

const TRANSFORMS = [
  { value: 'none', label: 'None' },
  { value: 'negate', label: 'Negate' },
  { value: 'absolute', label: 'Absolute Value' },
  { value: 'trim', label: 'Trim' },
  { value: 'uppercase', label: 'Uppercase' },
  { value: 'lowercase', label: 'Lowercase' },
];

interface ColumnMapperProps {
  headers: string[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  initialMappings?: ColumnMapping[];
}

export function ColumnMapper({
  headers,
  onMappingsChange,
  initialMappings = [],
}: ColumnMapperProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(initialMappings);

  const updateMapping = (
    csvColumn: string,
    field: keyof ColumnMapping,
    value: string | undefined
  ) => {
    const updated = mappings.map((m) =>
      m.csvColumn === csvColumn ? { ...m, [field]: value } : m
    );
    setMappings(updated);
    onMappingsChange(updated);
  };

  const addMapping = (csvColumn: string) => {
    const newMapping: ColumnMapping = {
      csvColumn,
      appField: 'description',
      transform: undefined,
    };
    const updated = [...mappings, newMapping];
    setMappings(updated);
    onMappingsChange(updated);
  };

  const removeMapping = (csvColumn: string) => {
    const updated = mappings.filter((m) => m.csvColumn !== csvColumn);
    setMappings(updated);
    onMappingsChange(updated);
  };

  const mappedColumns = new Set(mappings.map((m) => m.csvColumn));
  const unmappedColumns = headers.filter((h) => !mappedColumns.has(h));

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Column Mappings</CardTitle>
          <CardDescription className="text-xs">
            Map CSV columns to transaction fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {mappings.map((mapping) => (
            <div key={mapping.csvColumn} className="space-y-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
              <div className="text-xs font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                {mapping.csvColumn}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Select
                  value={mapping.appField}
                  onValueChange={(value) =>
                    updateMapping(mapping.csvColumn, 'appField', value)
                  }
                >
                  <SelectTrigger className="h-8 text-xs" style={{ backgroundColor: 'var(--color-background)' }}>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value} className="text-xs">
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={mapping.transform || 'none'}
                  onValueChange={(value) =>
                    updateMapping(
                      mapping.csvColumn,
                      'transform',
                      value || undefined
                    )
                  }
                >
                  <SelectTrigger className="h-8 text-xs" style={{ backgroundColor: 'var(--color-background)' }}>
                    <SelectValue placeholder="Transform" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFORMS.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => removeMapping(mapping.csvColumn)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {unmappedColumns.length > 0 && (
            <div className="space-y-2 pt-2 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Unmapped columns:</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {unmappedColumns.map((column) => (
                  <div
                    key={column}
                    className="flex items-center justify-between p-2 rounded text-xs"
                    style={{ backgroundColor: 'var(--color-background)' }}
                  >
                    <span className="truncate flex-1 mr-2" style={{ color: 'var(--color-muted-foreground)' }}>{column}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => addMapping(column)}
                    >
                      Map
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs px-1" style={{ color: 'var(--color-muted-foreground)' }}>
        <strong>Mapped:</strong> {mappings.length}/{headers.length} columns
      </div>
    </div>
  );
}
