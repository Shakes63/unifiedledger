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
  { value: 'date', label: 'Date' },
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Amount' },
  { value: 'category', label: 'Category' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'notes', label: 'Notes' },
  { value: 'account', label: 'Account' },
  { value: 'type', label: 'Type' },
];

const TRANSFORMS = [
  { value: '', label: 'None' },
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
    field: string,
    value: any
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Column Mappings</CardTitle>
          <CardDescription>
            Map CSV columns to transaction fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.map((mapping) => (
            <div key={mapping.csvColumn} className="space-y-2 p-4 bg-[#1a1a1a] rounded-lg">
              <div className="text-sm font-medium text-white">
                {mapping.csvColumn}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={mapping.appField}
                  onValueChange={(value) =>
                    updateMapping(mapping.csvColumn, 'appField', value)
                  }
                >
                  <SelectTrigger className="bg-[#0a0a0a]">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={mapping.transform || ''}
                  onValueChange={(value) =>
                    updateMapping(
                      mapping.csvColumn,
                      'transform',
                      value || undefined
                    )
                  }
                >
                  <SelectTrigger className="bg-[#0a0a0a]">
                    <SelectValue placeholder="Transform" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFORMS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeMapping(mapping.csvColumn)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {unmappedColumns.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-[#6b7280]">Unmapped columns:</div>
              {unmappedColumns.map((column) => (
                <div
                  key={column}
                  className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded"
                >
                  <span className="text-sm text-[#9ca3af]">{column}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addMapping(column)}
                  >
                    Map
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-[#6b7280]">
        <strong>Mapped:</strong> {mappings.length}/{headers.length} columns
      </div>
    </div>
  );
}
