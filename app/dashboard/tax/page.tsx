'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart } from '@/components/charts';
import { FileText, DollarSign, TrendingUp, AlertCircle, Building2, User, Download, Loader2, Landmark, GraduationCap, Home, Briefcase } from 'lucide-react';
import { getTaxPdfFilename } from '@/lib/tax/tax-pdf-export';
import { toast } from 'sonner';

type DeductionTypeFilter = 'all' | 'business' | 'personal';

interface TaxSummary {
  year: number;
  totalIncome: number;
  totalDeductions: number;
  businessDeductions: number;
  personalDeductions: number;
  taxableIncome: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    formType: string;
    lineNumber?: string;
    totalAmount: number;
    transactionCount: number;
    isDeductible: boolean;
    deductionType: 'business' | 'personal' | 'mixed';
  }>;
}

interface TaxData {
  summary: TaxSummary;
  estimates: {
    estimatedQuarterlyPayment: number;
    estimatedAnnualTax: number;
  };
  filter: {
    year: number;
    type: DeductionTypeFilter;
  };
}

// Interest deduction types from Phase 11
interface InterestDeductionByType {
  type: string;
  displayName: string;
  totalInterestPaid: number;
  totalDeductible: number;
  annualLimit: number | null;
  remainingCapacity: number | null;
  percentUsed: number | null;
  paymentCount: number;
}

interface InterestDeductionData {
  year: number;
  summary: {
    taxYear: number;
    byType: InterestDeductionByType[];
    totals: {
      totalInterestPaid: number;
      totalDeductible: number;
      totalLimitReductions: number;
    };
  };
  limitStatuses: Array<{
    type: string;
    limit: number | null;
    used: number;
    remaining: number | null;
    percentUsed: number | null;
    isAtLimit: boolean;
    isApproachingLimit: boolean;
  }>;
}

/**
 * Tax Dashboard Page
 * Comprehensive tax reporting and deduction tracking with business/personal separation
 */
