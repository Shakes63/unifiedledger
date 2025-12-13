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
import { ExportButton } from '@/components/reports/export-button';
import { BarChart } from '@/components/charts';
import { AlertCircle, Calendar, DollarSign, TrendingUp, CheckCircle2, Settings, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface TaxJurisdictionAmount {
  name: string;
  rate: number;
  amount: number;
}

interface TaxRateBreakdown {
  state: TaxJurisdictionAmount;
  county: TaxJurisdictionAmount;
  city: TaxJurisdictionAmount;
  specialDistrict: TaxJurisdictionAmount;
  total: {
    rate: number;
    amount: number;
  };
}

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
  taxBreakdown?: TaxRateBreakdown | null;
}

interface SalesTaxSummary {
  year: number;
  totalSales: number;
  totalTax: number;
  totalDue: number;
  taxBreakdown?: TaxRateBreakdown | null;
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

  // Multi-level tax rate configuration state
  const [stateRate, setStateRate] = useState<number>(0);
  const [countyRate, setCountyRate] = useState<number>(0);
  const [cityRate, setCityRate] = useState<number>(0);
  const [specialDistrictRate, setSpecialDistrictRate] = useState<number>(0);
  const [stateName, setStateName] = useState<string>('');
  const [countyName, setCountyName] = useState<string>('');
  const [cityName, setCityName] = useState<string>('');
  const [specialDistrictName, setSpecialDistrictName] = useState<string>('');
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Computed total rate
  const totalTaxRate = stateRate + countyRate + cityRate + specialDistrictRate;
  
  // Filing status state
  const [isMarkingFiled, setIsMarkingFiled] = useState<string | null>(null);

  useEffect(() => {
    fetchTaxRateSettings();
  }, []);

  const fetchTaxRateSettings = async () => {
    try {
      const response = await fetch('/api/sales-tax/settings', { credentials: 'include' });
      if (response.ok) {
        const settings = await response.json();
        // Load multi-level rates
        setStateRate(settings.stateRate || 0);
        setCountyRate(settings.countyRate || 0);
        setCityRate(settings.cityRate || 0);
        setSpecialDistrictRate(settings.specialDistrictRate || 0);
        setStateName(settings.stateName || '');
        setCountyName(settings.countyName || '');
        setCityName(settings.cityName || '');
        setSpecialDistrictName(settings.specialDistrictName || '');
      }
    } catch (err) {
      console.error('Error fetching tax rate settings:', err);
    }
  };

