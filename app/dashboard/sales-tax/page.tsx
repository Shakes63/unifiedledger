'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/reports/export-button';
import { BarChart } from '@/components/charts';
import { AlertCircle, Calendar, DollarSign, TrendingUp, CheckCircle2, Settings, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface QuarterlyReport {
  year: number;
  quarter: number;
  totalSales: number;
  totalTax: number;
  taxRate: number;
  dueDate: string;
  submittedDate?: string;
  status: 'not_due' | 'pending' | 'submitted' | 'accepted' | 'rejected';
  balanceDue: number;
}

interface SalesTaxSummary {
  year: number;
  totalSales: number;
  totalTax: number;
  totalDue: number;
  quarters: QuarterlyReport[];
}

/**
 * Sales Tax Dashboard Page
 * Quarterly sales tax reporting and filing status tracking
 */
export default function SalesTaxPage() {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [data, setData] = useState<SalesTaxSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tax rate configuration state
  const [taxRate, setTaxRate] = useState<number>(0);
  const [jurisdiction, setJurisdiction] = useState<string>('');
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);

  useEffect(() => {
    fetchTaxRateSettings();
  }, []);

  useEffect(() => {
    fetchSalesTaxData();
  }, [year]);

  const fetchTaxRateSettings = async () => {
    try {
      const response = await fetch('/api/sales-tax/settings', { credentials: 'include' });
      if (response.ok) {
        const settings = await response.json();
        setTaxRate(settings.defaultRate);
        setJurisdiction(settings.jurisdiction || '');
      }
    } catch (error) {
      console.error('Error fetching tax rate settings:', error);
    }
  };

  const saveTaxRateSettings = async () => {
    try {
      setIsSavingRate(true);
      const response = await fetch('/api/sales-tax/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultRate: taxRate,
          jurisdiction,
          filingFrequency: 'quarterly',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setIsEditingRate(false);
      // Refresh reports with new rate
      fetchSalesTaxData();
      toast.success('Tax rate settings saved');
    } catch (error) {
      console.error('Error saving tax rate:', error);
      toast.error('Failed to save tax rate settings');
    } finally {
      setIsSavingRate(false);
    }
  };

  const fetchSalesTaxData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/sales-tax/quarterly?year=${year}`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error('Failed to load sales tax data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load sales tax data. Please try again.');
      console.error('Error fetching sales tax data:', err);
    } finally {
      setIsLoading(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />;
      case 'submitted':
        return <Calendar className="w-4 h-4 text-[var(--color-transfer)]" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-[var(--color-warning)]" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-[var(--color-error)]" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'text-[var(--color-success)]';
      case 'submitted':
        return 'text-[var(--color-transfer)]';
      case 'pending':
        return 'text-[var(--color-warning)]';
      case 'rejected':
        return 'text-[var(--color-error)]';
      default:
        return 'text-muted-foreground';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'accepted' || status === 'submitted') return false;
    const daysUntil = getDaysUntilDue(dueDate);
    return daysUntil < 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sales tax information...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-[var(--color-error)] font-medium mb-2">Error</p>
          <p className="text-muted-foreground mb-4">{error || 'Unknown error'}</p>
          <Button onClick={fetchSalesTaxData}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Check if there's any sales tax data for the selected year
  const hasData = data.quarters && data.quarters.length > 0;

  const chartData = data.quarters.map((q) => ({
    name: `Q${q.quarter}`,
    sales: q.totalSales,
    tax: q.totalTax,
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sales Tax Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track quarterly filings and prepare reports</p>
        </div>
        <div className="flex gap-2 flex-col md:flex-row">
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
          {data && (
            <ExportButton
              data={data}
              reportName="Sales_Tax_Report"
              summary={{
                year,
                totalSales: data.totalSales,
                totalTax: data.totalTax,
                totalDue: data.totalDue,
              }}
            />
          )}
        </div>
      </div>

      {/* Tax Rate Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-foreground">
              <Settings className="w-5 h-5 text-[var(--color-primary)]" />
              Sales Tax Configuration
            </span>
            {!isEditingRate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingRate(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Configure your sales tax rate for quarterly reporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingRate ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Sales Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                  placeholder="e.g., 8.5"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your local sales tax rate (e.g., 8.5 for 8.5%)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Jurisdiction (Optional)
                </label>
                <input
                  type="text"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                  placeholder="e.g., California, New York"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={saveTaxRateSettings}
                  disabled={isSavingRate}
                  className="bg-[var(--color-primary)] text-white hover:opacity-90"
                >
                  {isSavingRate ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingRate(false);
                    fetchTaxRateSettings(); // Reset to original values
                  }}
                  disabled={isSavingRate}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tax Rate</p>
                <p className="text-2xl font-bold text-foreground">
                  {taxRate.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Jurisdiction</p>
                <p className="text-lg font-medium text-foreground">
                  {jurisdiction || 'Not set'}
                </p>
              </div>
            </div>
          )}

          {taxRate === 0 && !isEditingRate && (
            <div className="mt-4 p-3 bg-[var(--color-warning)]/10 border border-[var(--color-warning)] rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-foreground font-medium mb-1">
                    Configure Your Tax Rate
                  </p>
                  <p className="text-muted-foreground">
                    Set your sales tax rate to see accurate quarterly reports.
                    Reports will show $0 tax until a rate is configured.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Data State */}
      {!hasData && (
        <Card className="text-center py-12">
          <CardContent>
            <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Sales Tax Data Available
            </h3>
            <p className="text-muted-foreground mb-4">
              There are no taxable sales for {year}.
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              To track sales tax:
            </p>
            <ul className="text-sm text-muted-foreground text-left max-w-md mx-auto space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-primary)] mt-1 font-bold">1.</span>
                <span>Configure your sales tax rate above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-primary)] mt-1 font-bold">2.</span>
                <span>Create income transactions in any account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-primary)] mt-1 font-bold">3.</span>
                <span>Check "Subject to sales tax" when creating income</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-primary)] mt-1 font-bold">4.</span>
                <span>Or use rules to automatically mark income as taxable</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {hasData && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--color-income)]">
              ${data.totalSales.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Sales Tax
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--color-success)]">
              ${data.totalTax.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Total Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--color-warning)]">
              ${data.totalDue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Effective Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--color-warning)]">
              {data.totalSales > 0
                ? ((data.totalTax / data.totalSales) * 100).toFixed(2)
                : '0.00'}
              %
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Sales vs Tax Chart */}
      {hasData && (
      <BarChart
        title="Quarterly Sales & Tax"
        description={`Sales and tax collected by quarter for ${year}`}
        data={chartData}
        bars={[
          { dataKey: 'sales', fill: 'var(--color-income)', name: 'Sales' },
          { dataKey: 'tax', fill: 'var(--color-success)', name: 'Tax' },
        ]}
      />
      )}

      {/* Quarterly Filing Status */}
      {hasData && (
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Filing Status</CardTitle>
          <CardDescription>Track filing status for each quarter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.quarters.map((quarter) => {
              const daysUntil = getDaysUntilDue(quarter.dueDate);
              const overdue = isOverdue(quarter.dueDate, quarter.status);

              return (
                <div
                  key={quarter.quarter}
                  className="border border-border rounded-lg p-4 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(quarter.status)}
                      <div>
                        <p className="text-foreground font-semibold">Q{quarter.quarter} {year}</p>
                        <p className={`text-sm ${getStatusColor(quarter.status)}`}>
                          {quarter.status.charAt(0).toUpperCase() +
                            quarter.status.slice(1)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-semibold">
                        ${quarter.totalTax.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tax collected
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-muted-foreground">Sales</p>
                      <p className="text-foreground font-medium">
                        ${quarter.totalSales.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tax Rate</p>
                      <p className="text-foreground font-medium">
                        {(quarter.taxRate * 100).toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        (configured)
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Due</p>
                      <p
                        className={`font-medium ${
                          overdue ? 'text-[var(--color-error)]' : 'text-foreground'
                        }`}
                      >
                        {quarter.dueDate}
                      </p>
                    </div>
                  </div>

                  {quarter.status !== 'accepted' && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        {overdue && (
                          <span className="flex items-center gap-1 text-xs text-[var(--color-error)]">
                            <AlertCircle className="w-3 h-3" />
                            {Math.abs(daysUntil)} days overdue
                          </span>
                        )}
                        {!overdue && daysUntil > 0 && (
                          <span className="text-xs text-[var(--color-warning)]">
                            {daysUntil} days until due
                          </span>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        Mark Filed
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Filing Deadlines */}
      {hasData && (
      <Card>
        <CardHeader>
          <CardTitle>Important Dates</CardTitle>
          <CardDescription>
            Keep track of your quarterly filing deadlines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.quarters.map((quarter) => (
              <div
                key={quarter.quarter}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">
                    Q{quarter.quarter} {year} Filing Due
                  </span>
                </div>
                <span className="text-muted-foreground text-sm">{quarter.dueDate}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Tax Compliance Tips */}
      {hasData && (
      <Card className="bg-[var(--color-transfer)]/10 border-[var(--color-transfer)]/30">
        <CardHeader>
          <CardTitle className="text-[var(--color-transfer)] flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Sales Tax Compliance Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground">
          <p>✓ Keep all sales invoices and receipts organized</p>
          <p>✓ Track sales by tax jurisdiction/rate</p>
          <p>✓ File quarterly returns by the due date</p>
          <p>✓ Pay taxes withheld from sales</p>
          <p>✓ Maintain detailed records for at least 3-4 years</p>
          <p>✓ Report any sales tax exemptions correctly</p>
          <p>✓ Consider sales tax software for accurate tracking</p>
        </CardContent>
      </Card>
      )}
      </div>
    </div>
  );
}
