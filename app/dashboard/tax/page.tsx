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
import { useHousehold } from '@/contexts/household-context';

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
  const { selectedHouseholdId } = useHousehold();
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [typeFilter, setTypeFilter] = useState<DeductionTypeFilter>('all');
  const [data, setData] = useState<TaxData | null>(null);
  const [interestData, setInterestData] = useState<InterestDeductionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchTaxData = useCallback(async () => {
    try {
      if (!selectedHouseholdId) {
        setError('No household selected');
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);

      // Fetch both tax data and interest deduction data in parallel
      const [taxResponse, interestResponse] = await Promise.all([
        fetch(`/api/tax/summary?year=${year}&type=${typeFilter}`, {
          credentials: 'include',
          headers: { 'x-household-id': selectedHouseholdId },
        }),
        fetch(`/api/tax/interest-deductions?year=${year}`, {
          credentials: 'include',
          headers: { 'x-household-id': selectedHouseholdId },
        }),
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
  }, [typeFilter, year, selectedHouseholdId]);

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
        headers: selectedHouseholdId ? { 'x-household-id': selectedHouseholdId } : undefined,
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 20%, transparent)', color: 'var(--color-primary)' }}>
            <Building2 className="w-3 h-3" />
            Business
          </span>
        );
      case 'personal':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)', color: 'var(--color-success)' }}>
            <User className="w-3 h-3" />
            Personal
          </span>
        );
      case 'mixed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
            Mixed
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-primary)' }}></div>
          <p style={{ color: 'var(--color-muted-foreground)' }}>Loading tax information...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="font-medium mb-2" style={{ color: 'var(--color-destructive)' }}>Error</p>
          <p className="mb-4" style={{ color: 'var(--color-muted-foreground)' }}>{error || 'Unknown error'}</p>
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
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-foreground)' }}>Tax Dashboard</h1>
            <p className="mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Track deductions and prepare for tax season</p>
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
              <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-muted-foreground)' }} />
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>No Tax Data Available</h3>
              <p className="mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
                There are no {typeFilter !== 'all' ? typeFilter : ''} transactions with tax-deductible categories for {year}.
              </p>
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
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
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  <TrendingUp className="w-4 h-4" />
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-income)' }}>
                  ${data.summary.totalIncome.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  <DollarSign className="w-4 h-4" />
                  Total Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                  ${data.summary.totalDeductions.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className={typeFilter === 'personal' ? 'opacity-50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  <Building2 className="w-4 h-4" />
                  Business Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                  ${data.summary.businessDeductions.toFixed(2)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Schedule C</p>
              </CardContent>
            </Card>

            <Card className={typeFilter === 'business' ? 'opacity-50' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  <User className="w-4 h-4" />
                  Personal Deductions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
                  ${data.summary.personalDeductions.toFixed(2)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Schedule A</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  <AlertCircle className="w-4 h-4" />
                  Est. Quarterly Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>
                  ${data.estimates.estimatedQuarterlyPayment.toFixed(2)}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
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
                      className="p-4 rounded-lg border"
                      style={
                        limitStatus?.isAtLimit 
                          ? { backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)', borderColor: 'color-mix(in oklch, var(--color-destructive) 30%, transparent)' }
                          : limitStatus?.isApproachingLimit 
                            ? { backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', borderColor: 'color-mix(in oklch, var(--color-warning) 30%, transparent)' }
                            : { backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }
                      }
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getInterestTypeIcon(item.type)}
                        <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                          {formatInterestType(item.type)}
                        </span>
                      </div>
                      <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-income)' }}>
                        ${item.totalDeductible.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        {item.paymentCount} payment{item.paymentCount !== 1 ? 's' : ''}
                      </p>
                      
                      {hasLimit && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span style={{ color: 'var(--color-muted-foreground)' }}>Annual Limit</span>
                            <span 
                              className="font-medium"
                              style={{ 
                                color: limitStatus?.isAtLimit ? 'var(--color-destructive)' : limitStatus?.isApproachingLimit ? 'var(--color-warning)' : 'var(--color-foreground)' 
                              }}
                            >
                              {percentUsed.toFixed(0)}% used
                            </span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ 
                                backgroundColor: limitStatus?.isAtLimit ? 'var(--color-destructive)' : limitStatus?.isApproachingLimit ? 'var(--color-warning)' : 'var(--color-income)',
                                width: `${Math.min(100, percentUsed)}%`
                              }}
                            />
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                            ${item.remainingCapacity?.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining of ${item.annualLimit?.toLocaleString('en-US')}
                          </p>
                        </div>
                      )}
                      
                      {!hasLimit && (
                        <p className="text-xs mt-3" style={{ color: 'var(--color-muted-foreground)' }}>
                          No annual limit
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Interest Totals Summary */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-center">
                  <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Total Interest Paid</p>
                  <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-foreground)' }}>
                    ${interestData.summary.totals.totalInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Total Deductible</p>
                  <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-income)' }}>
                    ${interestData.summary.totals.totalDeductible.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Limited by Caps</p>
                  <p className="text-xl font-bold font-mono" style={{ color: 'var(--color-warning)' }}>
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
                      <div key={formType} className="border-l-2 pl-4" style={{ borderColor: isBusinessForm ? 'var(--color-primary)' : 'var(--color-success)' }}>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
                            {formType.replace(/_/g, ' ').toUpperCase()}
                          </p>
                          {isBusinessForm ? (
                            <span className="text-xs" style={{ color: 'var(--color-primary)' }}>(Business)</span>
                          ) : formType === 'schedule_a' ? (
                            <span className="text-xs" style={{ color: 'var(--color-success)' }}>(Personal)</span>
                          ) : null}
                        </div>
                        <p className="text-2xl font-bold" style={{ color: isBusinessForm ? 'var(--color-primary)' : 'var(--color-success)' }}>
                          ${total.toFixed(2)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{items.length} categories</p>
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
                  <div className="flex justify-between items-center pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-muted-foreground)' }}>Total Income:</span>
                    <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
                      ${data.summary.totalIncome.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-muted-foreground)' }}>Business Deductions:</span>
                    <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                      -${data.summary.businessDeductions.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-muted-foreground)' }}>Personal Deductions:</span>
                    <span className="font-semibold" style={{ color: 'var(--color-success)' }}>
                      -${data.summary.personalDeductions.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-muted-foreground)' }}>Taxable Income:</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--color-warning)' }}>
                      ${data.summary.taxableIncome.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded-lg p-3 mt-4" style={{ backgroundColor: 'var(--color-background)' }}>
                    <p className="text-xs mb-2" style={{ color: 'var(--color-muted-foreground)' }}>ESTIMATED TAX PAYMENT</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>
                      ${data.estimates.estimatedQuarterlyPayment.toFixed(2)}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'var(--color-muted-foreground)' }}>
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
                    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <th className="text-left py-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Category</th>
                      <th className="text-left py-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Type</th>
                      <th className="text-left py-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Form</th>
                      <th className="text-right py-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Amount</th>
                      <th className="text-right py-3 font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.byCategory
                      .filter((c) => c.isDeductible)
                      .sort((a, b) => b.totalAmount - a.totalAmount)
                      .map((category) => (
                        <tr key={category.categoryId} className="border-b hover:[background-color:var(--color-elevated)]" style={{ borderColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
                          <td className="py-3" style={{ color: 'var(--color-foreground)' }}>{category.categoryName}</td>
                          <td className="py-3">{getDeductionTypeBadge(category.deductionType)}</td>
                          <td className="py-3 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            {category.formType.replace(/_/g, ' ').toUpperCase()}
                          </td>
                          <td className="py-3 text-right font-medium font-mono" style={{ color: 'var(--color-foreground)' }}>
                            ${category.totalAmount.toFixed(2)}
                          </td>
                          <td className="py-3 text-right" style={{ color: 'var(--color-muted-foreground)' }}>
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
          <Card style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ color: 'var(--color-warning)' }}>
                <AlertCircle className="w-5 h-5" />
                Tax Preparation Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm" style={{ color: 'color-mix(in oklch, var(--color-foreground) 80%, transparent)' }}>
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
