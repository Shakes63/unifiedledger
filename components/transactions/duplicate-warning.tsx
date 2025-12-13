'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Info, ChevronDown } from 'lucide-react';

interface DuplicateMatch {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  similarity: number;
}

interface DuplicateWarningProps {
  duplicates: DuplicateMatch[];
  riskLevel: 'low' | 'medium' | 'high';
  onNavigateToDuplicate?: (transactionId: string) => void;
  onIgnore?: () => void;
}

export function DuplicateWarning({
  duplicates,
  riskLevel,
  onNavigateToDuplicate,
  onIgnore,
}: DuplicateWarningProps) {
  const [expanded, setExpanded] = useState(true);

  if (duplicates.length === 0) {
    return (
      <Card className="bg-green-500/10 border-green-500/30 p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
        <div className="flex-1">
          <p className="text-green-300 font-medium">No duplicates detected</p>
          <p className="text-xs text-green-400/70">This appears to be a new transaction</p>
        </div>
      </Card>
    );
  }

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'high':
        return 'bg-red-500/10 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  const getRiskIcon = () => {
    switch (riskLevel) {
      case 'high':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'medium':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getRiskText = () => {
    switch (riskLevel) {
      case 'high':
        return `${duplicates.length} very similar transaction(s) found`;
      case 'medium':
        return `${duplicates.length} similar transaction(s) found`;
      default:
        return `${duplicates.length} potential match(es) found`;
    }
  };

  const getRiskBadgeColor = () => {
    switch (riskLevel) {
      case 'high':
        return 'bg-red-500/20 text-red-300';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300';
      default:
        return 'bg-blue-500/20 text-blue-300';
    }
  };

  return (
    <Card className={`border p-4 space-y-3 ${getRiskColor()}`}>
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {getRiskIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-white">{getRiskText()}</p>
              <Badge className={getRiskBadgeColor()}>{riskLevel.toUpperCase()}</Badge>
            </div>
            <p className="text-xs text-[#9ca3af]">
              Review these similar transactions before saving
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Details */}
      {expanded && (
        <div className="space-y-2 pt-2 border-t border-current border-opacity-20">
          {duplicates.map((duplicate) => (
            <div
              key={duplicate.id}
              className="flex items-start justify-between gap-3 p-3 bg-[#242424]/50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-white truncate">
                    {duplicate.description}
                  </h4>
                  <Badge className="bg-[#1a1a1a] text-[#9ca3af] text-xs shrink-0">
                    {Math.round((duplicate.similarity / 100) * 100)}% match
                  </Badge>
                </div>
                <p className="text-xs text-[#6b7280]">
                  ${duplicate.amount.toFixed(2)} · {duplicate.type} · {new Date(duplicate.date).toLocaleDateString()}
                </p>
              </div>
              {onNavigateToDuplicate && (
                <Button
                  onClick={() => onNavigateToDuplicate(duplicate.id)}
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs border-[#2a2a2a] text-[#9ca3af] hover:bg-[#1a1a1a]"
                >
                  View
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {riskLevel !== 'low' && onIgnore && (
        <div className="flex gap-2 pt-2 border-t border-current border-opacity-20">
          <Button
            onClick={onIgnore}
            variant="outline"
            size="sm"
            className="flex-1 text-xs border-current border-opacity-30 text-current hover:bg-current hover:bg-opacity-10"
          >
            Continue anyway
          </Button>
        </div>
      )}
    </Card>
  );
}
