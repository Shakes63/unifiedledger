/**
 * Utilities for exporting report data to various formats
 */
import { getTodayLocalDateString } from '@/lib/utils/local-date';

/**
 * Export data to CSV format
 */
export function exportToCSV(data: Array<Record<string, unknown>>, filename: string): void {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.map((h) => `"${h}"`).join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '""';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          if (typeof value === 'number') return value;
          return `"${value}"`;
        })
        .join(',')
    ),
  ].join('\n');

  // Create and download
  downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Export chart data to JSON format
 */
export function exportToJSON(data: unknown, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
}

/**
 * Helper function to trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const element = document.createElement('a');
  element.setAttribute('href', `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`);
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

/**
 * Generate PDF from HTML using canvas and blob
 * Lightweight alternative without external PDF library
 */
export async function exportTableToCSV(
  tableElement: HTMLTableElement,
  filename: string
): Promise<void> {
  const rows: string[] = [];

  // Get all rows
  const allRows = tableElement.querySelectorAll('tr');

  allRows.forEach((row) => {
    const cells: string[] = [];
    row.querySelectorAll('td, th').forEach((cell) => {
      let value = cell.textContent || '';
      value = value.trim();

      // Escape quotes and wrap in quotes if contains comma
      if (value.includes(',') || value.includes('"')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      cells.push(value);
    });

    if (cells.length > 0) {
      rows.push(cells.join(','));
    }
  });

  const csvContent = rows.join('\n');
  downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Format date for export filename
 */
export function getExportFilename(reportName: string, format: string = 'csv'): string {
  const date = getTodayLocalDateString();
  return `${reportName}_${date}.${format}`;
}

/**
 * Prepare report data for export with summary
 */
export function prepareReportForExport(
  reportName: string,
  data: unknown,
  summary?: Record<string, unknown>
): {
  data: unknown;
  summary: Record<string, unknown>;
  exportedAt: string;
  reportName: string;
} {
  return {
    reportName,
    data,
    summary: summary || {},
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Create a summary row for CSV export
 */
export function createSummaryRow(summary: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  row[''] = 'SUMMARY';

  Object.entries(summary).forEach(([key, value]) => {
    if (typeof value === 'number') {
      row[key] = value.toFixed(2);
    } else {
      row[key] = value;
    }
  });

  return row;
}