  const saveTaxRateSettings = async () => {
    try {
      setIsSavingRate(true);
      const response = await fetch('/api/sales-tax/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          stateRate,
          countyRate,
          cityRate,
          specialDistrictRate,
          stateName,
          countyName,
          cityName,
          specialDistrictName,
          filingFrequency: 'quarterly',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      setIsEditingRate(false);
      // Refresh reports with new rate
      fetchSalesTaxData();
      toast.success('Tax rate settings saved');
    } catch (err) {
      console.error('Error saving tax rate:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save tax rate settings');
    } finally {
      setIsSavingRate(false);
    }
  };

  const fetchSalesTaxData = useCallback(async () => {
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
  }, [year]);

  useEffect(() => {
    fetchSalesTaxData();
  }, [fetchSalesTaxData]);

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
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'submitted':
        return <Calendar className="w-4 h-4 text-transfer" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'text-success';
      case 'submitted':
        return 'text-transfer';
      case 'pending':
        return 'text-warning';
      case 'rejected':
        return 'text-error';
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

  const handleMarkFiled = async (quarter: number) => {
    const key = `Q${quarter}`;
    if (isMarkingFiled === key) return;

    setIsMarkingFiled(key);
    try {
      const response = await fetch('/api/sales-tax/quarterly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          year: parseInt(year, 10),
          quarter,
          status: 'submitted',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update filing status');
      }

      toast.success(`Q${quarter} marked as filed!`);
      
      // Refresh data without showing full-page loading state
      const refreshResponse = await fetch(`/api/sales-tax/quarterly?year=${year}`, { credentials: 'include' });
      if (refreshResponse.ok) {
        const result = await refreshResponse.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error marking as filed:', error);
      toast.error('Failed to mark as filed. Please try again.');
    } finally {
      setIsMarkingFiled(null);
    }
  };

  const handleUndoFiling = async (quarter: number) => {
    const key = `Q${quarter}`;
    if (isMarkingFiled === key) return;

    setIsMarkingFiled(key);
    try {
      const response = await fetch('/api/sales-tax/quarterly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          year: parseInt(year, 10),
          quarter,
          status: 'pending',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to undo filing');
      }

      toast.success(`Q${quarter} filing undone`);
      
      // Refresh data without showing full-page loading state
      const refreshResponse = await fetch(`/api/sales-tax/quarterly?year=${year}`, { credentials: 'include' });
      if (refreshResponse.ok) {
        const result = await refreshResponse.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error undoing filing:', error);
      toast.error('Failed to undo filing. Please try again.');
    } finally {
      setIsMarkingFiled(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sales tax information...</p>
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
              <Settings className="w-5 h-5 text-primary" />
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
            Configure your multi-level sales tax rates (State, County, City, Special District)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditingRate ? (
            <div className="space-y-6">
              {/* Multi-level rate inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* State Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">State</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={stateRate}
                    onChange={(e) => setStateRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                    placeholder="Rate %"
                  />
                  <input
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm"
                    placeholder="e.g., Texas"
                  />
                </div>

                {/* County Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">County</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={countyRate}
                    onChange={(e) => setCountyRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                    placeholder="Rate %"
                  />
                  <input
                    type="text"
                    value={countyName}
                    onChange={(e) => setCountyName(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm"
                    placeholder="e.g., Travis County"
                  />
                </div>

                {/* City Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">City</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={cityRate}
                    onChange={(e) => setCityRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                    placeholder="Rate %"
                  />
                  <input
                    type="text"
                    value={cityName}
                    onChange={(e) => setCityName(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm"
                    placeholder="e.g., Austin"
                  />
                </div>

                {/* Special District Rate */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Special District</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={specialDistrictRate}
                    onChange={(e) => setSpecialDistrictRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
                    placeholder="Rate %"
                  />
                  <input
                    type="text"
                    value={specialDistrictName}
                    onChange={(e) => setSpecialDistrictName(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm"
                    placeholder="e.g., Transit"
                  />
                </div>
              </div>

              {/* Total Rate Display */}
              <div className="p-3 bg-elevated rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Combined Total Rate:</span>
                  <span className="text-xl font-bold text-primary">
                    {totalTaxRate.toFixed(2)}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Enter each jurisdiction&apos;s tax rate as a percentage (e.g., 6.25 for 6.25%). 
                Leave unused jurisdictions at 0.
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={saveTaxRateSettings}
                  disabled={isSavingRate}
                  className="bg-primary text-white hover:opacity-90"
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
            <div className="space-y-4">
              {/* Total Rate Display */}
              <div className="flex items-center justify-between p-3 bg-elevated rounded-lg">
                <span className="text-muted-foreground">Combined Tax Rate</span>
                <span className="text-2xl font-bold text-primary">
                  {totalTaxRate.toFixed(2)}%
                </span>
              </div>

              {/* Rate Breakdown */}
              {totalTaxRate > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                  {stateRate > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground">State</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{stateRate.toFixed(2)}%</p>
                      {stateName && <p className="text-xs text-muted-foreground">{stateName}</p>}
                    </div>
                  )}
                  {countyRate > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <span className="text-xs text-muted-foreground">County</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{countyRate.toFixed(2)}%</p>
                      {countyName && <p className="text-xs text-muted-foreground">{countyName}</p>}
                    </div>
                  )}
                  {cityRate > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-warning" />
                        <span className="text-xs text-muted-foreground">City</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{cityRate.toFixed(2)}%</p>
                      {cityName && <p className="text-xs text-muted-foreground">{cityName}</p>}
                    </div>
                  )}
                  {specialDistrictRate > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-transfer" />
                        <span className="text-xs text-muted-foreground">Special</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{specialDistrictRate.toFixed(2)}%</p>
                      {specialDistrictName && <p className="text-xs text-muted-foreground">{specialDistrictName}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {totalTaxRate === 0 && !isEditingRate && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-foreground font-medium mb-1">
                    Configure Your Tax Rates
                  </p>
                  <p className="text-muted-foreground">
                    Set your sales tax rates by jurisdiction to see accurate quarterly reports.
                    You can configure State, County, City, and Special District rates separately.
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
                <span className="text-primary mt-1 font-bold">1.</span>
                <span>Configure your sales tax rate above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 font-bold">2.</span>
                <span>Create income transactions in any account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 font-bold">3.</span>
                <span>Check &quot;Subject to sales tax&quot; when creating income</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1 font-bold">4.</span>
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
            <p className="text-2xl font-bold text-income">
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
            <p className="text-2xl font-bold text-success">
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
            <p className="text-2xl font-bold text-warning">
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
            <p className="text-2xl font-bold text-warning">
              {data.totalSales > 0
                ? ((data.totalTax / data.totalSales) * 100).toFixed(2)
                : '0.00'}
              %
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Quarterly Estimated Payment Breakdown */}
      {hasData && data.taxBreakdown && totalTaxRate > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <DollarSign className="w-5 h-5 text-warning" />
              Estimated Quarterly Payment Breakdown
            </CardTitle>
            <CardDescription>
              Your sales tax due by jurisdiction for the year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* State */}
              {data.taxBreakdown.state.rate > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <div>
                      <span className="text-foreground font-medium">
                        {data.taxBreakdown.state.name}
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({data.taxBreakdown.state.rate.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-foreground">
                    ${data.taxBreakdown.state.amount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* County */}
              {data.taxBreakdown.county.rate > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <div>
                      <span className="text-foreground font-medium">
                        {data.taxBreakdown.county.name}
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({data.taxBreakdown.county.rate.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-foreground">
                    ${data.taxBreakdown.county.amount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* City */}
              {data.taxBreakdown.city.rate > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-warning" />
                    <div>
                      <span className="text-foreground font-medium">
                        {data.taxBreakdown.city.name}
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({data.taxBreakdown.city.rate.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-foreground">
                    ${data.taxBreakdown.city.amount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Special District */}
              {data.taxBreakdown.specialDistrict.rate > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-transfer" />
                    <div>
                      <span className="text-foreground font-medium">
                        {data.taxBreakdown.specialDistrict.name}
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({data.taxBreakdown.specialDistrict.rate.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-medium text-foreground">
                    ${data.taxBreakdown.specialDistrict.amount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-3">
                  <span className="text-foreground font-bold text-lg">Total Estimated Due</span>
                  <span className="text-muted-foreground text-sm">
                    ({data.taxBreakdown.total.rate.toFixed(2)}%)
                  </span>
                </div>
                <span className="font-mono font-bold text-xl text-warning">
                  ${data.taxBreakdown.total.amount.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
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
                          overdue ? 'text-error' : 'text-foreground'
                        }`}
                      >
                        {quarter.dueDate}
                      </p>
                    </div>
                  </div>

                  {quarter.status !== 'accepted' && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        {quarter.status === 'submitted' ? (
                          <span className="text-xs text-success">
                            Filed successfully
                          </span>
                        ) : overdue ? (
                          <span className="flex items-center gap-1 text-xs text-error">
                            <AlertCircle className="w-3 h-3" />
                            {Math.abs(daysUntil)} days overdue
                          </span>
                        ) : daysUntil > 0 ? (
                          <span className="text-xs text-warning">
                            {daysUntil} days until due
                          </span>
                        ) : null}
                      </div>
                      {quarter.status === 'submitted' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            handleUndoFiling(quarter.quarter);
                          }}
                          disabled={isMarkingFiled === `Q${quarter.quarter}`}
                          className="border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
                        >
                          {isMarkingFiled === `Q${quarter.quarter}` ? 'Saving...' : 'Undo Filing'}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            handleMarkFiled(quarter.quarter);
                          }}
                          disabled={isMarkingFiled === `Q${quarter.quarter}`}
                          className="bg-primary hover:opacity-90 text-primary-foreground"
                        >
                          {isMarkingFiled === `Q${quarter.quarter}` ? 'Saving...' : 'Mark Filed'}
                        </Button>
                      )}
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
      <Card className="bg-transfer/10 border-transfer/30">
        <CardHeader>
          <CardTitle className="text-transfer flex items-center gap-2">
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
