'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GoalTracker, type GoalData } from '@/components/goals/goal-tracker';
import { GoalForm } from '@/components/goals/goal-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, ArrowLeft, Target } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import type { GoalFormData } from '@/lib/types';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function GoalsPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold } =
    useHouseholdFetch();

  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<(Partial<GoalFormData> & { id: string }) | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  const loadGoals = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      setError(null);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetchWithHousehold(`/api/savings-goals${params}`);

      if (!res.ok) {
        const msg =
          res.status === 401 ? 'Please sign in to view goals'
          : res.status === 500 ? 'Server error. Please try again.'
          : 'Failed to load goals';
        setError(msg);
        toast.error(msg);
        setGoals([]);
        return;
      }

      const data = (await res.json()) as unknown;
      setGoals(Array.isArray(data) ? (data as GoalData[]) : []);
      setError(null);
    } catch {
      const msg = 'Network error. Please check your connection.';
      setError(msg);
      toast.error(msg);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (selectedHouseholdId) loadGoals();
  }, [loadGoals, selectedHouseholdId]);

  const loadGoalDetails = async (goalId: string) => {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return null; }
    try {
      const res = await fetchWithHousehold(`/api/savings-goals/${goalId}`);
      if (!res.ok) { toast.error(res.status === 404 ? 'Goal not found' : 'Failed to load goal details'); return null; }
      return await res.json();
    } catch { toast.error('Network error loading goal details'); return null; }
  };

  const handleCreateGoal = async (data: Record<string, unknown>) => {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      const res = await postWithHousehold('/api/savings-goals', data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(res.status === 400 ? (err.error || 'Invalid goal data') : 'Failed to create goal.');
        return;
      }
      toast.success('Goal created!');
      setIsFormOpen(false);
      setSelectedGoal(null);
      loadGoals();
    } catch { toast.error('Network error.'); }
  };

  const handleUpdateGoal = async (data: Record<string, unknown>) => {
    if (!selectedGoal || !selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      const res = await putWithHousehold(`/api/savings-goals/${selectedGoal.id}`, data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(res.status === 400 ? (err.error || 'Invalid goal data') : res.status === 404 ? 'Goal not found' : 'Failed to update goal.');
        return;
      }
      toast.success('Goal updated!');
      setIsFormOpen(false);
      setSelectedGoal(null);
      loadGoals();
    } catch { toast.error('Network error.'); }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Delete this goal? This cannot be undone.')) return;
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      const res = await deleteWithHousehold(`/api/savings-goals/${goalId}`);
      if (!res.ok) { toast.error(res.status === 404 ? 'Goal not found' : 'Failed to delete goal.'); return; }
      toast.success('Goal deleted.');
      loadGoals();
    } catch { toast.error('Network error.'); }
  };

  const handleEditGoal = async (goal: { id: string }) => {
    const details = await loadGoalDetails(goal.id);
    if (details) { setSelectedGoal(details as Partial<GoalFormData> & { id: string }); setIsFormOpen(true); }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalTarget  = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct   = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
  const activeCount  = goals.filter(g => g.status === 'active').length;
  const completedCount = goals.filter(g => g.status === 'completed').length;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-28 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="w-24 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-52 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            {/* Left */}
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                Savings Goals
              </h1>
              {completedCount > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-px rounded-full"
                  style={{
                    backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)',
                    color: 'var(--color-success)',
                  }}
                >
                  {completedCount} achieved
                </span>
              )}
            </div>

            {/* Right: filter pills + new goal */}
            <div className="flex items-center gap-2">
              {/* Filter pills — compact */}
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--color-border)' }}
              >
                {(['active', 'all', 'completed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-2.5 py-1 text-[11px] font-medium capitalize transition-colors"
                    style={{
                      backgroundColor: filter === f ? 'var(--color-primary)' : 'transparent',
                      color: filter === f ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                      borderLeft: f !== 'active' ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-medium"
                onClick={() => { setSelectedGoal(null); setIsFormOpen(true); }}
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Goal
              </Button>
            </div>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Summary strip ────────────────────────────────────────────── */}
        {goals.length > 0 && (
          <div
            className="rounded-xl px-4 py-3 flex items-center"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Target</div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>${fmt(totalTarget)}</div>
            </div>
            <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-success)' }}>Saved</div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-success)' }}>${fmt(totalCurrent)}</div>
            </div>
            <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Progress</div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>{overallPct}%</div>
            </div>
            <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-primary)' }}>Active</div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>{activeCount}</div>
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl py-10 text-center" style={{ border: '1px solid color-mix(in oklch, var(--color-error) 35%, var(--color-border))', backgroundColor: 'var(--color-background)' }}>
            <p className="text-sm mb-3" style={{ color: 'var(--color-error)' }}>{error}</p>
            <Button size="sm" onClick={loadGoals} style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>Retry</Button>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!error && goals.length === 0 && (
          <div className="rounded-xl py-16 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
            >
              <Target className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            {filter === 'all' && (
              <>
                <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No goals yet</p>
                <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>Create your first savings goal to get started.</p>
                <Button size="sm" onClick={() => setIsFormOpen(true)} style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>Create Goal</Button>
              </>
            )}
            {filter === 'active' && (
              <>
                <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No active goals</p>
                <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>All your goals may be completed!</p>
                <Button size="sm" variant="outline" onClick={() => setFilter('completed')} style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)', backgroundColor: 'transparent' }}>View Completed</Button>
              </>
            )}
            {filter === 'completed' && (
              <>
                <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No completed goals yet</p>
                <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>Keep working towards your goals!</p>
                <Button size="sm" variant="outline" onClick={() => setFilter('active')}>View Active</Button>
              </>
            )}
          </div>
        )}

        {/* ── Goals grid ────────────────────────────────────────────────── */}
        {!error && goals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => (
              <GoalTracker
                key={goal.id}
                goal={goal}
                onEdit={handleEditGoal}
                onDelete={handleDeleteGoal}
                onContribute={loadGoals}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Goal form dialog ─────────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent
          style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: '1rem',
            maxWidth: '30rem',
            boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {selectedGoal ? 'Edit Goal' : 'New Savings Goal'}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {selectedGoal ? 'Update your savings goal details.' : 'Set up a new goal to track your progress.'}
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            goal={selectedGoal}
            onSubmit={selectedGoal ? handleUpdateGoal : handleCreateGoal}
            onCancel={() => { setIsFormOpen(false); setSelectedGoal(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
