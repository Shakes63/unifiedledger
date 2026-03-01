'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Target, Plus, X, Split } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import Decimal from 'decimal.js';

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  accountId?: string | null;
  status: string;
  color: string;
}

interface GoalContribution {
  goalId: string;
  amount: number;
}

interface GoalSelectorProps {
  selectedGoalId?: string | null;
  selectedContributions?: GoalContribution[];
  multiSelect?: boolean;
  accountId?: string; // Filter goals linked to this account
  transactionAmount?: number; // For calculating split amounts
  onChange?: (goalId: string | null) => void;
  onContributionsChange?: (contributions: GoalContribution[]) => void;
  disabled?: boolean;
}

export function GoalSelector({
  selectedGoalId,
  selectedContributions = [],
  multiSelect = false,
  accountId,
  transactionAmount,
  onChange,
  onContributionsChange,
  disabled = false,
}: GoalSelectorProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSplitMode, setIsSplitMode] = useState(multiSelect && selectedContributions.length > 1);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});

  // Load active savings goals
  const loadGoals = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      const response = await fetchWithHousehold('/api/savings-goals?status=active');
      if (!response.ok) throw new Error('Failed to fetch goals');
      const data = await response.json();
      
      // Sort goals - those linked to the current account first
      const sortedGoals = data.sort((a: SavingsGoal, b: SavingsGoal) => {
        if (accountId) {
          if (a.accountId === accountId && b.accountId !== accountId) return -1;
          if (b.accountId === accountId && a.accountId !== accountId) return 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      setGoals(sortedGoals);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold, accountId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Initialize split amounts from contributions
  useEffect(() => {
    if (selectedContributions.length > 0) {
      const amounts: Record<string, string> = {};
      selectedContributions.forEach((c) => {
        amounts[c.goalId] = c.amount.toString();
      });
      setSplitAmounts(amounts);
    }
  }, [selectedContributions]);

  // Handle single goal selection
  const handleSingleSelect = (goalId: string) => {
    if (goalId === 'none') {
      onChange?.(null);
    } else {
      onChange?.(goalId);
      // Also update contributions for the full amount if provided
      if (transactionAmount && onContributionsChange) {
        onContributionsChange([{ goalId, amount: transactionAmount }]);
      }
    }
  };

  // Toggle split mode
  const handleToggleSplitMode = () => {
    if (isSplitMode) {
      // Switching back to single mode - clear contributions
      setIsSplitMode(false);
      setSplitAmounts({});
      onContributionsChange?.([]);
    } else {
      setIsSplitMode(true);
    }
  };

  // Add a goal to split
  const handleAddGoalToSplit = (goalId: string) => {
    if (!splitAmounts[goalId]) {
      setSplitAmounts((prev) => ({
        ...prev,
        [goalId]: '',
      }));
    }
  };

  // Remove a goal from split
  const handleRemoveGoalFromSplit = (goalId: string) => {
    setSplitAmounts((prev) => {
      const updated = { ...prev };
      delete updated[goalId];
      return updated;
    });
    
    // Update contributions
    const newContributions = Object.entries(splitAmounts)
      .filter(([id]) => id !== goalId)
      .filter(([, amount]) => parseFloat(amount) > 0)
      .map(([id, amount]) => ({ goalId: id, amount: parseFloat(amount) }));
    onContributionsChange?.(newContributions);
  };

  // Update split amount for a goal
  const handleSplitAmountChange = (goalId: string, value: string) => {
    setSplitAmounts((prev) => ({
      ...prev,
      [goalId]: value,
    }));

    // Calculate and update contributions
    const newContributions: GoalContribution[] = [];
    const updatedAmounts = { ...splitAmounts, [goalId]: value };
    
    Object.entries(updatedAmounts).forEach(([id, amount]) => {
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount) && numAmount > 0) {
        newContributions.push({ goalId: id, amount: numAmount });
      }
    });
    
    onContributionsChange?.(newContributions);
  };

  // Distribute amount equally among selected goals
  const handleDistributeEqually = () => {
    const selectedGoalIds = Object.keys(splitAmounts);
    if (selectedGoalIds.length === 0 || !transactionAmount) return;

    const amountPerGoal = new Decimal(transactionAmount)
      .div(selectedGoalIds.length)
      .toDecimalPlaces(2)
      .toNumber();

    const newAmounts: Record<string, string> = {};
    const newContributions: GoalContribution[] = [];

    selectedGoalIds.forEach((id) => {
      newAmounts[id] = amountPerGoal.toFixed(2);
      newContributions.push({ goalId: id, amount: amountPerGoal });
    });

    setSplitAmounts(newAmounts);
    onContributionsChange?.(newContributions);
  };

  // Calculate total contribution
  const totalContribution = Object.values(splitAmounts)
    .reduce((sum, amount) => {
      const num = parseFloat(amount);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

  // Get goal by ID
  const getGoalById = (id: string) => goals.find((g) => g.id === id);

  // Goals that match the account
  const linkedGoals = goals.filter((g) => accountId && g.accountId === accountId);
  const hasLinkedGoals = linkedGoals.length > 0;

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Savings Goal</Label>
        <div className="h-10 rounded-md animate-pulse" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }} />
      </div>
    );
  }

  if (goals.length === 0) {
    return null; // Don't show selector if no goals exist
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <Label className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            Link to Savings Goal
            {hasLinkedGoals && (
              <span className="ml-2 text-xs" style={{ color: 'var(--color-primary)' }}>
                (Account has linked goal{linkedGoals.length > 1 ? 's' : ''})
              </span>
            )}
          </Label>
        </div>
        {multiSelect && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Split</span>
            <Switch
              checked={isSplitMode}
              onCheckedChange={handleToggleSplitMode}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {!isSplitMode ? (
        // Single goal selection
        <Select
          value={selectedGoalId || 'none'}
          onValueChange={handleSingleSelect}
          disabled={disabled}
        >
          <SelectTrigger style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
            <SelectValue placeholder="Select a goal (optional)" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <SelectItem value="none" style={{ color: 'var(--color-muted-foreground)' }}>
              No goal
            </SelectItem>
            {hasLinkedGoals && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-elevated)' }}>
                  Linked to this account
                </div>
                {linkedGoals.map((goal) => (
                  <GoalSelectItem key={goal.id} goal={goal} />
                ))}
                {goals.filter((g) => !linkedGoals.includes(g)).length > 0 && (
                  <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-elevated)' }}>
                    Other goals
                  </div>
                )}
              </>
            )}
            {goals
              .filter((g) => !hasLinkedGoals || !linkedGoals.includes(g))
              .map((goal) => (
                <GoalSelectItem key={goal.id} goal={goal} />
              ))}
          </SelectContent>
        </Select>
      ) : (
        // Split mode - multiple goals
        <div className="space-y-3 rounded-lg p-3" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 50%, transparent)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
              <Split className="w-4 h-4" />
              Split contribution across goals
            </span>
            {transactionAmount && Object.keys(splitAmounts).length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleDistributeEqually}
                className="text-xs"
                style={{ color: 'var(--color-primary)' }}
              >
                Split Equally
              </Button>
            )}
          </div>

          {/* Selected goals with amounts */}
          <div className="space-y-2">
            {Object.keys(splitAmounts).map((goalId) => {
              const goal = getGoalById(goalId);
              if (!goal) return null;
              return (
                <div
                  key={goalId}
                  className="flex items-center gap-2 rounded-md p-2" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: goal.color }}
                  />
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--color-foreground)' }}>
                    {goal.name}
                  </span>
                  <Input
                    type="number"
                    value={splitAmounts[goalId]}
                    onChange={(e) => handleSplitAmountChange(goalId, e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-24 h-8 text-sm" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoveGoalFromSplit(goalId)}
                    className="h-8 w-8 hover:opacity-80"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    disabled={disabled}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Add goal dropdown */}
          <Select
            value=""
            onValueChange={handleAddGoalToSplit}
            disabled={disabled || Object.keys(splitAmounts).length >= goals.length}
          >
            <SelectTrigger style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span style={{ color: 'var(--color-muted-foreground)' }}>Add goal</span>
              </div>
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
              {goals
                .filter((g) => !splitAmounts[g.id])
                .map((goal) => (
                  <GoalSelectItem key={goal.id} goal={goal} />
                ))}
            </SelectContent>
          </Select>

          {/* Total indicator */}
          {transactionAmount && Object.keys(splitAmounts).length > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Total allocated:</span>
              <span
                className="font-medium"
                style={{
                  color:
                    Math.abs(totalContribution - transactionAmount) < 0.01
                      ? 'var(--color-income)'
                      : totalContribution > transactionAmount
                        ? 'var(--color-destructive)'
                        : 'var(--color-foreground)',
                }}
              >
                ${totalContribution.toFixed(2)} of ${transactionAmount.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Goal option component with progress indicator
function GoalSelectItem({ goal }: { goal: SavingsGoal }) {
  const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  
  return (
    <SelectItem value={goal.id} style={{ color: 'var(--color-foreground)' }}>
      <div className="flex items-center gap-2 w-full">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: goal.color }}
        />
        <span className="flex-1 truncate">{goal.name}</span>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="w-16 h-1.5" style={{ backgroundColor: 'var(--color-elevated)' }} />
          <span className="text-xs w-8 text-right" style={{ color: 'var(--color-muted-foreground)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </SelectItem>
  );
}

