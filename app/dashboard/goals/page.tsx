'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { GoalTracker } from '@/components/goals/goal-tracker';
import { GoalForm } from '@/components/goals/goal-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

export default function GoalsPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold } = useHouseholdFetch();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  const loadGoals = useCallback(async () => {
    if (!selectedHouseholdId) return; // Safety check
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await fetchWithHousehold(`/api/savings-goals${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Different error messages based on status code
        let errorMessage = 'Failed to load goals';
        if (response.status === 401) {
          errorMessage = 'Please sign in to view goals';
        } else if (response.status === 500) {
          errorMessage = 'Server error loading goals. Please try again.';
        }

        setError(errorMessage);
        toast.error(errorMessage);
        setGoals([]);
        return;
      }

      const data = await response.json();

      // Empty array is valid - don't show error
      setGoals(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      // Only network errors reach here
      console.error('Network error loading goals:', error);
      const errorMessage = 'Network error. Please check your connection.';
      setError(errorMessage);
      toast.error(errorMessage);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedHouseholdId, fetchWithHousehold]);

  // Fetch goals
  useEffect(() => {
    if (!selectedHouseholdId) return; // Early return if no household
    loadGoals();
  }, [loadGoals, selectedHouseholdId]);

  const loadGoalDetails = async (goalId: string) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return null;
    }
    try {
      const response = await fetchWithHousehold(`/api/savings-goals/${goalId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Goal not found');
        } else {
          toast.error('Failed to load goal details');
        }
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error loading goal details:', error);
      toast.error('Network error loading goal details');
      return null;
    }
  };

  const handleCreateGoal = async (data: any) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }
    try {
      const response = await postWithHousehold('/api/savings-goals', data);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400) {
          toast.error(errorData.error || 'Invalid goal data');
        } else {
          toast.error('Failed to create goal. Please try again.');
        }
        return;
      }

      toast.success('Goal created successfully!');
      setIsFormOpen(false);
      setSelectedGoal(null);
      loadGoals();
    } catch (error) {
      console.error('Error creating goal:', error);
      toast.error('Network error. Please check your connection.');
    }
  };

  const handleUpdateGoal = async (data: any) => {
    if (!selectedGoal) return;
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    try {
      const response = await putWithHousehold(`/api/savings-goals/${selectedGoal.id}`, data);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400) {
          toast.error(errorData.error || 'Invalid goal data');
        } else if (response.status === 404) {
          toast.error('Goal not found');
        } else {
          toast.error('Failed to update goal. Please try again.');
        }
        return;
      }

      toast.success('Goal updated successfully!');
      setIsFormOpen(false);
      setSelectedGoal(null);
      loadGoals();
    } catch (error) {
      console.error('Error updating goal:', error);
      toast.error('Network error. Please check your connection.');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    try {
      const response = await deleteWithHousehold(`/api/savings-goals/${goalId}`);

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Goal not found');
        } else {
          toast.error('Failed to delete goal. Please try again.');
        }
        return;
      }

      toast.success('Goal deleted successfully!');
      loadGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast.error('Network error. Please check your connection.');
    }
  };

  const handleEditGoal = async (goal: any) => {
    const details = await loadGoalDetails(goal.id);
    if (details) {
      setSelectedGoal(details);
      setIsFormOpen(true);
    }
  };

  const handleContribute = () => {
    loadGoals();
  };

  // Calculate summary stats
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const activeGoals = goals.filter((g) => g.status === 'active').length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Savings Goals</h1>
          <p className="text-muted-foreground mt-1">Track and achieve your financial goals</p>
        </div>
        <Button
          onClick={() => {
            setSelectedGoal(null);
            setIsFormOpen(true);
          }}
          className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">Total Target</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            ${totalTarget.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">Total Saved</p>
          <p className="text-2xl font-bold text-[var(--color-income)] mt-1">
            ${totalCurrent.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">Progress</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {goals.length > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-muted-foreground text-sm">Active Goals</p>
          <p className="text-2xl font-bold text-foreground mt-1">{activeGoals}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded transition-colors capitalize ${
              filter === status
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'bg-card text-muted-foreground border border-border hover:border-border'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Goals List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading goals...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 bg-card border border-[var(--color-error)] rounded-lg">
          <p className="text-[var(--color-error)] mb-4">{error}</p>
          <Button
            onClick={loadGoals}
            className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
          >
            Retry
          </Button>
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">No goals yet. Create your first goal to get started!</p>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
          >
            Create Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => (
            <GoalTracker
              key={goal.id}
              goal={goal}
              onEdit={handleEditGoal}
              onDelete={handleDeleteGoal}
              onContribute={handleContribute}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedGoal
                ? 'Update your savings goal details'
                : 'Set up a new savings goal to track'}
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            goal={selectedGoal}
            onSubmit={selectedGoal ? handleUpdateGoal : handleCreateGoal}
            onCancel={() => {
              setIsFormOpen(false);
              setSelectedGoal(null);
            }}
          />
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
