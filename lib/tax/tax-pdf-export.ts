/**
 * Tax Dashboard PDF Export Utility
 * Generates professional PDF reports for accountants
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TaxCategoryData {
  categoryId: string;
  categoryName: string;
  formType: string;
  lineNumber?: string;
  totalAmount: number;
  transactionCount: number;
  isDeductible: boolean;
  deductionType: 'business' | 'personal' | 'mixed';
}

export interface TaxExportData {
  year: number;
  totalIncome: number;
  totalDeductions: number;
  businessDeductions: number;
  personalDeductions: number;
  taxableIncome: number;
  estimatedQuarterlyPayment: number;
  estimatedAnnualTax: number;
  categories: TaxCategoryData[];
  filterType: 'all' | 'business' | 'personal';
}

/**
 * Format currency value for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format form type for display
 */
function formatFormType(formType: string): string {
  return formType.replace(/_/g, ' ').toUpperCase();
}

/**
 * Get filter label for display
 */
function getFilterLabel(filterType: 'all' | 'business' | 'personal'): string {
  switch (filterType) {
    case 'business':
      return 'Business Only';
    case 'personal':
      return 'Personal Only';
    default:
      return 'All Deductions';
  }
}

/**
 * Build a stable filename for the PDF export.
 */
export function getTaxPdfFilename(
  year: number,
  filterType: TaxExportData['filterType']
): string {
  const filterSuffix = filterType !== 'all' ? `_${filterType}` : '';
  return `tax_deductions_${year}${filterSuffix}.pdf`;
}

function createTaxPdfDocument(
  data: TaxExportData,
  options?: { generatedAt?: Date }
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Colors (using fixed colors for print compatibility)
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const successColor: [number, number, number] = [34, 197, 94]; // Green
  const textColor: [number, number, number] = [31, 41, 55]; // Dark gray
  const mutedColor: [number, number, number] = [107, 114, 128]; // Gray

  // ============================================
  // HEADER
  // ============================================
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX DEDUCTION SUMMARY', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tax Year ${data.year} | ${getFilterLabel(data.filterType)}`, pageWidth / 2, 28, { align: 'center' });

  yPos = 45;

  // Generation date
  const generatedAt = options?.generatedAt ?? new Date();
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.text(`Generated: ${generatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`, margin, yPos);
  yPos += 10;

  // ============================================
  // SUMMARY SECTION
  // ============================================
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMMARY', margin, yPos);
  yPos += 2;

  // Draw underline
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, margin + 40, yPos);
  yPos += 8;

  // Summary items
  const summaryItems = [
    { label: 'Total Income:', value: formatCurrency(data.totalIncome), color: successColor },
    { label: 'Total Deductions:', value: formatCurrency(data.totalDeductions), color: primaryColor },
    { label: 'Business Deductions:', value: formatCurrency(data.businessDeductions), color: primaryColor },
    { label: 'Personal Deductions:', value: formatCurrency(data.personalDeductions), color: successColor },
    { label: 'Taxable Income:', value: formatCurrency(data.taxableIncome), color: textColor },
    { label: 'Est. Quarterly Tax:', value: formatCurrency(data.estimatedQuarterlyPayment), color: [234, 179, 8] as [number, number, number] }, // Warning/yellow
    { label: 'Est. Annual Tax:', value: formatCurrency(data.estimatedAnnualTax), color: [234, 179, 8] as [number, number, number] },
  ];

  doc.setFontSize(10);
  summaryItems.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(item.label, margin, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(item.value, margin + 45, yPos);
    yPos += 6;
  });

  yPos += 10;

  // ============================================
  // DEDUCTIONS BY FORM TYPE
  // ============================================
  const deductibleCategories = data.categories.filter((c) => c.isDeductible);

  if (deductibleCategories.length > 0) {
    doc.setTextColor(...textColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DEDUCTIONS BY CATEGORY', margin, yPos);
    yPos += 2;

    // Draw underline
    doc.setDrawColor(...primaryColor);
    doc.line(margin, yPos, margin + 60, yPos);
    yPos += 8;

    // Group categories by form type
    const formTypes = Array.from(new Set(deductibleCategories.map((c) => c.formType)));

    formTypes.forEach((formType) => {
      const formCategories = deductibleCategories.filter((c) => c.formType === formType);
      const formTotal = formCategories.reduce((sum, c) => sum + c.totalAmount, 0);
      const isBusinessForm = formType === 'schedule_c';

      // Check if we need a new page
      if (yPos > 230) {
        doc.addPage();
        yPos = margin;
      }

      // Form type header
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(isBusinessForm ? primaryColor : successColor));
      doc.text(`${formatFormType(formType)} ${isBusinessForm ? '(Business)' : formType === 'schedule_a' ? '(Personal)' : ''}`, margin, yPos);
      yPos += 6;

      // Category table
      const tableData = formCategories.map((c) => [
        c.categoryName,
        c.lineNumber ? `Line ${c.lineNumber}` : '-',
        c.transactionCount.toString(),
        formatCurrency(c.totalAmount),
      ]);

      // Add subtotal row
      tableData.push([
        'SUBTOTAL',
        '',
        formCategories.reduce((sum, c) => sum + c.transactionCount, 0).toString(),
        formatCurrency(formTotal),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Category', 'Form Line', 'Count', 'Amount']],
        body: tableData,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 9,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: isBusinessForm ? primaryColor : successColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        bodyStyles: {
          textColor: textColor,
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
          // Style the subtotal row
          if (hookData.row.index === tableData.length - 1 && hookData.section === 'body') {
            hookData.cell.styles.fillColor = [229, 231, 235];
            hookData.cell.styles.fontStyle = 'bold';
          }
        },
      });

      // Get the final Y position after the table
      yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    doc.text('No deductible categories found for the selected filter.', margin, yPos);
    yPos += 15;
  }

  // ============================================
  // NOTES / DISCLAIMER
  // ============================================
  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, yPos, contentWidth, 30, 2, 2, 'F');
  
  yPos += 6;
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTANT NOTES', margin + 4, yPos);
  yPos += 5;
  
  doc.setFont('helvetica', 'normal');
  const notes = [
    'This report is generated from tracked transactions and is for informational purposes only.',
    'Consult a qualified tax professional for tax advice and filing assistance.',
    'Ensure all transactions are properly categorized before using this report for tax preparation.',
  ];
  
  notes.forEach((note) => {
    doc.text(`• ${note}`, margin + 4, yPos);
    yPos += 4;
  });

  // ============================================
  // FOOTER
  // ============================================
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // ============================================
  // DOWNLOAD
  // ============================================
  return doc;
}

/**
 * Generate PDF bytes as an ArrayBuffer (server/test friendly).
 */
export function generateTaxPdfArrayBuffer(
  data: TaxExportData,
  options?: { generatedAt?: Date }
): ArrayBuffer {
  const doc = createTaxPdfDocument(data, options);
  return doc.output('arraybuffer') as ArrayBuffer;
}

/**
 * Generate and download a PDF report of tax deductions (client helper).
 */
export function exportTaxToPDF(data: TaxExportData): void {
  const filename = getTaxPdfFilename(data.year, data.filterType);
  const doc = createTaxPdfDocument(data);
  doc.save(filename);
}

