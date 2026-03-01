'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, ChevronRight } from 'lucide-react';
import { TransferSuggestionsModal } from '@/components/transactions/transfer-suggestions-modal';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

export function TransferSuggestionsWidget() {
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [count, setCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    try {
      if (!selectedHouseholdId) {
        setCount(0);
        return;
      }

      const response = await fetchWithHousehold('/api/transfer-suggestions?status=pending&limit=1');
      if (!response.ok) throw new Error('Failed to fetch count');

      const data = await response.json();
      setCount(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch suggestion count:', error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold, selectedHouseholdId]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      setCount(0);
      return;
    }
    fetchCount();
  }, [selectedHouseholdId, fetchCount]);

  // Refresh count when modal closes
  useEffect(() => {
    if (!modalOpen) {
      fetchCount();
    }
  }, [modalOpen, fetchCount]);

  // Don't show widget if no suggestions
  if (!loading && count === 0) return null;

  return (
    <>
      <div
        className="rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mb-4">
          <h3 className="text-base flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
            <ArrowRightLeft className="h-5 w-5" style={{ color: 'var(--color-warning)' }} />
            Transfer Suggestions
          </h3>
        </div>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading...</p>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                {count} potential transfer {count === 1 ? 'match' : 'matches'} found
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                Review suggested transaction pairs for linking as transfers
              </p>
              <Button
                onClick={() => setModalOpen(true)}
                className="w-full hover:opacity-90"
                style={{
                  backgroundColor: 'var(--color-warning)',
                  color: 'var(--color-primary-foreground)',
                }}
              >
                Review Suggestions
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </div>

      <TransferSuggestionsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
