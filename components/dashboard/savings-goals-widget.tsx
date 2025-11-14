'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export function SavingsGoalsWidget() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/savings-goals?status=active', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch goals');
      const data = await response.json();
      // Show top 3 active goals
      setGoals(data.slice(0, 3));
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-6">
        <div className="text-center py-8">
          <p className="text-gray-400">Loading goals...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Savings Goals</h3>
        </div>
        <Link href="/dashboard/goals">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            View All
          </Button>
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm mb-3">No active goals yet</p>
          <Link href="/dashboard/goals">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
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
                    <span className="text-sm text-white font-medium">{goal.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
                <Progress value={progressPercent} className="h-1.5 bg-[#2a2a2a]" />
                <div className="flex justify-between text-xs text-gray-500">
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
