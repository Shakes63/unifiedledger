'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

export function SavingsGoalsWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    if (!selectedHouseholdId) return; // Safety check
    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/savings-goals?status=active');
      if (!response.ok) throw new Error('Failed to fetch goals');
      const data = await response.json();
      // Show top 3 active goals
      setGoals(data.slice(0, 3));
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return; // Early return if no household
    loadGoals();
  }, [loadGoals, selectedHouseholdId]);

  if (loading) {
    return (
      <Card className="bg-card border-border p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading goals...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-foreground">Savings Goals</h3>
        </div>
        <Link href="/dashboard/goals">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            View All
          </Button>
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm mb-3">No active goals yet</p>
          <Link href="/dashboard/goals">
            <Button size="sm" className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]">
              Create Your First Goal
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const progressPercent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: goal.color }}
                    />
                    <span className="text-sm text-foreground font-medium">{goal.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
                <Progress value={progressPercent} className="h-1.5 bg-elevated" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>${goal.currentAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  <span>${goal.targetAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
