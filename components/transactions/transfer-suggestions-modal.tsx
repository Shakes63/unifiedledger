'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchSuggestions();
    }
  }, [open]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/transfer-suggestions?status=pending&limit=20', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      setSuggestions(data.data || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to load transfer suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (suggestionId: string) => {
    setProcessingId(suggestionId);
    try {
      const response = await fetch(`/api/transfer-suggestions/${suggestionId}/accept`, { credentials: 'include', method: 'POST', });

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
      const response = await fetch(`/api/transfer-suggestions/${suggestionId}/reject`, { credentials: 'include', method: 'POST', });

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
      <DialogContent className="bg-card border-border max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-(--color-primary)" />
            Transfer Match Suggestions
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Review potential transfer matches found by the smart matching algorithm
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">Loading suggestions...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-12 text-center bg-elevated rounded-lg border border-border">
            <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-foreground font-medium">No pending suggestions</p>
            <p className="text-sm text-muted-foreground mt-2">
              Suggestions appear when rules find potential transfer matches
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion) => (
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

  const getConfidenceBadge = (confidence: string, totalScore: number) => {
    if (confidence === 'high') {
      return (
        <Badge className="bg-(--color-success) text-white border-none">
          {totalScore.toFixed(0)}% Match
        </Badge>
      );
    } else if (confidence === 'medium') {
      return (
        <Badge className="bg-(--color-warning) text-white border-none">
          {totalScore.toFixed(0)}% Match
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-(--color-error) text-white border-none">
          {totalScore.toFixed(0)}% Match
        </Badge>
      );
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-elevated space-y-4">
      {/* Header with confidence badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Potential Transfer Match</h4>
        {getConfidenceBadge(score.confidence, score.totalScore)}
      </div>

      {/* Transaction comparison */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4">
        {/* Source transaction */}
        <div className="bg-card rounded-lg p-3 border border-border">
          <p className="text-xs text-muted-foreground mb-2">Source Transaction</p>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {sourceTransaction.description}
            </p>
            <p className="text-lg font-mono text-(--color-expense)">
              {formatCurrency(sourceTransaction.amount)}
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: sourceAccount.color }}
              />
              <p className="text-xs text-muted-foreground truncate">{sourceAccount.name}</p>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(sourceTransaction.date)}</p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center md:py-8">
          <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
        </div>

        {/* Suggested transaction */}
        <div className="bg-card rounded-lg p-3 border border-border">
          <p className="text-xs text-muted-foreground mb-2">Suggested Match</p>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {suggestedTransaction.description}
            </p>
            <p className="text-lg font-mono text-(--color-income)">
              {formatCurrency(suggestedTransaction.amount)}
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: suggestedAccount.color }}
              />
              <p className="text-xs text-muted-foreground truncate">{suggestedAccount.name}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(suggestedTransaction.date)}
            </p>
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="bg-card rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-2">Match Breakdown</p>
        <ScoreBar label="Amount" score={score.amountScore} max={40} />
        <ScoreBar label="Date" score={score.dateScore} max={30} />
        <ScoreBar label="Description" score={score.descriptionScore} max={20} />
        {score.accountScore > 0 && (
          <ScoreBar label="History" score={score.accountScore} max={10} />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={onAccept}
          disabled={isProcessing}
          className="flex-1 bg-(--color-success) hover:opacity-90 text-white"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Link as Transfer
        </Button>
        <Button
          onClick={onReject}
          disabled={isProcessing}
          variant="outline"
          className="flex-1 border-border hover:bg-elevated text-foreground"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <X className="h-4 w-4 mr-2" />
          )}
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
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {score.toFixed(1)} / {max}
        </span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div
          className="h-full bg-(--color-primary) transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
