'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, ArrowUp, ArrowDown, Edit2, Trash2, Eye, EyeOff, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Rule {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  priority: number;
  isActive: boolean;
  matchCount: number;
  lastMatchedAt?: string;
  description?: string;
}

interface RulesManagerProps {
  onCreateRule?: () => void;
  onEditRule?: (rule: Rule) => void;
  onDeleteRule?: (ruleId: string) => void;
  onToggleRule?: (ruleId: string, isActive: boolean) => void;
  onChangePriority?: (ruleId: string, newPriority: number) => void;
}

function RuleCard({
  rule,
  index,
  total,
  onEdit,
  onDelete,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  rule: Rule;
  index: number;
  total: number;
  onEdit?: (rule: Rule) => void;
  onDelete?: (id: string) => void;
  onToggle?: (id: string, active: boolean) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
}) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Rule Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-white text-lg">{rule.name}</h3>
            {!rule.isActive && (
              <Badge variant="outline" className="bg-gray-500/20 text-gray-300 border-gray-600">
                Inactive
              </Badge>
            )}
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-600">
              Priority {rule.priority}
            </Badge>
          </div>

          {rule.description && (
            <p className="text-sm text-gray-400 mb-2">{rule.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <div>
              <span className="text-gray-400 font-medium">Category:</span> {rule.categoryName || 'Unknown'}
            </div>
            <div>
              <span className="text-gray-400 font-medium">Matched:</span> {rule.matchCount} times
            </div>
            <div>
              <span className="text-gray-400 font-medium">Last used:</span> {formatDate(rule.lastMatchedAt)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {/* Priority Controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMoveUp?.(rule.id)}
              disabled={index === 0}
              className="text-gray-400 hover:text-white hover:bg-[#242424] disabled:opacity-50"
              title="Move up (higher priority)"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMoveDown?.(rule.id)}
              disabled={index === total - 1}
              className="text-gray-400 hover:text-white hover:bg-[#242424] disabled:opacity-50"
              title="Move down (lower priority)"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>

            {/* Toggle Active */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggle?.(rule.id, !rule.isActive)}
              className={rule.isActive ? 'text-green-400 hover:bg-green-500/20' : 'text-gray-400 hover:bg-[#242424]'}
              title={rule.isActive ? 'Deactivate' : 'Activate'}
            >
              {rule.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>

            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit?.(rule)}
              className="text-blue-400 hover:bg-blue-500/20"
            >
              <Edit2 className="w-4 h-4" />
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete?.(rule.id)}
              className="text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function RulesManager({
  onCreateRule,
  onEditRule,
  onDeleteRule,
  onToggleRule,
  onChangePriority,
}: RulesManagerProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch rules on mount
  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rules');
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();

      // Fetch category names for each rule
      const rulesWithCategories = await Promise.all(
        data.map(async (rule: any) => {
          try {
            const catResponse = await fetch(`/api/categories`);
            if (catResponse.ok) {
              const categories = await catResponse.json();
              const category = categories.find((c: any) => c.id === rule.categoryId);
              return { ...rule, categoryName: category?.name || 'Unknown' };
            }
          } catch (err) {
            console.error('Error fetching categories:', err);
          }
          return rule;
        })
      );

      setRules(rulesWithCategories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
      console.error('Error fetching rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const response = await fetch(`/api/rules?id=${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete rule');

      setRules(rules.filter(r => r.id !== ruleId));
      onDeleteRule?.(ruleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const handleToggle = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, isActive }),
      });

      if (!response.ok) throw new Error('Failed to update rule');

      setRules(rules.map(r => r.id === ruleId ? { ...r, isActive } : r));
      onToggleRule?.(ruleId, isActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule');
    }
  };

  const handleChangePriority = async (ruleId: string, direction: 'up' | 'down') => {
    const ruleIndex = rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return;

    const rule = rules[ruleIndex];
    const otherRule = direction === 'up'
      ? rules[ruleIndex - 1]
      : rules[ruleIndex + 1];

    if (!otherRule) return;

    // Swap priorities
    const newPriority = otherRule.priority;
    const newRules = [...rules];
    newRules[ruleIndex].priority = newPriority;
    newRules[ruleIndex + (direction === 'up' ? -1 : 1)].priority = rule.priority;
    newRules.sort((a, b) => a.priority - b.priority);

    setRules(newRules);

    // Update both rules
    try {
      await Promise.all([
        fetch('/api/rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ruleId, priority: newPriority }),
        }),
        fetch('/api/rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: otherRule.id, priority: rule.priority }),
        }),
      ]);

      onChangePriority?.(ruleId, newPriority);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priorities');
      // Revert on error
      fetchRules();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading rules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Categorization Rules</h2>
          <p className="text-sm text-gray-400 mt-1">
            Create rules to automatically categorize transactions
          </p>
        </div>
        <Button
          onClick={onCreateRule}
          className="bg-white text-black hover:bg-gray-100 font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-8 text-center">
          <div className="text-gray-400 mb-4">
            <AlertCircle className="w-12 h-12 mx-auto opacity-50 mb-2" />
            <p>No rules created yet</p>
          </div>
          <Button
            onClick={onCreateRule}
            className="bg-white text-black hover:bg-gray-100 font-medium"
          >
            Create Your First Rule
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 px-2">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} • Ordered by priority (top = highest priority)
          </div>
          {rules.map((rule, index) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={index}
              total={rules.length}
              onEdit={onEditRule}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onMoveUp={() => handleChangePriority(rule.id, 'up')}
              onMoveDown={() => handleChangePriority(rule.id, 'down')}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-4">
        <div className="text-xs text-gray-400 space-y-2">
          <p className="font-semibold text-gray-300 mb-2">How Rules Work:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Rules are applied in order by priority (lower number = higher priority)</li>
            <li>The first matching rule's category is applied automatically</li>
            <li>Rules only apply to transactions without a manually selected category</li>
            <li>Toggle rules on/off without deleting them</li>
            <li>Match counts help you identify your most effective rules</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