export default function TaxPage() {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<DeductionTypeFilter>('all');
  const [data, setData] = useState<TaxData | null>(null);
  const [interestData, setInterestData] = useState<InterestDeductionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchTaxData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch both tax data and interest deduction data in parallel
      const [taxResponse, interestResponse] = await Promise.all([
        fetch(`/api/tax/summary?year=${year}&type=${typeFilter}`, { credentials: 'include' }),
        fetch(`/api/tax/interest-deductions?year=${year}`, { credentials: 'include' }),
      ]);

      if (!taxResponse.ok) {
        throw new Error('Failed to load tax data');
      }

      const taxResult = await taxResponse.json();
      setData(taxResult);

      // Interest data is optional - don't fail if it errors
      if (interestResponse.ok) {
        const interestResult = await interestResponse.json();
        setInterestData(interestResult);
      }
    } catch (err) {
      setError('Failed to load tax data. Please try again.');
      console.error('Error fetching tax data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, year]);

  useEffect(() => {
    fetchTaxData();
  }, [fetchTaxData]);

  // Get icon for interest deduction type
  const getInterestTypeIcon = (type: string) => {
    switch (type) {
      case 'mortgage':
        return <Home className="w-4 h-4" />;
      case 'student_loan':
        return <GraduationCap className="w-4 h-4" />;
      case 'business':
        return <Briefcase className="w-4 h-4" />;
      case 'heloc_home':
        return <Landmark className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  // Format interest type for display
  const formatInterestType = (type: string) => {
    switch (type) {
      case 'mortgage':
        return 'Mortgage Interest';
      case 'student_loan':
        return 'Student Loan Interest';
      case 'business':
        return 'Business Interest';
      case 'heloc_home':
        return 'HELOC/Home Equity';
      default:
        return type;
    }
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      options.push(i);
    }
    return options;
  };

  const handleExportPDF = async () => {
    if (!data || !data.summary.byCategory || data.summary.byCategory.length === 0) {
      toast.error('No tax data available to export');
      return;
    }

    try {
      setIsExporting(true);

      const res = await fetch(`/api/tax/export/pdf?year=${year}&type=${typeFilter}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        let message = 'Failed to export PDF';
        try {
          const json = await res.json();
          if (json?.error) message = json.error;
        } catch {
          // ignore parse failures (non-JSON response)
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      const headerFilename = res.headers.get('content-disposition')?.match(/filename=\"?([^\";]+)\"?/i)?.[1] || null;
      const fallbackFilename = getTaxPdfFilename(parseInt(year, 10), typeFilter);
      const filename = headerFilename || fallbackFilename;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Tax report exported to PDF');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const getDeductionTypeBadge = (type: 'business' | 'personal' | 'mixed') => {
    switch (type) {
      case 'business':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
            <Building2 className="w-3 h-3" />
            Business
          </span>
        );
      case 'personal':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success">
            <User className="w-3 h-3" />
            Personal
          </span>
        );
      case 'mixed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            Mixed
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading tax information...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-error font-medium mb-2">Error</p>
          <p className="text-muted-foreground mb-4">{error || 'Unknown error'}</p>
          <Button onClick={fetchTaxData}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Check if there's any data for the selected year
  const hasData = data.summary.byCategory && data.summary.byCategory.length > 0;
  const hasDeductions = data.summary.byCategory.filter((c) => c.isDeductible).length > 0;

  const deductionData = data.summary.byCategory
    .filter((c) => c.isDeductible)
    .map((c) => ({
      name: c.categoryName,
      amount: Math.abs(c.totalAmount),
      type: c.deductionType,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tax Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track deductions and prepare for tax season</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {getYearOptions().map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleExportPDF}
              disabled={isExporting || !hasData}
              variant="outline"
              className="flex items-center gap-2"
              aria-label="Export tax report to PDF"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <Button
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('all')}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            All Deductions
          </Button>
          <Button
            variant={typeFilter === 'business' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('business')}
            className="flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Business
          </Button>
          <Button
            variant={typeFilter === 'personal' ? 'default' : 'outline'}
            onClick={() => setTypeFilter('personal')}
            className="flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Personal
          </Button>
        </div>

        {/* No Data State */}
        {!hasData && (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Tax Data Available</h3>
              <p className="text-muted-foreground mb-4">
                There are no {typeFilter !== 'all' ? typeFilter : ''} transactions with tax-deductible categories for {year}.
              </p>
              <p className="text-sm text-muted-foreground">
                Start tracking your deductible expenses by marking categories as &quot;Tax Deductible&quot; in the Categories page.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        {hasData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-income">
                  ${data.summary.totalIncome.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Total Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  ${data.summary.totalDeductions.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className={typeFilter === 'personal' ? 'opacity-50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Business Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  ${data.summary.businessDeductions.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Schedule C</p>
              </CardContent>
            </Card>

            <Card className={typeFilter === 'business' ? 'opacity-50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Personal Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-success">
                  ${data.summary.personalDeductions.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Schedule A</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Est. Quarterly Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-warning">
                  ${data.estimates.estimatedQuarterlyPayment.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Annual: ${data.estimates.estimatedAnnualTax.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Interest Deductions Section (Phase 11) */}
        {interestData && interestData.summary.byType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5" />
                Deductible Interest Payments
              </CardTitle>
              <CardDescription>
                Interest from debt bills marked as tax deductible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {interestData.summary.byType.map((item) => {
                  const limitStatus = interestData.limitStatuses.find(s => s.type === item.type);
                  const hasLimit = item.annualLimit !== null;
                  const percentUsed = item.percentUsed || 0;
                  
                  return (
                    <div 
                      key={item.type} 
                      className={`p-4 rounded-lg border ${
                        limitStatus?.isAtLimit 
                          ? 'bg-error/10 border-error/30' 
                          : limitStatus?.isApproachingLimit 
                            ? 'bg-warning/10 border-warning/30'
                            : 'bg-elevated border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getInterestTypeIcon(item.type)}
                        <span className="text-sm font-medium text-foreground">
                          {formatInterestType(item.type)}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-income font-mono">
                        ${item.totalDeductible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.paymentCount} payment{item.paymentCount !== 1 ? 's' : ''}
                      </p>
                      
                      {hasLimit && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Annual Limit</span>
                            <span className={`font-medium ${
                              limitStatus?.isAtLimit 
                                ? 'text-error' 
                                : limitStatus?.isApproachingLimit 
                                  ? 'text-warning'
                                  : 'text-foreground'
                            }`}>
                              {percentUsed.toFixed(0)}% used
                            </span>
                          </div>
                          <div className="h-2 bg-border rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                limitStatus?.isAtLimit 
                                  ? 'bg-error' 
                                  : limitStatus?.isApproachingLimit 
                                    ? 'bg-warning'
                                    : 'bg-income'
                              }`}
                              style={{ width: `${Math.min(100, percentUsed)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            ${item.remainingCapacity?.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining of ${item.annualLimit?.toLocaleString('en-US')}
                          </p>
                        </div>
                      )}
                      
                      {!hasLimit && (
                        <p className="text-xs text-muted-foreground mt-3">
                          No annual limit
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Interest Totals Summary */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Interest Paid</p>
                  <p className="text-xl font-bold text-foreground font-mono">
                    ${interestData.summary.totals.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Deductible</p>
                  <p className="text-xl font-bold text-income font-mono">
                    ${interestData.summary.totals.totalDeductible.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Limited by Caps</p>
                  <p className="text-xl font-bold text-warning font-mono">
                    ${interestData.summary.totals.totalLimitReductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Deductions Chart */}
        {hasDeductions && deductionData.length > 0 && (
          <BarChart
            title="Top Tax Deductions"
            description={`Largest ${typeFilter !== 'all' ? typeFilter + ' ' : ''}deduction categories for ${year}`}
            data={deductionData}
            bars={[{ dataKey: 'amount', fill: 'var(--color-primary)', name: 'Amount' }]}
            layout="vertical"
          />
        )}

        {/* Detailed Breakdown */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Form Type */}
            <Card>
              <CardHeader>
                <CardTitle>Deductions by Form Type</CardTitle>
                <CardDescription>Organized by tax form for easy reference</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(
                    new Set(data.summary.byCategory.filter((c) => c.isDeductible).map((c) => c.formType))
                  ).map((formType) => {
                    const items = data.summary.byCategory.filter(
                      (c) => c.formType === formType && c.isDeductible
                    );
                    const total = items.reduce((sum, item) => sum + item.totalAmount, 0);
                    const isBusinessForm = formType === 'schedule_c';

                    return (
                      <div key={formType} className={`border-l-2 pl-4 ${isBusinessForm ? 'border-primary' : 'border-success'}`}>
                        <div className="flex items-center gap-2">
                          <p className="text-foreground font-semibold">
                            {formType.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          {isBusinessForm ? (
                            <span className="text-xs text-primary">(Business)</span>
                          ) : formType === 'schedule_a' ? (
                            <span className="text-xs text-success">(Personal)</span>
                          ) : null}
                        </div>
                        <p className={`text-2xl font-bold ${isBusinessForm ? 'text-primary' : 'text-success'}`}>
                          ${total.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{items.length} categories</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Tax Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Tax Year Summary</CardTitle>
                <CardDescription>Calculated from tracked transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-border">
                    <span className="text-muted-foreground">Total Income:</span>
                    <span className="text-foreground font-semibold">
                      ${data.summary.totalIncome.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-border">
                    <span className="text-muted-foreground">Business Deductions:</span>
                    <span className="text-primary font-semibold">
                      -${data.summary.businessDeductions.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-border">
                    <span className="text-muted-foreground">Personal Deductions:</span>
                    <span className="text-success font-semibold">
                      -${data.summary.personalDeductions.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-border">
                    <span className="text-muted-foreground">Taxable Income:</span>
                    <span className="text-warning font-bold text-lg">
                      ${data.summary.taxableIncome.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-card rounded-lg p-3 mt-4">
                    <p className="text-xs text-muted-foreground mb-2">ESTIMATED TAX PAYMENT</p>
                    <p className="text-2xl font-bold text-warning">
                      ${data.estimates.estimatedQuarterlyPayment.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Per quarter (est. annual: ${data.estimates.estimatedAnnualTax.toFixed(2)})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Deductions Table */}
        {hasDeductions && (
          <Card>
            <CardHeader>
              <CardTitle>All Deduction Categories</CardTitle>
              <CardDescription>Complete list of tracked tax deductions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 text-muted-foreground font-medium">Category</th>
                      <th className="text-left py-3 text-muted-foreground font-medium">Type</th>
                      <th className="text-left py-3 text-muted-foreground font-medium">Form</th>
                      <th className="text-right py-3 text-muted-foreground font-medium">Amount</th>
                      <th className="text-right py-3 text-muted-foreground font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.byCategory
                      .filter((c) => c.isDeductible)
                      .sort((a, b) => b.totalAmount - a.totalAmount)
                      .map((category) => (
                        <tr key={category.categoryId} className="border-b border-border/50 hover:bg-card">
                          <td className="py-3 text-foreground">{category.categoryName}</td>
                          <td className="py-3">{getDeductionTypeBadge(category.deductionType)}</td>
                          <td className="py-3 text-muted-foreground text-xs">
                            {category.formType.replace(/_/g, ' ').toUpperCase()}
                          </td>
                          <td className="py-3 text-right text-foreground font-medium font-mono">
                            ${category.totalAmount.toFixed(2)}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            {category.transactionCount}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Helpful Tips */}
        {hasData && (
          <Card className="bg-warning/10 border-warning/30">
            <CardHeader>
              <CardTitle className="text-warning flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Tax Preparation Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground/80">
              <p>
                - Keep detailed records of all transactions and receipts for audit purposes
              </p>
              <p>
                - Track business expenses separately from personal expenses using business accounts
              </p>
              <p>
                - Review your category mappings annually to ensure accuracy
              </p>
              <p>
                - Consider consulting a tax professional for complex situations
              </p>
              <p>
                - Make quarterly estimated tax payments to avoid penalties
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
