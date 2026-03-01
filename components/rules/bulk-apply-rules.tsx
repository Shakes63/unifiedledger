'use client';

import { useState } from 'react';
import { Zap, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<BulkApplyResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [limit, setLimit]         = useState('100');

  const handleApply = async () => {
    if (!selectedHouseholdId) { setError('Please select a household to apply rules'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate)   params.append('endDate', endDate);
      if (limit)     params.append('limit', limit);
      const res = await postWithHousehold(`/api/rules/apply-bulk?${params.toString()}`, {});
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to apply rules'); }
      const data = await res.json();
      setResult(data);
      onComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally { setLoading(false); }
  };

  const handleReset = () => { setResult(null); setError(null); setStartDate(''); setEndDate(''); setLimit('100'); };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', borderLeft: '3px solid var(--color-warning)', backgroundColor: 'var(--color-background)' }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 60%, transparent)')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 14%, transparent)' }}
        >
          <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
            Apply Rules to Existing Transactions
          </span>
          <span className="text-[11px] ml-2" style={{ color: 'var(--color-muted-foreground)' }}>
            {result
              ? `${result.totalUpdated} updated · ${result.errors.length} errors`
              : 'Bulk-categorize uncategorized transactions'}
          </span>
        </div>
        {result && (
          <span
            className="text-[10px] font-semibold px-1.5 py-px rounded shrink-0"
            style={{
              backgroundColor: result.totalUpdated > 0
                ? 'color-mix(in oklch, var(--color-income) 12%, transparent)'
                : 'var(--color-elevated)',
              color: result.totalUpdated > 0 ? 'var(--color-income)' : 'var(--color-muted-foreground)',
            }}
          >
            {result.totalUpdated > 0 ? `+${result.totalUpdated}` : 'Done'}
          </span>
        )}
        {expanded
          ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
          : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}>
          <div className="px-4 py-4 space-y-4">

            {/* Error */}
            {error && (
              <div
                className="flex gap-2 rounded-lg px-3 py-2.5"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-error) 8%, transparent)',
                  border: '1px solid color-mix(in oklch, var(--color-error) 25%, var(--color-border))',
                }}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
                <p className="text-[12px]" style={{ color: 'var(--color-error)' }}>{error}</p>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-3">
                {/* Summary strip */}
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    border: `1px solid ${result.totalUpdated > 0 ? 'color-mix(in oklch, var(--color-income) 30%, var(--color-border))' : 'var(--color-border)'}`,
                    backgroundColor: result.totalUpdated > 0 ? 'color-mix(in oklch, var(--color-income) 6%, transparent)' : 'var(--color-elevated)',
                  }}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: result.totalUpdated > 0 ? 'var(--color-income)' : 'var(--color-muted-foreground)' }} />
                    <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
                      Operation complete
                    </span>
                  </div>
                  <div
                    className="grid grid-cols-3 divide-x"
                    style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
                  >
                    {[
                      { label: 'Processed', value: result.totalProcessed, color: 'var(--color-foreground)' },
                      { label: 'Updated',   value: result.totalUpdated,   color: result.totalUpdated > 0 ? 'var(--color-income)' : 'var(--color-foreground)' },
                      { label: 'Errors',    value: result.errors.length,  color: result.errors.length > 0 ? 'var(--color-error)' : 'var(--color-muted-foreground)' },
                    ].map((s, i) => (
                      <div
                        key={s.label}
                        className="px-3 py-2 text-center"
                        style={{ borderLeft: i > 0 ? '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' : 'none' }}
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                          {s.label}
                        </p>
                        <p className="text-[16px] font-mono font-semibold tabular-nums" style={{ color: s.color }}>
                          {s.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Applied rule details (first 6) */}
                {result.appliedRules.length > 0 && (
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--color-border)' }}
                  >
                    <div
                      className="px-3 py-2"
                      style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)' }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>
                        Applied ({result.appliedRules.length})
                      </span>
                    </div>
                    <div className="divide-y max-h-36 overflow-y-auto" style={{ ['--tw-divide-opacity' as string]: '0.5' }}>
                      {result.appliedRules.slice(0, 6).map(r => (
                        <div key={r.transactionId} className="px-3 py-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                            {r.transactionId.substring(0, 8)}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>→</span>
                          <span className="text-[10px] font-mono" style={{ color: 'var(--color-primary)' }}>
                            rule:{r.ruleId.substring(0, 8)}
                          </span>
                        </div>
                      ))}
                      {result.appliedRules.length > 6 && (
                        <div className="px-3 py-1.5">
                          <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                            … and {result.appliedRules.length - 6} more
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filters (shown when no result yet) */}
            {!result && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'From (optional)', value: startDate, setter: setStartDate, type: 'date' },
                  { label: 'To (optional)',   value: endDate,   setter: setEndDate,   type: 'date' },
                  { label: 'Max transactions', value: limit,   setter: setLimit,      type: 'number' },
                ].map(f => (
                  <div key={f.label} className="space-y-1">
                    <label className="text-[11px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      value={f.value}
                      min={f.type === 'number' ? 1 : undefined}
                      max={f.type === 'number' ? 1000 : undefined}
                      onChange={e => f.setter(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg text-[12px] outline-none transition-colors"
                      style={{
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-elevated)',
                        color: 'var(--color-foreground)',
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {result ? (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-elevated)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-border)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-elevated)')}
                >
                  <RotateCcw className="w-3 h-3" /> Run Again
                </button>
              ) : (
                <button
                  onClick={handleApply}
                  disabled={loading || !selectedHouseholdId}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-warning)', color: 'oklch(20% 0 0)' }}
                  onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                >
                  {loading ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Processing…</>
                  ) : (
                    <><Zap className="w-3 h-3" /> Apply Rules</>
                  )}
                </button>
              )}
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                {result
                  ? 'Rules were applied in priority order — only first match applied per transaction.'
                  : 'Applies active rules in priority order to uncategorized transactions.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
