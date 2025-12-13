'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, ChevronRight } from 'lucide-react';
import { TransferSuggestionsModal } from '@/components/transactions/transfer-suggestions-modal';

export function TransferSuggestionsWidget() {
  const [count, setCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCount();
  }, []);

  // Refresh count when modal closes
  useEffect(() => {
    if (!modalOpen) {
      fetchCount();
    }
  }, [modalOpen]);

  const fetchCount = async () => {
    try {
      const response = await fetch('/api/transfer-suggestions?status=pending&limit=1', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch count');

      const data = await response.json();
      setCount(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch suggestion count:', error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Don't show widget if no suggestions
  if (!loading && count === 0) return null;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-(--color-warning)" />
            Transfer Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {count} potential transfer {count === 1 ? 'match' : 'matches'} found
                </p>
                <p className="text-xs text-muted-foreground">
                  Review suggested transaction pairs for linking as transfers
                </p>
                <Button
                  onClick={() => setModalOpen(true)}
                  className="w-full bg-(--color-warning) hover:opacity-90 text-white"
                >
                  Review Suggestions
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <TransferSuggestionsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
