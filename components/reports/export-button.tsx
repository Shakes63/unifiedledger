'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileText } from 'lucide-react';
import { exportToCSV, exportToJSON, getExportFilename, prepareReportForExport } from '@/lib/reports/export-utils';
import { toast } from 'sonner';

interface ExportButtonProps {
  data: any;
  reportName: string;
  summary?: Record<string, any>;
}

/**
 * Export button component for reports
 * Allows exporting to CSV and JSON formats
 */
export function ExportButton({ data, reportName, summary }: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExportCSV = async () => {
    try {
      setIsLoading(true);
      const filename = getExportFilename(reportName, 'csv');

      // Prepare data for export
      const csvData = Array.isArray(data) ? data : data.data || [data];

      // Add summary row if available
      if (summary) {
        const summaryRow = {
          '': '--- SUMMARY ---',
          ...summary,
        };
        csvData.push(summaryRow);
      }

      exportToCSV(csvData, filename);
      toast.success(`${reportName} exported to CSV`);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast.error('Failed to export to CSV');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      setIsLoading(true);
      const filename = getExportFilename(reportName, 'json');

      // Prepare complete report
      const reportData = prepareReportForExport(reportName, data, summary);

      exportToJSON(reportData, filename);
      toast.success(`${reportName} exported to JSON`);
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      toast.error('Failed to export to JSON');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV} disabled={isLoading}>
          <FileText className="w-4 h-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON} disabled={isLoading}>
          <FileJson className="w-4 h-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
