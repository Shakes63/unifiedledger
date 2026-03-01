'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCcw, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import Decimal from 'decimal.js';

interface RolloverCategory {
  id: string;
  name: string;
  type: string;
  rolloverEnabled: boolean;
  rolloverBalance: number;
  rolloverLimit: number | null;
  monthlyBudget: number;
  effectiveBudget: number;
}

interface RolloverSummaryData {
  categories: RolloverCategory[];
  totalRolloverBalance: number;
  categoriesWithRollover: number;
  allowNegativeRollover: boolean;
}

interface RolloverSummaryProps {
  onCategoryEdit?: (categoryId: string) => void;
  hideHeader?: boolean;
}

export function RolloverSummary({ onCategoryEdit: _onCategoryEdit, hideHeader = false }: RolloverSummaryProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, putWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<RolloverSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<string>('');

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchRolloverData = async () => {
      try {
        setLoading(true);
        const response = await fetchWithHousehold('/api/budgets/rollover');
        
        if (!response.ok) {
          throw new Error('Failed to fetch rollover data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching rollover data:', err);
        if (err instanceof Error && err.message === 'No household selected') {
          return;
        }
        toast.error('Failed to load rollover data');
      } finally {
        setLoading(false);
      }
    };

    fetchRolloverData();
  }, [selectedHouseholdId, fetchWithHousehold]);

  const handleToggleRollover = async (categoryId: string, enabled: boolean) => {
    try {
      const response = await putWithHousehold(`/api/categories/${categoryId}/rollover`, {
        rolloverEnabled: enabled,
      });

      if (!response.ok) {
        throw new Error('Failed to update rollover setting');
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        
        const updatedCategories = prev.categories.map(cat => 
          cat.id === categoryId ? { ...cat, rolloverEnabled: enabled } : cat
        );

        return {
          ...prev,
          categories: updatedCategories,
          categoriesWithRollover: updatedCategories.filter(c => c.rolloverEnabled).length,
          totalRolloverBalance: updatedCategories
            .filter(c => c.rolloverEnabled)
            .reduce((sum, c) => new Decimal(sum).plus(c.rolloverBalance).toNumber(), 0),
        };
      });

      toast.success(`Rollover ${enabled ? 'enabled' : 'disabled'} for category`);
    } catch (err) {
      console.error('Error toggling rollover:', err);
      toast.error('Failed to update rollover setting');
    }
  };

  const handleSaveLimit = async (categoryId: string) => {
    try {
      const limit = editLimit === '' ? null : parseFloat(editLimit);
      
      if (limit !== null && (isNaN(limit) || limit < 0)) {
        toast.error('Rollover limit must be a positive number or empty for unlimited');
        return;
      }

      const response = await putWithHousehold(`/api/categories/${categoryId}/rollover`, {
        rolloverLimit: limit,
      });

      if (!response.ok) {
        throw new Error('Failed to update rollover limit');
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          categories: prev.categories.map(cat => 
            cat.id === categoryId ? { ...cat, rolloverLimit: limit } : cat
          ),
        };
      });

      setEditingCategory(null);
      toast.success('Rollover limit updated');
    } catch (err) {
      console.error('Error updating rollover limit:', err);
      toast.error('Failed to update rollover limit');
    }
  };

  const handleResetRollover = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Reset rollover balance for "${categoryName}" to $0?`)) {
      return;
    }

    try {
      const response = await fetchWithHousehold(`/api/categories/${categoryId}/rollover`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to reset rollover');
      }

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        
        const updatedCategories = prev.categories.map(cat => 
          cat.id === categoryId 
            ? { ...cat, rolloverBalance: 0, effectiveBudget: cat.monthlyBudget } 
            : cat
        );

        return {
          ...prev,
          categories: updatedCategories,
          totalRolloverBalance: updatedCategories
            .filter(c => c.rolloverEnabled)
            .reduce((sum, c) => new Decimal(sum).plus(c.rolloverBalance).toNumber(), 0),
        };
      });

      toast.success(`Rollover balance reset for ${categoryName}`);
    } catch (err) {
      console.error('Error resetting rollover:', err);
      toast.error('Failed to reset rollover balance');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="animate-pulse">
          <div className="h-5 rounded w-1/3 mb-3" style={{ backgroundColor: 'var(--color-muted)' }}></div>
          <div className="h-4 rounded w-1/2" style={{ backgroundColor: 'var(--color-muted)' }}></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const expenseCategories = data.categories.filter(c => c.type === 'expense');
  const categoriesWithRollover = expenseCategories.filter(c => c.rolloverEnabled);

  // When hideHeader is true, always show content (controlled by parent)
  const showContent = hideHeader || isExpanded;

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
      {/* Header - Only visible when not hideHeader */}
      {!hideHeader && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <div className="flex items-center gap-3">
            <RefreshCcw className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            <div className="text-left">
              <h3 className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Budget Rollover</h3>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {categoriesWithRollover.length} categories with ${data.totalRolloverBalance.toFixed(2)} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.totalRolloverBalance > 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)', color: 'var(--color-success)' }}>
                +${data.totalRolloverBalance.toFixed(2)}
              </span>
            )}
            {data.totalRolloverBalance < 0 && (
              <span className="px-2 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)', color: 'var(--color-destructive)' }}>
                ${data.totalRolloverBalance.toFixed(2)}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
            ) : (
              <ChevronRight className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
            )}
          </div>
        </button>
      )}

      {/* Content - Shown when expanded or when hideHeader is true */}
      {showContent && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* Info Banner */}
          <div className="px-4 py-2 text-xs" style={{ backgroundColor: 'color-mix(in oklch, var(--color-muted) 50%, transparent)', color: 'var(--color-muted-foreground)' }}>
            Rollover allows unused budget from one month to carry forward to the next.
            {data.allowNegativeRollover && (
              <span className="ml-1" style={{ color: 'var(--color-warning)' }}>
                Negative rollover is enabled for this household.
              </span>
            )}
          </div>

          {/* Category List */}
          <div>
            {expenseCategories.map((category, index) => (
              <div key={category.id} className="px-4 py-3 flex items-center justify-between" style={{ borderTop: index > 0 ? '1px solid var(--color-border)' : undefined }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{category.name}</span>
                    {category.rolloverEnabled && category.rolloverBalance !== 0 && (
                      <span 
                        className="px-1.5 py-0.5 text-xs rounded"
                        style={category.rolloverBalance > 0
                          ? { backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)', color: 'var(--color-success)' }
                          : { backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)', color: 'var(--color-destructive)' }}
                      >
                        {category.rolloverBalance >= 0 ? '+' : ''}${category.rolloverBalance.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                    Budget: ${category.monthlyBudget.toFixed(2)}
                    {category.rolloverEnabled && category.rolloverLimit !== null && (
                      <span className="ml-2">
                        Limit: ${category.rolloverLimit.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Edit Limit Button */}
                  {category.rolloverEnabled && (
                    <>
                      {editingCategory === category.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editLimit}
                            onChange={e => setEditLimit(e.target.value)}
                            placeholder="No limit"
                            className="w-20 rounded px-2 py-1 text-xs"
                            style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                            min="0"
                            step="0.01"
                          />
                          <button
                            onClick={() => handleSaveLimit(category.id)}
                            className="px-2 py-1 text-xs rounded hover:opacity-90"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="px-2 py-1 text-xs rounded"
                            style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-foreground)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-muted)'; }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingCategory(category.id);
                              setEditLimit(category.rolloverLimit?.toString() || '');
                            }}
                            className="p-1 transition-colors"
                            style={{ color: 'var(--color-muted-foreground)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-foreground)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted-foreground)'; }}
                            title="Edit rollover limit"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                          {category.rolloverBalance !== 0 && (
                            <button
                              onClick={() => handleResetRollover(category.id, category.name)}
                              className="px-2 py-1 text-xs transition-colors"
                              style={{ color: 'var(--color-muted-foreground)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-foreground)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-muted-foreground)'; }}
                            >
                              Reset
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleRollover(category.id, !category.rolloverEnabled)}
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{ backgroundColor: category.rolloverEnabled ? 'var(--color-primary)' : 'var(--color-muted)' }}
                    title={category.rolloverEnabled ? 'Disable rollover' : 'Enable rollover'}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        category.rolloverEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {expenseCategories.length === 0 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              No expense categories available for rollover.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

