'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Zap, Loader } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface BulkApplyRulesProps {
  onComplete?: (result: BulkApplyResult) => void;
}

interface BulkApplyResult {
  totalProcessed: number;
  totalUpdated: number;
  errors: { transactionId: string; error: string }[];
  appliedRules: { transactionId: string; ruleId: string; categoryId: string }[];
}

export function BulkApplyRules({ onComplete }: BulkApplyRulesProps) {
  const { selectedHouseholdId } = useHousehold();
  const { postWithHousehold } = useHouseholdFetch();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState('100');

  const handleApply = async () => {
    if (!selectedHouseholdId) {
      setError('Please select a household to apply rules');
      return;
    }

    if (!startDate && !endDate) {
      setError('Please specify at least a start or end date, or leave empty to apply to all uncategorized transactions');
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (limit) params.append('limit', limit);

      const response = await postWithHousehold(`/api/rules/apply-bulk?${params.toString()}`, {});

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to apply rules');
      }

      const data = await response.json();
      setResult(data);
      onComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-warning" />
          Apply Rules to Existing Transactions
        </h3>
        <p className="text-sm text-muted-foreground">
          Automatically categorize uncategorized transactions using your active rules. Rules are applied in priority order, and the first match wins.
        </p>
      </div>

      {/* Filters */}
      {!result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Start Date (optional)</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-elevated border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">End Date (optional)</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-elevated border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Max to Process</label>
            <Input
              type="number"
              min="1"
              max="1000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="bg-elevated border-border text-foreground"
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error/20 border border-error/40 rounded-lg text-error text-sm flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-income/20 border border-income/40 rounded-lg">
            <div className="flex items-center gap-2 text-income font-semibold mb-2">
              <CheckCircle className="w-5 h-5" />
              Operation Complete
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Processed</p>
                <p className="text-xl font-bold text-foreground">{result.totalProcessed}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Updated</p>
                <p className="text-xl font-bold text-income">{result.totalUpdated}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Errors</p>
                <p className="text-xl font-bold text-error">{result.errors.length}</p>
              </div>
            </div>
          </div>

          {/* Details */}
          {result.appliedRules.length > 0 && (
            <div className="p-4 bg-elevated rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-3 text-sm">Applied Rules</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.appliedRules.slice(0, 10).map((rule) => (
                  <div key={rule.transactionId} className="text-xs text-muted-foreground p-2 bg-card rounded">
                    <span className="font-mono">{rule.transactionId.substring(0, 8)}...</span>
                    {' → Rule: '}
                    <span className="font-mono text-primary">{rule.ruleId.substring(0, 8)}...</span>
                  </div>
                ))}
                {result.appliedRules.length > 10 && (
                  <div className="text-xs text-muted-foreground p-2">
                    ...and {result.appliedRules.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="p-4 bg-error/10 rounded-lg border border-error/30">
              <h4 className="font-semibold text-error mb-3 text-sm">Errors ({result.errors.length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.errors.map((err) => (
                  <div key={err.transactionId} className="text-xs text-error/80 p-2 bg-card rounded">
                    <span className="font-mono">{err.transactionId.substring(0, 8)}...</span>
                    {': '}
                    <span className="text-error/70">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleApply}
          disabled={loading || !!result || !selectedHouseholdId}
          className="bg-primary text-primary-foreground hover:opacity-90 font-medium flex-1"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : result ? (
            'Complete'
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Apply Rules to Uncategorized Transactions
            </>
          )}
        </Button>

        {result && (
          <Button
            onClick={() => {
              setResult(null);
              setError(null);
              setStartDate('');
              setEndDate('');
              setLimit('100');
            }}
            variant="outline"
            className="bg-elevated text-foreground border-border hover:bg-elevated"
          >
            Run Again
          </Button>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground p-3 bg-elevated rounded-lg border border-border space-y-1">
        <p className="font-semibold text-muted-foreground mb-2">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Finds all uncategorized transactions matching your date range</li>
          <li>Applies your active rules in priority order (lowest priority number = highest priority)</li>
          <li>Updates transactions with the first matching rule&apos;s category</li>
          <li>Logs all rule applications for audit tracking</li>
          <li>Can be run multiple times - won&apos;t re-categorize already categorized transactions</li>
        </ul>
      </div>
    </Card>
  );
}
