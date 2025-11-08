'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, AlertCircle } from 'lucide-react';
import { RuleBuilder } from '@/components/rules/rule-builder';
import { BulkApplyRules } from '@/components/rules/bulk-apply-rules';
import { toast } from 'sonner';

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

interface Category {
  id: string;
  name: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  useEffect(() => {
    fetchRules();
    fetchCategories();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/rules');
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error);
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setShowBuilder(true);
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setShowBuilder(true);
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Rule deleted successfully');
        fetchRules();
      } else {
        toast.error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        toast.success(`Rule ${!isActive ? 'activated' : 'deactivated'}`);
        fetchRules();
      } else {
        toast.error('Failed to update rule');
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleChangePriority = async (ruleId: string, newPriority: number) => {
    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (response.ok) {
        toast.success('Priority updated');
        fetchRules();
      } else {
        toast.error('Failed to update priority');
      }
    } catch (error) {
      console.error('Failed to change priority:', error);
      toast.error('Failed to update priority');
    }
  };

  const handleSaveRule = async (ruleData: any) => {
    try {
      const url = editingRule ? `/api/rules/${editingRule.id}` : '/api/rules';
      const method = editingRule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData),
      });

      if (response.ok) {
        toast.success(`Rule ${editingRule ? 'updated' : 'created'} successfully`);
        setShowBuilder(false);
        setEditingRule(null);
        fetchRules();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save rule');
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
      toast.error('Failed to save rule');
    }
  };

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

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-400">Loading rules...</p>
        </div>
      </div>
    );
  }

  if (showBuilder) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => {
              setShowBuilder(false);
              setEditingRule(null);
            }}
            className="border-[#2a2a2a] hover:bg-[#242424]"
          >
            ← Back to Rules
          </Button>
        </div>
        <RuleBuilder
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => {
            setShowBuilder(false);
            setEditingRule(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Auto-Categorization Rules</h1>
          <p className="text-gray-400 text-sm mt-1">
            Create rules to automatically categorize transactions based on patterns
          </p>
        </div>
        <Button
          onClick={handleCreateRule}
          className="bg-white text-black hover:bg-gray-100 font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      {/* Bulk Apply Section */}
      <BulkApplyRules />

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/30 p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">How rules work:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-300/80">
              <li>Rules are evaluated in priority order (lower number = higher priority)</li>
              <li>Only the first matching rule applies to each transaction</li>
              <li>Rules only apply to transactions without a manually set category</li>
              <li>Use bulk apply to retroactively apply rules to existing transactions</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Rules Yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first rule to automatically categorize transactions
          </p>
          <Button
            onClick={handleCreateRule}
            className="bg-white text-black hover:bg-gray-100 font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Rule
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <Card key={rule.id} className="bg-[#1a1a1a] border-[#2a2a2a] p-4">
              <div className="flex items-start justify-between gap-4">
                {/* Rule Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white text-lg">{rule.name}</h3>
                    {!rule.isActive && (
                      <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-300 rounded border border-gray-600">
                        Inactive
                      </span>
                    )}
                    <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded border border-blue-600">
                      Priority {rule.priority}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <div>
                      <span className="text-gray-400 font-medium">Category:</span>{' '}
                      {rule.categoryName || 'Unknown'}
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium">Matched:</span> {rule.matchCount}{' '}
                      times
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium">Last used:</span>{' '}
                      {formatDate(rule.lastMatchedAt)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleRule(rule.id, rule.isActive)}
                    className="h-8 text-gray-400 hover:text-white hover:bg-[#242424]"
                    title={rule.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {rule.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditRule(rule)}
                    className="h-8 text-gray-400 hover:text-white hover:bg-[#242424]"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </Button>
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChangePriority(rule.id, rule.priority - 1)}
                      className="h-8 text-gray-400 hover:text-white hover:bg-[#242424]"
                      title="Increase priority"
                    >
                      ↑
                    </Button>
                  )}
                  {index < rules.length - 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleChangePriority(rule.id, rule.priority + 1)}
                      className="h-8 text-gray-400 hover:text-white hover:bg-[#242424]"
                      title="Decrease priority"
                    >
                      ↓
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
