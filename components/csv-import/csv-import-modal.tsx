'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, AlertCircle } from 'lucide-react';
import { ColumnMapper } from './column-mapper';
import { ImportPreview } from './import-preview';
import { autoDetectMappings, parseCSVFile, type ColumnMapping } from '@/lib/csv-import';
import { toast } from 'sonner';

type Step = 'upload' | 'settings' | 'mapping' | 'preview' | 'complete';

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Array<{ id: string; name: string }>;
}

export function CSVImportModal({
  open,
  onOpenChange,
  accounts,
}: CSVImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Settings
  const [delimiter, setDelimiter] = useState(',');
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [skipRows, setSkipRows] = useState(0);
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [defaultAccountId, setDefaultAccountId] = useState(
    accounts[0]?.id || ''
  );

  // Mappings
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // Preview data
  const [previewData, setPreviewData] = useState<any>(null);
  const [importId, setImportId] = useState<string>('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      setFile(selectedFile);
      setFileName(selectedFile.name);

      // Read file to detect headers
      const text = await selectedFile.text();
      setFileContent(text);

      const lines = text.split('\n').filter((line) => line.trim());
      const dataLines = lines.slice(skipRows);

      if (dataLines.length === 0) {
        toast.error('No data found in CSV file');
        return;
      }

      const csvHeaders = hasHeaderRow
        ? dataLines[0]
            .split(delimiter)
            .map((h) => h.trim().replace(/^"|"$/g, ''))
        : dataLines[0]
            .split(delimiter)
            .map((_, i) => `Column ${i + 1}`);

      setHeaders(csvHeaders);

      // Auto-detect mappings
      const autoMappings = autoDetectMappings(csvHeaders);
      setMappings(autoMappings);

      setStep('settings');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to read file';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToMapping = async () => {
    setStep('mapping');
  };

  const handleProceedToPreview = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      // Convert file to base64 for API
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const binaryString = String.fromCharCode.apply(null, Array.from(bytes) as any);
      const base64 = Buffer.from(binaryString, 'binary').toString('base64');

      // Call preview API
      const response = await fetch('/api/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          fileName,
          columnMappings: mappings,
          dateFormat,
          delimiter,
          hasHeaderRow,
          skipRows,
          defaultAccountId,
          previewOnly: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to preview import');
      }

      const data = await response.json();
      setPreviewData(data);
      setStep('preview');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to preview import';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async (recordIds?: (string | number)[]) => {
    if (!file || !previewData) return;

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const binaryString = String.fromCharCode.apply(null, Array.from(bytes) as any);
      const base64 = Buffer.from(binaryString, 'binary').toString('base64');

      // Call import API with previewOnly: false to save staging records
      const response = await fetch('/api/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          fileName,
          columnMappings: mappings,
          dateFormat,
          delimiter,
          hasHeaderRow,
          skipRows,
          defaultAccountId,
          previewOnly: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process import');
      }

      const importData = await response.json();
      setImportId(importData.importHistoryId);

      // Confirm import with selected records
      const confirmResponse = await fetch(
        `/api/csv-import/${importData.importHistoryId}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordIds: recordIds || [] }),
        }
      );

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm import');
      }

      setStep('complete');
      toast.success('Import completed successfully!');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to complete import';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state
    setStep('upload');
    setFile(null);
    setFileName('');
    setHeaders([]);
    setMappings([]);
    setPreviewData(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Import Transactions from CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a CSV file to import'}
            {step === 'settings' && 'Configure import settings'}
            {step === 'mapping' && 'Map CSV columns to fields'}
            {step === 'preview' && 'Review records before import'}
            {step === 'complete' && 'Import completed'}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {/* Upload Step */}
          {step === 'upload' && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <label className="flex items-center justify-center w-full p-8 border-2 border-dashed border-[#3a3a3a] rounded-lg cursor-pointer hover:bg-[#1a1a1a] transition-colors">
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-[#6b7280]" />
                      <p className="text-sm text-[#9ca3af]">
                        Click to select a CSV file
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      disabled={isLoading}
                      className="hidden"
                    />
                  </label>
                </CardContent>
              </Card>

              {file && (
                <div className="p-3 bg-[#1a1a1a] rounded text-sm text-[#9ca3af] mt-4">
                  Selected: {fileName}
                </div>
              )}
            </>
          )}

          {/* Settings Step */}
          {step === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Delimiter</Label>
                <Select value={delimiter} onValueChange={setDelimiter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value="\t">Tab</SelectItem>
                    <SelectItem value="|">Pipe (|)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select value={dateFormat} onValueChange={setDateFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="MM-DD-YYYY">MM-DD-YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Account</Label>
                <Select value={defaultAccountId} onValueChange={setDefaultAccountId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="hasHeader"
                    checked={hasHeaderRow}
                    onCheckedChange={(checked) =>
                      setHasHeaderRow(checked as boolean)
                    }
                  />
                  <Label htmlFor="hasHeader" className="font-normal cursor-pointer">
                    First row contains headers
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Skip rows</Label>
                <Input
                  type="number"
                  min="0"
                  value={skipRows}
                  onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {step === 'mapping' && (
            <ColumnMapper
              headers={headers}
              initialMappings={mappings}
              onMappingsChange={setMappings}
            />
          )}

          {/* Preview Step */}
          {step === 'preview' && previewData && (
            <ImportPreview
              staging={previewData.staging}
              fileName={fileName}
              totalRows={previewData.totalRows}
              validRows={previewData.validRows}
              reviewRows={previewData.reviewRows}
              duplicateRows={previewData.duplicateRows}
              onConfirm={handleConfirmImport}
              isLoading={isLoading}
            />
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <Card className="border-[#10b981]">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="text-sm text-[#10b981]">✓ Import completed</div>
                  <p className="text-sm text-[#9ca3af]">
                    Transactions have been imported successfully.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sticky Footer with Buttons */}
        {step !== 'preview' && (
          <div className="border-t border-[#2a2a2a] px-6 py-4 shrink-0 bg-[#0a0a0a]">
            <div className="flex gap-2 justify-end">
              {step === 'upload' && (
                <>
                  <Button variant="outline" onClick={() => handleClose()}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setStep('settings')}
                    disabled={!file || isLoading}
                  >
                    Next
                  </Button>
                </>
              )}

              {step === 'settings' && (
                <>
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Back
                  </Button>
                  <Button onClick={handleProceedToMapping}>Next</Button>
                </>
              )}

              {step === 'mapping' && (
                <>
                  <Button variant="outline" onClick={() => setStep('settings')}>
                    Back
                  </Button>
                  <Button onClick={handleProceedToPreview} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Preview'}
                  </Button>
                </>
              )}

              {step === 'complete' && (
                <Button onClick={handleClose}>
                  Done
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
