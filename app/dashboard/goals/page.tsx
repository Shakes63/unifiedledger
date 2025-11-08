'use client';

import { useEffect, useState } from 'react';
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

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

  // Fetch goals
  useEffect(() => {
    loadGoals();
  }, [filter]);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await fetch(`/api/savings-goals${params}`);
      if (!response.ok) throw new Error('Failed to fetch goals');
      const data = await response.json();
      setGoals(data);
    } catch (error) {
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const loadGoalDetails = async (goalId: string) => {
    try {
      const response = await fetch(`/api/savings-goals/${goalId}`);
      if (!response.ok) throw new Error('Failed to fetch goal');
      return await response.json();
    } catch (error) {
      toast.error('Failed to load goal details');
      return null;
    }
  };

  const handleCreateGoal = async (data: any) => {
    try {
      const response = await fetch('/api/savings-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to create goal');

      toast.success('Goal created successfully!');
      setIsFormOpen(false);
      setSelectedGoal(null);
      loadGoals();
    } catch (error) {
      toast.error('Failed to create goal');
    }
  };

  const handleUpdateGoal = async (data: any) => {
    if (!selectedGoal) return;

    try {
      const response = await fetch(`/api/savings-goals/${selectedGoal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update goal');

      toast.success('Goal updated successfully!');
      setIsFormOpen(false);
      setSelectedGoal(null);
      loadGoals();
    } catch (error) {
      toast.error('Failed to update goal');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      const response = await fetch(`/api/savings-goals/${goalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete goal');

      toast.success('Goal deleted successfully!');
      loadGoals();
    } catch (error) {
      toast.error('Failed to delete goal');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Savings Goals</h1>
          <p className="text-gray-400 mt-1">Track and achieve your financial goals</p>
        </div>
        <Button
          onClick={() => {
            setSelectedGoal(null);
            setIsFormOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Target</p>
          <p className="text-2xl font-bold text-white mt-1">
            ${totalTarget.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Saved</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            ${totalCurrent.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <p className="text-gray-400 text-sm">Progress</p>
          <p className="text-2xl font-bold text-white mt-1">
            {goals.length > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0}%
          </p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <p className="text-gray-400 text-sm">Active Goals</p>
          <p className="text-2xl font-bold text-white mt-1">{activeGoals}</p>
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
                ? 'bg-emerald-600 text-white'
                : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:border-[#3a3a3a]'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Goals List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading goals...</p>
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
          <p className="text-gray-400">No goals yet. Create your first goal to get started!</p>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
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
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription className="text-gray-400">
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
  );
}
