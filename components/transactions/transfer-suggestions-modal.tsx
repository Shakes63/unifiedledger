'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface _MatchScore {
  amountScore: number;
  dateScore: number;
  descriptionScore: number;
  accountScore: number;
  totalScore: number;
  confidence: 'high' | 'medium' | 'low';
}

interface TransferSuggestion {
  suggestion: {
    id: string;
    userId: string;
    sourceTransactionId: string;
    suggestedTransactionId: string;
    amountScore: number;
    dateScore: number;
    descriptionScore: number;
    accountScore: number;
    totalScore: number;
    confidence: 'high' | 'medium' | 'low';
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    reviewedAt: string | null;
    createdAt: string;
  };
  sourceTransaction: {
    id: string;
    date: string;
    amount: number;
    description: string;
    type: string;
    notes: string | null;
  };
  suggestedTransaction: {
    id: string;
    date: string;
    amount: number;
    description: string;
    type: string;
    notes: string | null;
  };
  sourceAccount: {
    id: string;
    name: string;
    color: string;
    icon: string;
    type: string;
  };
  suggestedAccount: {
    id: string;
    name: string;
    color: string;
    icon: string;
    type: string;
  };
}

export function TransferSuggestionsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithHousehold('/api/transfer-suggestions?status=pending&limit=20');
      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      setSuggestions(data.data || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to load transfer suggestions');
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold]);

  useEffect(() => {
    if (open && selectedHouseholdId) {
      fetchSuggestions();
    }
  }, [open, selectedHouseholdId, fetchSuggestions]);

  const handleAccept = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      const response = await postWithHousehold(`/api/transfer-suggestions/${suggestionId}/accept`, {});

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept suggestion');
      }

      toast.success('Transfer link created successfully');
      // Remove from list
      setSuggestions((prev) => prev.filter((s) => s.suggestion.id !== suggestionId));
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to accept suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      const response = await postWithHousehold(`/api/transfer-suggestions/${suggestionId}/reject`, {});

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject suggestion');
      }

      toast.success('Suggestion dismissed');
      // Remove from list
      setSuggestions((prev) => prev.filter((s) => s.suggestion.id !== suggestionId));
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reject suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}>
              <ArrowRightLeft className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
            </div>
            Transfer Match Suggestions
          </DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Review potential transfer matches found by the smart matching algorithm
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-7 w-7 animate-spin mx-auto" style={{ color: 'var(--color-muted-foreground)' }} />
            <p className="text-[13px] mt-3" style={{ color: 'var(--color-muted-foreground)' }}>Loading suggestions…</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-12 text-center rounded-xl" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
            <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-muted-foreground)' }} />
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-foreground)' }}>No pending suggestions</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Suggestions appear when rules find potential transfer matches</p>
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {suggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.suggestion.id}
                suggestion={suggestion}
                onAccept={() => handleAccept(suggestion.suggestion.id)}
                onReject={() => handleReject(suggestion.suggestion.id)}
                isProcessing={processingId === suggestion.suggestion.id}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  isProcessing,
}: {
  suggestion: TransferSuggestion;
  onAccept: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) {
  const { sourceTransaction, suggestedTransaction, sourceAccount, suggestedAccount } = suggestion;
  const score = {
    amountScore: suggestion.suggestion.amountScore,
    dateScore: suggestion.suggestion.dateScore,
    descriptionScore: suggestion.suggestion.descriptionScore,
    accountScore: suggestion.suggestion.accountScore,
    totalScore: suggestion.suggestion.totalScore,
    confidence: suggestion.suggestion.confidence,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const confidenceColor = score.confidence === 'high' ? 'var(--color-success)' : score.confidence === 'medium' ? 'var(--color-warning)' : 'var(--color-destructive)';

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Potential Transfer Match</h4>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in oklch, ${confidenceColor} 12%, transparent)`, color: confidenceColor, border: `1px solid color-mix(in oklch, ${confidenceColor} 25%, transparent)` }}>
          {score.totalScore.toFixed(0)}% Match
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-3">
        {[
          { label: 'Source Transaction', tx: sourceTransaction, account: sourceAccount, color: 'var(--color-destructive)' },
          { label: 'Suggested Match', tx: suggestedTransaction, account: suggestedAccount, color: 'var(--color-income)' },
        ].map((side, i) => (
          <div key={i} className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>{side.label}</p>
            <p className="text-[13px] font-medium line-clamp-2" style={{ color: 'var(--color-foreground)' }}>{side.tx.description}</p>
            <p className="text-[15px] font-mono font-semibold tabular-nums" style={{ color: side.color }}>{formatCurrency(side.tx.amount)}</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: side.account.color }} />
              <p className="text-[11px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{side.account.name}</p>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{formatDate(side.tx.date)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg px-3 py-3 space-y-2" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Match Breakdown</p>
        <ScoreBar label="Amount" score={score.amountScore} max={40} />
        <ScoreBar label="Date" score={score.dateScore} max={30} />
        <ScoreBar label="Description" score={score.descriptionScore} max={20} />
        {score.accountScore > 0 && <ScoreBar label="History" score={score.accountScore} max={10} />}
      </div>

      <div className="flex gap-2">
        <Button onClick={onAccept} disabled={isProcessing} className="flex-1 h-9 text-[12px]" style={{ backgroundColor: 'var(--color-success)', color: 'white' }}>
          {isProcessing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Link as Transfer
        </Button>
        <Button onClick={onReject} disabled={isProcessing} variant="outline" className="flex-1 h-9 text-[12px]">
          {isProcessing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
          Not a Match
        </Button>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const percentage = (score / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{label}</span>
        <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--color-foreground)' }}>{score.toFixed(1)} / {max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${percentage}%`, backgroundColor: 'var(--color-primary)' }} />
      </div>
    </div>
  );
}
