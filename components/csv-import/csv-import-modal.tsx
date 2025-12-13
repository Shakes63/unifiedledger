'use client';

import { useState, useEffect } from 'react';
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
import { Upload, AlertCircle, CreditCard, Building2 } from 'lucide-react';
import { ColumnMapper } from './column-mapper';
import { ImportPreview, type StagingRecord } from './import-preview';
import { autoDetectMappings, type ColumnMapping } from '@/lib/csv-import';
import { toast } from 'sonner';
import { toastErrorWithHelp } from '@/lib/help/toast-with-help';
import { HELP_SECTIONS } from '@/lib/help/help-sections';
import { 
  detectCreditCard, 
  detectIssuerFromFilename,
  type CreditCardIssuer,
  type SourceType,
  type StatementInfo,
} from '@/lib/csv-import/credit-card-detection';
import { 
  findBestMatchingTemplate, 
  adaptTemplateMappings,
  CREDIT_CARD_TEMPLATES,
} from '@/lib/csv-import/cc-templates';

type Step = 'upload' | 'settings' | 'mapping' | 'preview' | 'complete';

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  accounts: Array<{ id: string; name: string }>;
  defaultTemplateId?: string;
}

export function CSVImportModal({
  open,
  onOpenChange,
  onSuccess,
  accounts,
  defaultTemplateId,
}: CSVImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [_fileContent, setFileContent] = useState<string>('');
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

  // Phase 12: Credit card detection state
  const [sourceType, setSourceType] = useState<SourceType>('auto');
  const [detectedSourceType, setDetectedSourceType] = useState<SourceType | null>(null);
  const [detectedIssuer, setDetectedIssuer] = useState<CreditCardIssuer | null>(null);
  const [detectionConfidence, setDetectionConfidence] = useState<number>(0);
  const [statementInfo, _setStatementInfo] = useState<StatementInfo | null>(null);
  const [amountSignConvention, setAmountSignConvention] = useState<'standard' | 'credit_card'>('standard');

  // Preview data - contains staged transactions and import stats
  const [previewData, setPreviewData] = useState<{
    staging?: StagingRecord[];
    totalRows?: number;
    validRows?: number;
    reviewRows?: number;
    duplicateRows?: number;
    importId?: string;
    sourceType?: SourceType;
    detectedIssuer?: string;
    statementInfo?: StatementInfo;
  } | null>(null);
  const [_importId, setImportId] = useState<string>('');

  // Load default template when modal opens
  useEffect(() => {
    if (open && defaultTemplateId) {
      loadDefaultTemplate(defaultTemplateId);
    }
  }, [open, defaultTemplateId]);

  const loadDefaultTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/import-templates/${templateId}`, { credentials: 'include' });
      if (!response.ok) {
        console.error('Failed to load default template');
        return;
      }

      const template = await response.json();

      // Apply template settings
      setDelimiter(template.delimiter || ',');
      setHasHeaderRow(template.hasHeaderRow ?? true);
      setSkipRows(template.skipRows || 0);
      setDateFormat(template.dateFormat || 'MM/DD/YYYY');

      if (template.defaultAccountId) {
        setDefaultAccountId(template.defaultAccountId);
      }

      // Parse and apply column mappings if they exist
      if (template.columnMappings) {
        try {
          const parsedMappings = typeof template.columnMappings === 'string'
            ? JSON.parse(template.columnMappings)
            : template.columnMappings;
          setMappings(parsedMappings);
        } catch (error) {
          console.error('Failed to parse column mappings:', error);
        }
      }

      toast.success(`Loaded template: ${template.name}`);
    } catch (error) {
      console.error('Error loading default template:', error);
    }
  };

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
        toastErrorWithHelp('No data found in CSV file', {
          description: 'Make sure your CSV has a header row and data rows.',
          helpSection: HELP_SECTIONS.IMPORT_EXPORT,
        });
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

      // Phase 12: Detect credit card from headers and sample data
      const sampleRows = (hasHeaderRow ? dataLines.slice(1) : dataLines)
        .slice(0, 20)
        .map(line => {
          const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, string> = {};
          csvHeaders.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          return row;
        });

      const detection = detectCreditCard(csvHeaders, sampleRows);
      setDetectedSourceType(detection.sourceType);
      setDetectedIssuer(detection.issuer || null);
      setDetectionConfidence(detection.confidence);
      setAmountSignConvention(detection.amountSignConvention);

      // Also check filename for issuer hints
      const filenameIssuer = detectIssuerFromFilename(selectedFile.name);
      if (filenameIssuer && !detection.issuer) {
        setDetectedIssuer(filenameIssuer);
      }

      // Try to find matching template for credit cards
      const isCreditCard = detection.sourceType === 'credit_card';
      let autoMappings: ColumnMapping[];

      if (isCreditCard) {
        const templateMatch = findBestMatchingTemplate(csvHeaders, detection.issuer || filenameIssuer);
        if (templateMatch && templateMatch.matchScore >= 60) {
          // Use template mappings adapted to actual headers
          autoMappings = adaptTemplateMappings(templateMatch.template, csvHeaders);
          setDateFormat(templateMatch.template.dateFormat);
          setAmountSignConvention(templateMatch.template.amountSignConvention);
          toast.success(`Detected ${templateMatch.template.name} format`);
        } else {
          // Use auto-detect with credit card flag
          autoMappings = autoDetectMappings(csvHeaders, true);
        }
      } else {
        autoMappings = autoDetectMappings(csvHeaders, false);
      }

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
      // Convert file to base64 for API (browser-compatible)
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binaryString = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binaryString);

      console.log('Sending preview request with mappings:', mappings);

      // Determine effective source type
      const effectiveSourceType = sourceType === 'auto' ? detectedSourceType : sourceType;

      // Call preview API
      const response = await fetch('/api/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
          // Phase 12: Credit card fields
          sourceType: effectiveSourceType,
          issuer: detectedIssuer,
          amountSignConvention,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Preview API error:', error);
        throw new Error(error.error || 'Failed to preview import');
      }

      const data = await response.json();
      console.log('Preview data received:', data);
      setPreviewData(data);
      setStep('preview');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to preview import';
      console.error('Preview error:', error);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async (recordIds?: (string | number)[]) => {
    console.log('handleConfirmImport called with recordIds:', recordIds);

    if (!file || !previewData) {
      console.error('Missing file or previewData:', { file: !!file, previewData: !!previewData });
      toast.error('Missing file or preview data');
      return;
    }

    console.log('Starting import process...');
    setIsLoading(true);
    try {
      // Convert file to base64 for API (browser-compatible)
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binaryString = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binaryString);
      console.log('File converted to base64, length:', base64.length);

      // Determine effective source type
      const effectiveSourceType = sourceType === 'auto' ? detectedSourceType : sourceType;

      // Call import API with previewOnly: false to save staging records
      const response = await fetch('/api/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
          // Phase 12: Credit card fields
          sourceType: effectiveSourceType,
          issuer: detectedIssuer,
          amountSignConvention,
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
    // If import was completed successfully, trigger refresh
    if (step === 'complete' && onSuccess) {
      onSuccess();
    }

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
                  <label className="flex items-center justify-center w-full p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-elevated transition-colors">
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
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
                <div className="p-3 bg-elevated rounded text-sm text-muted-foreground mt-4">
                  Selected: {fileName}
                </div>
              )}
            </>
          )}

          {/* Settings Step */}
          {step === 'settings' && (
            <div className="space-y-4">
              {/* Phase 12: Source type detection banner */}
              {detectedSourceType && detectionConfidence >= 50 && (
                <div className={`p-3 rounded-lg border ${
                  detectedSourceType === 'credit_card' 
                    ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30' 
                    : 'bg-elevated border-border'
                }`}>
                  <div className="flex items-center gap-2">
                    {detectedSourceType === 'credit_card' ? (
                      <CreditCard className="w-4 h-4 text-[var(--color-primary)]" />
                    ) : (
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {detectedSourceType === 'credit_card' ? 'Credit Card Statement' : 'Bank Statement'} Detected
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({detectionConfidence}% confidence)
                    </span>
                  </div>
                  {detectedIssuer && detectedIssuer !== 'other' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Detected issuer: {detectedIssuer.replace('_', ' ')}
                    </p>
                  )}
                </div>
              )}

              {/* Source Type Selector */}
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select 
                  value={sourceType} 
                  onValueChange={(value) => {
                    setSourceType(value as SourceType);
                    if (value === 'credit_card') {
                      setAmountSignConvention('credit_card');
                    } else if (value === 'bank') {
                      setAmountSignConvention('standard');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Credit Card Template (shown only for credit cards) */}
              {(sourceType === 'credit_card' || (sourceType === 'auto' && detectedSourceType === 'credit_card')) && (
                <div className="space-y-2">
                  <Label>Card Issuer Template</Label>
                  <Select 
                    value={detectedIssuer || 'other'} 
                    onValueChange={(value) => {
                      setDetectedIssuer(value as CreditCardIssuer);
                      // Apply template when selected
                      const template = CREDIT_CARD_TEMPLATES.find(t => t.issuer === value);
                      if (template) {
                        const adapted = adaptTemplateMappings(template, headers);
                        if (adapted.length > 0) {
                          setMappings(adapted);
                          setDateFormat(template.dateFormat);
                          setAmountSignConvention(template.amountSignConvention);
                          toast.success(`Applied ${template.name} template`);
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select issuer..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chase">Chase</SelectItem>
                      <SelectItem value="amex">American Express</SelectItem>
                      <SelectItem value="capital_one">Capital One</SelectItem>
                      <SelectItem value="discover">Discover</SelectItem>
                      <SelectItem value="citi">Citi</SelectItem>
                      <SelectItem value="bank_of_america">Bank of America</SelectItem>
                      <SelectItem value="wells_fargo">Wells Fargo</SelectItem>
                      <SelectItem value="other">Other / Generic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

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
          {step === 'preview' && (
            <>
              {previewData ? (
                <ImportPreview
                  staging={previewData.staging || []}
                  fileName={fileName}
                  totalRows={previewData.totalRows || 0}
                  validRows={previewData.validRows || 0}
                  reviewRows={previewData.reviewRows || 0}
                  duplicateRows={previewData.duplicateRows || 0}
                  onConfirm={handleConfirmImport}
                  onBack={() => setStep('mapping')}
                  isLoading={isLoading}
                  sourceType={previewData.sourceType || (sourceType === 'auto' ? detectedSourceType || undefined : sourceType)}
                  detectedIssuer={previewData.detectedIssuer || detectedIssuer || undefined}
                  statementInfo={previewData.statementInfo || statementInfo || undefined}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No preview data available. Please try again.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setStep('mapping')}
                        className="mt-4"
                      >
                        Back to Mapping
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <Card className="border-[var(--color-success)]">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="text-sm text-[var(--color-success)]">✓ Import completed</div>
                  <p className="text-sm text-muted-foreground">
                    Transactions have been imported successfully.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sticky Footer with Buttons */}
        {step !== 'preview' && (
          <div className="border-t border-border px-6 py-4 shrink-0 bg-background">
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
