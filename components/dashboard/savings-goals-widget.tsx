'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Plus, History, Target, Wallet } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface RecentContribution {
  id: string;
  amount: number;
  createdAt: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
  status: string;
  color: string;
  recentContributions?: RecentContribution[];
}

interface SavingsRateSummary {
  averageRate: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Enhanced Savings Goals Widget
 * Shows goals with recent contributions, savings rate, and quick-contribute
 * Phase 18: Savings-Goals Integration
 */
export function SavingsGoalsWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, putWithHousehold } = useHouseholdFetch();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [savingsRate, setSavingsRate] = useState<SavingsRateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickContributeGoal, setQuickContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributing, setContributing] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedHouseholdId) return;
    
    try {
      setLoading(true);

      // Fetch goals
      const goalsResponse = await fetchWithHousehold('/api/savings-goals?status=active');
      if (goalsResponse.ok) {
        const goalsData = await goalsResponse.json();
        
        // For each goal, fetch recent contributions
        const goalsWithContributions = await Promise.all(
          goalsData.slice(0, 3).map(async (goal: SavingsGoal) => {
            try {
              const contribResponse = await fetchWithHousehold(
                `/api/savings-goals/${goal.id}/contributions?limit=2`
              );
              if (contribResponse.ok) {
                const contribData = await contribResponse.json();
                return {
                  ...goal,
                  recentContributions: contribData.contributions,
                };
              }
            } catch {
              // Ignore contribution fetch errors
            }
            return goal;
          })
        );
        
        setGoals(goalsWithContributions);
      }

      // Fetch savings rate summary
      const rateResponse = await fetchWithHousehold('/api/reports/savings-rate?period=monthly');
      if (rateResponse.ok) {
        const rateData = await rateResponse.json();
        setSavingsRate({
          averageRate: rateData.summary.averageRate,
          trend: rateData.summary.trend,
        });
      }
    } catch (error) {
      console.error('Error loading widget data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    loadData();
  }, [loadData, selectedHouseholdId]);

  const handleQuickContribute = async (presetAmount?: number) => {
    if (!quickContributeGoal || !selectedHouseholdId) return;

    const amount = presetAmount || parseFloat(contributeAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setContributing(true);
      const response = await putWithHousehold(
        `/api/savings-goals/${quickContributeGoal.id}/progress`,
        { increment: amount }
      );

      if (!response.ok) throw new Error('Failed to add contribution');

      toast.success(`Added $${amount.toFixed(2)} to ${quickContributeGoal.name}`);
      setQuickContributeGoal(null);
      setContributeAmount('');
      loadData(); // Refresh data
    } catch (_error) {
      toast.error('Failed to add contribution');
    } finally {
      setContributing(false);
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-(--color-income)" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-(--color-expense)" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

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
    <>
      <Card className="bg-card border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-(--color-primary)" />
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
              <Button size="sm" className="bg-(--color-primary) hover:opacity-90 text-(--color-primary-foreground)">
                Create Your First Goal
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const progressPercent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
              const lastContribution = goal.recentContributions?.[0];
              
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
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {Math.round(progressPercent)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-(--color-primary)"
                        onClick={() => setQuickContributeGoal(goal)}
                        title="Quick contribute"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={progressPercent} className="h-1.5 bg-elevated" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      ${goal.currentAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} / 
                      ${goal.targetAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                    {lastContribution && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <History className="w-3 h-3" />
                        +${lastContribution.amount.toFixed(0)} {formatDistanceToNow(parseISO(lastContribution.createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Savings Rate Mini-Indicator */}
        {savingsRate && (
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Savings Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-(--color-primary)">
                  {savingsRate.averageRate.toFixed(1)}%
                </span>
                {getTrendIcon(savingsRate.trend)}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Quick Contribute Dialog */}
      <Dialog open={!!quickContributeGoal} onOpenChange={() => setQuickContributeGoal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: quickContributeGoal?.color }}
              />
              Add to {quickContributeGoal?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Quick contribute to your savings goal
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Preset amounts */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 100, 200].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  className="border-border text-foreground hover:bg-elevated"
                  onClick={() => handleQuickContribute(amount)}
                  disabled={contributing}
                >
                  ${amount}
                </Button>
              ))}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or enter custom</span>
              </div>
            </div>

            {/* Custom amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-foreground">Amount</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={contributeAmount}
                    onChange={(e) => setContributeAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7 bg-elevated border-border text-foreground"
                  />
                </div>
                <Button
                  onClick={() => handleQuickContribute()}
                  disabled={contributing || !contributeAmount}
                  className="bg-(--color-primary) hover:opacity-90 text-(--color-primary-foreground)"
                >
                  {contributing ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>

            {/* Current progress */}
            {quickContributeGoal && (
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Current progress</span>
                  <span>
                    ${quickContributeGoal.currentAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} / 
                    ${quickContributeGoal.targetAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <Progress 
                  value={Math.min((quickContributeGoal.currentAmount / quickContributeGoal.targetAmount) * 100, 100)} 
                  className="h-2 bg-elevated mt-2"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
