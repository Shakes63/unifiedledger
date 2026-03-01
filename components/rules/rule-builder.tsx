'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, X, AlertCircle, Zap, Tag, Store, FileEdit, FileText, ArrowRightLeft, Settings, Lightbulb, Scissors, DollarSign, Percent, Banknote, Receipt, CheckCircle2, XCircle, Check } from 'lucide-react';
import { Condition, ConditionGroup, ComparisonOperator, ConditionField } from '@/lib/rules/condition-evaluator';
import { RuleAction } from '@/lib/rules/types';
import { nanoid } from 'nanoid';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { toast } from 'sonner';

const FIELDS: { value: ConditionField; label: string }[] = [
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Amount' },
  { value: 'account_name', label: 'Account Name' },
  { value: 'date', label: 'Date' },
  { value: 'day_of_month', label: 'Day of Month' },
  { value: 'weekday', label: 'Day of Week' },
  { value: 'month', label: 'Month' },
  { value: 'notes', label: 'Notes' },
];

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'between', label: 'Between' },
  { value: 'regex', label: 'Regex match' },
  { value: 'in_list', label: 'In list' },
  { value: 'matches_day', label: 'Matches day' },
  { value: 'matches_weekday', label: 'Matches weekday' },
  { value: 'matches_month', label: 'Matches month' },
];

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Merchant {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  color?: string;
  icon?: string;
}

// Split configuration for create_split action
interface SplitItem {
  categoryId: string;
  amount: number;
  percentage: number;
  isPercentage: boolean;
  description: string;
}

// Action config with splits array
interface ActionConfig {
  splits?: SplitItem[];
  value?: boolean | string;
  targetAccountId?: string;
  autoMatch?: boolean;
  matchTolerance?: number;
  matchDayRange?: number;
  createIfNoMatch?: boolean;
  description?: string;
  [key: string]: unknown;
}

// Split field value types
type SplitFieldValue = string | number | boolean;

interface RuleBuilderProps {
  initialConditions?: ConditionGroup | Condition;
  onConditionsChange: (conditions: ConditionGroup | Condition) => void;
  initialActions?: RuleAction[];
  onActionsChange: (actions: RuleAction[]) => void;
}

function ConditionRow({
  condition,
  onUpdate,
  onRemove,
  level: _level = 0,
}: {
  condition: Condition;
  onUpdate: (updated: Condition) => void;
  onRemove: () => void;
  level?: number;
}) {
  return (
    <div className="flex gap-2 items-end p-3 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
      <Select value={condition.field} onValueChange={(field) => onUpdate({ ...condition, field: field as ConditionField })}>
        <SelectTrigger className="w-32" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELDS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={condition.operator} onValueChange={(operator) => onUpdate({ ...condition, operator: operator as ComparisonOperator })}>
        <SelectTrigger className="w-40" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={condition.value}
        onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
        placeholder="Value"
        className="flex-1 placeholder-[var(--color-muted-foreground)]"
        style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="hover:opacity-80"
        style={{ color: 'var(--color-destructive)' }}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ConditionGroupEditor({
  group,
  onUpdate,
  onRemove,
  level = 0,
}: {
  group: ConditionGroup;
  onUpdate: (updated: ConditionGroup) => void;
  onRemove?: () => void;
  level?: number;
}) {
  const addCondition = () => {
    const newCondition: Condition = {
      id: nanoid(),
      field: 'description',
      operator: 'contains',
      value: '',
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addGroup = () => {
    const newGroup: ConditionGroup = {
      id: nanoid(),
      logic: 'AND',
      conditions: [
        {
          id: nanoid(),
          field: 'description',
          operator: 'contains',
          value: '',
        },
      ],
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const updateCondition = (index: number, updated: Condition | ConditionGroup) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updated;
    onUpdate({ ...group, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onUpdate({ ...group, conditions: newConditions });
  };

  return (
    <div
      className="space-y-3 p-4 rounded-lg"
      style={{
        border: '1px solid var(--color-border)',
        backgroundColor: level > 0 ? 'var(--color-elevated)' : 'var(--color-background)',
      }}
    >
      {/* Group Logic Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Logic:</span>
        <div className="flex gap-2">
          {(['AND', 'OR'] as const).map((logic) => (
            <button
              key={logic}
              type="button"
              onClick={() => onUpdate({ ...group, logic })}
              className="px-3 py-1 text-sm font-medium rounded-md border-2 transition-colors hover:opacity-80"
              style={{
                backgroundColor: group.logic === logic ? 'var(--color-transfer)' : 'var(--color-elevated)',
                color: group.logic === logic ? 'white' : 'var(--color-foreground)',
                borderColor: group.logic === logic ? 'var(--color-transfer)' : 'var(--color-border)',
              }}
            >
              {logic}
            </button>
          ))}
        </div>
        {level > 0 && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="ml-auto hover:opacity-80"
            style={{ color: 'var(--color-destructive)' }}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        {group.conditions.map((condition, index) => (
          <div key={condition.id || index}>
            {/* Add logic separator */}
            {index > 0 && (
              <div className="text-xs px-3 py-1" style={{ color: 'var(--color-muted-foreground)' }}>{group.logic}</div>
            )}

            {'conditions' in condition ? (
              // Nested group
              <ConditionGroupEditor
                group={condition as ConditionGroup}
                onUpdate={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
                level={level + 1}
              />
            ) : (
              // Single condition
              <ConditionRow
                condition={condition as Condition}
                onUpdate={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
                level={level}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="hover:opacity-90"
          style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)' }}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Condition
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addGroup}
          className="hover:opacity-90"
          style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)' }}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Group
        </Button>
      </div>
    </div>
  );
}

export function RuleBuilder({
  initialConditions,
  onConditionsChange,
  initialActions = [],
  onActionsChange,
}: RuleBuilderProps) {
  const [conditions, setConditions] = useState<ConditionGroup | Condition>(
    initialConditions || {
      id: nanoid(),
      logic: 'AND',
      conditions: [
        {
          id: nanoid(),
          field: 'description',
          operator: 'contains',
          value: '',
        },
      ],
    }
  );

  const [actions, setActions] = useState<RuleAction[]>(initialActions);
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold } = useHouseholdFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Inline creation state
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryCreationActionIndex, setCategoryCreationActionIndex] = useState<number | null>(null);
  const [categoryCreationSplitIndex, setCategoryCreationSplitIndex] = useState<number | null>(null);

  const [isCreatingMerchant, setIsCreatingMerchant] = useState(false);
  const [newMerchantName, setNewMerchantName] = useState('');
  const [creatingMerchant, setCreatingMerchant] = useState(false);
  const [merchantCreationActionIndex, setMerchantCreationActionIndex] = useState<number | null>(null);

  // Fetch categories, merchants, and accounts
  const fetchData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoadingData(false);
      return;
    }

    try {
      const [categoriesRes, merchantsRes, accountsRes] = await Promise.all([
        fetchWithHousehold('/api/categories'),
        fetchWithHousehold('/api/merchants'),
        fetchWithHousehold('/api/accounts?sortBy=name&sortOrder=asc')
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

      if (merchantsRes.ok) {
        const merchantsData = await merchantsRes.json();
        setMerchants(Array.isArray(merchantsData) ? merchantsData : (merchantsData.data || []));
      }

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = (updated: ConditionGroup | Condition) => {
    setConditions(updated);
    onConditionsChange(updated);
  };

  const handleActionsUpdate = (updated: RuleAction[]) => {
    setActions(updated);
    onActionsChange(updated);
  };

  const addAction = () => {
    const newAction: RuleAction = {
      type: 'set_category',
      value: '',
    };
    handleActionsUpdate([...actions, newAction]);
  };

  const updateAction = (index: number, updated: RuleAction) => {
    const newActions = [...actions];
    newActions[index] = updated;
    handleActionsUpdate(newActions);
  };

  const removeAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    handleActionsUpdate(newActions);
  };

  const updateActionConfig = (index: number, config: ActionConfig) => {
    const newActions = [...actions];
    newActions[index].config = config;
    handleActionsUpdate(newActions);
  };

  const addSplit = (actionIndex: number) => {
    const newSplit = {
      categoryId: '',
      amount: 0,
      percentage: 0,
      isPercentage: false,
      description: '',
    };

    const updatedActions = [...actions];
    const config = (updatedActions[actionIndex].config ?? {}) as ActionConfig;
    if (!Array.isArray(config.splits)) {
      config.splits = [];
    }
    config.splits.push(newSplit);
    updatedActions[actionIndex].config = config;
    handleActionsUpdate(updatedActions);
  };

  const removeSplit = (actionIndex: number, splitIndex: number) => {
    const updatedActions = [...actions];
    const config = updatedActions[actionIndex].config as ActionConfig | undefined;
    if (config?.splits) {
      config.splits.splice(splitIndex, 1);
      updatedActions[actionIndex].config = config;
      handleActionsUpdate(updatedActions);
    }
  };

  const updateSplitField = (
    actionIndex: number,
    splitIndex: number,
    field: keyof SplitItem,
    value: SplitFieldValue
  ) => {
    const updatedActions = [...actions];
    const config = updatedActions[actionIndex].config as ActionConfig | undefined;
    if (config?.splits) {
      (config.splits[splitIndex] as Record<keyof SplitItem, SplitFieldValue>)[field] = value;
      updatedActions[actionIndex].config = config;
      handleActionsUpdate(updatedActions);
    }
  };

  // Inline category creation handler
  const handleCreateCategory = async (actionIndex: number, splitIndex?: number) => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    if (!selectedHouseholdId) {
      toast.error('Please select a household first');
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await postWithHousehold('/api/categories', {
        name: newCategoryName.trim(),
        type: 'expense',
        monthlyBudget: 0,
      });

      if (response.ok) {
        const newCategory = await response.json();
        // Add to categories list
        setCategories(prev => [...prev, newCategory]);

        // Auto-select the new category in the appropriate place
        if (splitIndex !== undefined && splitIndex !== null) {
          // For split category
          updateSplitField(actionIndex, splitIndex, 'categoryId', newCategory.id);
        } else {
          // For set_category action
          updateAction(actionIndex, { ...actions[actionIndex], value: newCategory.id });
        }

        // Reset creation UI
        setNewCategoryName('');
        setIsCreatingCategory(false);
        setCategoryCreationActionIndex(null);
        setCategoryCreationSplitIndex(null);
        toast.success(`Category "${newCategory.name}" created!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Error creating category');
    } finally {
      setCreatingCategory(false);
    }
  };

  // Inline merchant creation handler
  const handleCreateMerchant = async (actionIndex: number) => {
    if (!newMerchantName.trim()) {
      toast.error('Merchant name is required');
      return;
    }

    if (!selectedHouseholdId) {
      toast.error('Please select a household first');
      return;
    }

    setCreatingMerchant(true);
    try {
      const response = await postWithHousehold('/api/merchants', {
        name: newMerchantName.trim(),
      });

      if (response.ok) {
        const newMerchant = await response.json();
        // Add to merchants list
        setMerchants(prev => [...prev, newMerchant]);

        // Auto-select the new merchant
        updateAction(actionIndex, { ...actions[actionIndex], value: newMerchant.id });

        // Reset creation UI
        setNewMerchantName('');
        setIsCreatingMerchant(false);
        setMerchantCreationActionIndex(null);
        toast.success(`Merchant "${newMerchant.name}" created!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to create merchant');
      }
    } catch (error) {
      console.error('Error creating merchant:', error);
      toast.error('Error creating merchant');
    } finally {
      setCreatingMerchant(false);
    }
  };

  // Start inline category creation
  const startCategoryCreation = (actionIndex: number, splitIndex?: number) => {
    setIsCreatingCategory(true);
    setCategoryCreationActionIndex(actionIndex);
    setCategoryCreationSplitIndex(splitIndex ?? null);
    setNewCategoryName('');
  };

  // Cancel inline category creation
  const cancelCategoryCreation = () => {
    setIsCreatingCategory(false);
    setCategoryCreationActionIndex(null);
    setCategoryCreationSplitIndex(null);
    setNewCategoryName('');
  };

  // Start inline merchant creation
  const startMerchantCreation = (actionIndex: number) => {
    setIsCreatingMerchant(true);
    setMerchantCreationActionIndex(actionIndex);
    setNewMerchantName('');
  };

  // Cancel inline merchant creation
  const cancelMerchantCreation = () => {
    setIsCreatingMerchant(false);
    setMerchantCreationActionIndex(null);
    setNewMerchantName('');
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block" style={{ color: 'var(--color-foreground)' }}>Conditions</label>
        <p className="text-xs mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
          Define conditions that must match for this rule to apply to a transaction.
        </p>
      </div>

      {'conditions' in conditions ? (
        <ConditionGroupEditor
          group={conditions as ConditionGroup}
          onUpdate={handleUpdate}
        />
      ) : (
        <Card style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="p-4">
            <ConditionRow
              condition={conditions as Condition}
              onUpdate={handleUpdate}
              onRemove={() => {
                // Can't remove a single condition if it's the root, so convert to a group
                const newGroup: ConditionGroup = {
                  id: nanoid(),
                  logic: 'AND',
                  conditions: [
                    {
                      id: nanoid(),
                      field: 'description',
                      operator: 'contains',
                      value: '',
                    },
                  ],
                };
                handleUpdate(newGroup);
              }}
            />
          </div>
        </Card>
      )}

      <div className="text-xs p-3 rounded-lg flex gap-2" style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
        <div>
          <p className="mb-1">Tips for writing conditions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use &quot;Contains&quot; for partial matches in description</li>
            <li>Use &quot;In list&quot; with comma-separated values for multiple options</li>
            <li>Use &quot;Between&quot; for amount ranges like &quot;10, 50&quot;</li>
            <li>Day of week: 0=Sunday, 1=Monday, etc.</li>
          </ul>
        </div>
      </div>

      {/* Actions Section */}
      <div className="space-y-4 pt-6 mt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div>
          <label className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
            <Zap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            Actions to Apply
          </label>
          <p className="text-xs mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
            Define what changes to make when a transaction matches the conditions above.
          </p>
        </div>

        {/* Action Items */}
        {actions.length > 0 && (
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div key={index} className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start gap-4">
                  {/* Action Type Selector */}
                  <div className="w-48">
                    <Select
                      value={action.type}
                      onValueChange={(type: RuleAction['type']) => {
                        const updated: RuleAction = {
                          type,
                          value: type === 'set_category' || type === 'set_merchant' || type === 'set_account' ? '' : undefined,
                          pattern: type.includes('description') ? '' : undefined,
                          config: type === 'set_sales_tax' ? { value: true } : undefined,
                        };
                        updateAction(index, updated);
                      }}
                    >
                      <SelectTrigger style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="set_category">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            Set Category
                          </div>
                        </SelectItem>
                        <SelectItem value="set_description">
                          <div className="flex items-center gap-2">
                            <FileEdit className="h-4 w-4" />
                            Set Description
                          </div>
                        </SelectItem>
                        <SelectItem value="prepend_description">
                          <div className="flex items-center gap-2">
                            <FileEdit className="h-4 w-4" />
                            Prepend to Description
                          </div>
                        </SelectItem>
                        <SelectItem value="append_description">
                          <div className="flex items-center gap-2">
                            <FileEdit className="h-4 w-4" />
                            Append to Description
                          </div>
                        </SelectItem>
                        <SelectItem value="set_merchant">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            Set Merchant
                          </div>
                        </SelectItem>
                        <SelectItem value="set_tax_deduction">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Mark as Tax Deductible
                          </div>
                        </SelectItem>
                        <SelectItem value="convert_to_transfer">
                          <div className="flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4" />
                            Convert to Transfer
                          </div>
                        </SelectItem>
                        <SelectItem value="create_split">
                          <div className="flex items-center gap-2">
                            <Scissors className="h-4 w-4" />
                            Split Transaction
                          </div>
                        </SelectItem>
                        <SelectItem value="set_account">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4" />
                            Set Account
                          </div>
                        </SelectItem>
                        <SelectItem value="set_sales_tax">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
                            Set Sales Tax
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Configuration */}
                  <div className="flex-1">
                    {action.type === 'set_category' && (
                      <div className="space-y-2">
                        {/* Show creation form or select */}
                        {isCreatingCategory && categoryCreationActionIndex === index && categoryCreationSplitIndex === null ? (
                          <div className="flex gap-2">
                            <Input
                              autoFocus
                              type="text"
                              placeholder="New category name..."
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateCategory(index);
                                } else if (e.key === 'Escape') {
                                  cancelCategoryCreation();
                                }
                              }}
                              className="flex-1"
                              style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                            />
                            <Button
                              type="button"
                              size="icon"
                              onClick={() => handleCreateCategory(index)}
                              disabled={creatingCategory || !newCategoryName.trim()}
                              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                              className="hover:opacity-90"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={cancelCategoryCreation}
                              className="hover:opacity-90"
                              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Select
                              value={action.value || ''}
                              onValueChange={(value) => updateAction(index, { ...action, value })}
                            >
                              <SelectTrigger className="flex-1" style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
                                <SelectValue placeholder="Select category">
                                  {action.value && categories.find(c => c.id === action.value)?.name}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {loadingData ? (
                                  <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading...</div>
                                ) : categories.length > 0 ? (
                                  categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                      <div className="flex items-center gap-2">
                                        <Tag className="w-3 h-3" />
                                        {category.name}
                                      </div>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No categories found</div>
                                )}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => startCategoryCreation(index)}
                              className="hover:opacity-90"
                              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                              title="Create new category"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {action.type === 'set_merchant' && (
                      <div className="space-y-2">
                        {/* Show creation form or select */}
                        {isCreatingMerchant && merchantCreationActionIndex === index ? (
                          <div className="flex gap-2">
                            <Input
                              autoFocus
                              type="text"
                              placeholder="New merchant name..."
                              value={newMerchantName}
                              onChange={(e) => setNewMerchantName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateMerchant(index);
                                } else if (e.key === 'Escape') {
                                  cancelMerchantCreation();
                                }
                              }}
                              className="flex-1"
                              style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                            />
                            <Button
                              type="button"
                              size="icon"
                              onClick={() => handleCreateMerchant(index)}
                              disabled={creatingMerchant || !newMerchantName.trim()}
                              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                              className="hover:opacity-90"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={cancelMerchantCreation}
                              className="hover:opacity-90"
                              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Select
                              value={action.value || ''}
                              onValueChange={(value) => updateAction(index, { ...action, value })}
                            >
                              <SelectTrigger className="flex-1" style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
                                <SelectValue placeholder="Select merchant">
                                  {action.value && merchants.find(m => m.id === action.value)?.name}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {loadingData ? (
                                  <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading...</div>
                                ) : merchants.length > 0 ? (
                                  merchants.map((merchant) => (
                                    <SelectItem key={merchant.id} value={merchant.id}>
                                      <div className="flex items-center gap-2">
                                        <Store className="w-3 h-3" />
                                        {merchant.name}
                                      </div>
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No merchants found</div>
                                )}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => startMerchantCreation(index)}
                              className="hover:opacity-90"
                              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                              title="Create new merchant"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {(action.type === 'set_description' || action.type === 'prepend_description' || action.type === 'append_description') && (
                      <div className="space-y-2">
                        <Input
                          value={action.pattern || ''}
                          onChange={(e) => updateAction(index, { ...action, pattern: e.target.value })}
                          placeholder={
                            action.type === 'set_description'
                              ? 'Enter pattern (e.g., "{original} - Work")'
                              : action.type === 'prepend_description'
                              ? 'Text to add before (e.g., "[Work] ")'
                              : 'Text to add after (e.g., " - Personal")'
                          }
                          className="font-mono text-sm"
                          style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                        />
                        <div className="flex flex-wrap gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                          <span>Variables:</span>
                          <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-primary)' }}>{'{original}'}</code>
                          <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-primary)' }}>{'{merchant}'}</code>
                          <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-primary)' }}>{'{category}'}</code>
                          <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-primary)' }}>{'{amount}'}</code>
                          <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-primary)' }}>{'{date}'}</code>
                        </div>
                      </div>
                    )}

                    {action.type === 'set_tax_deduction' && (
                      <div className="flex-1 rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)' }}>
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                              This action will mark transactions as tax deductible if their category is configured as tax deductible.
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                              Requires a category to be set (either manually or via a set_category action).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {action.type === 'set_sales_tax' && (
                      <div className="flex-1 space-y-3">
                        {/* Value Selector */}
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-foreground)' }}>
                            Mark Transaction As
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Taxable Option */}
                            <button
                              type="button"
                              onClick={() => updateActionConfig(index, { value: true })}
                              className="px-4 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                              style={{
                                borderColor: action.config?.value === true ? 'var(--color-success)' : 'var(--color-border)',
                                backgroundColor: action.config?.value === true ? 'color-mix(in oklch, var(--color-success) 10%, transparent)' : 'var(--color-elevated)',
                              }}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                                <div className="text-left">
                                  <div className="font-medium" style={{ color: 'var(--color-foreground)' }}>Taxable</div>
                                  <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Subject to sales tax</div>
                                </div>
                              </div>
                            </button>

                            {/* Not Taxable Option */}
                            <button
                              type="button"
                              onClick={() => updateActionConfig(index, { value: false })}
                              className="px-4 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                              style={{
                                borderColor: action.config?.value === false ? 'var(--color-destructive)' : 'var(--color-border)',
                                backgroundColor: action.config?.value === false ? 'color-mix(in oklch, var(--color-destructive) 10%, transparent)' : 'var(--color-elevated)',
                              }}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <XCircle className="h-5 w-5" style={{ color: 'var(--color-destructive)' }} />
                                <div className="text-left">
                                  <div className="font-medium" style={{ color: 'var(--color-foreground)' }}>Not Taxable</div>
                                  <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Exempt from sales tax</div>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Educational Info */}
                        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                          <Lightbulb className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                          <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                            <p className="mb-2">
                              <strong style={{ color: 'var(--color-foreground)' }}>How it works:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              <li>Select &quot;Taxable&quot; to mark matching income as subject to sales tax</li>
                              <li>Select &quot;Not Taxable&quot; to explicitly mark income as tax-exempt</li>
                              <li>Only applies to income transactions (expenses are always excluded)</li>
                            </ul>
                          </div>
                        </div>

                        {/* Examples */}
                        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                          <Lightbulb className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                          <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                            <p className="mb-2">
                              <strong style={{ color: 'var(--color-foreground)' }}>Common use cases:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              <li><strong>Taxable:</strong> Product sales, retail transactions, taxable services</li>
                              <li><strong>Not Taxable:</strong> Nonprofit clients, wholesale, out-of-state services</li>
                            </ul>
                          </div>
                        </div>

                        {/* Warning for Income Only */}
                        <div
                          className="flex items-start gap-2 p-3 rounded-lg"
                          style={{
                            backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
                            border: '1px solid color-mix(in oklch, var(--color-warning) 25%, transparent)',
                          }}
                        >
                          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                            This action only applies to <strong style={{ color: 'var(--color-foreground)' }}>income</strong> transactions.
                            Expense transactions will be skipped automatically.
                          </p>
                        </div>
                      </div>
                    )}

                    {action.type === 'convert_to_transfer' && (
                      <div className="flex-1 space-y-4">
                        {/* Target Account Selector */}
                        <div className="space-y-2">
                          <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                            Target Account
                            <span className="ml-1" style={{ color: 'var(--color-muted-foreground)' }}>(Optional)</span>
                          </Label>
                          <Select
                            value={(action.config as ActionConfig | undefined)?.targetAccountId || ''}
                            onValueChange={(val) =>
                              updateActionConfig(index, {
                                ...(action.config as ActionConfig | undefined),
                                targetAccountId: val || undefined
                              })
                            }
                          >
                            <SelectTrigger style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}>
                              <SelectValue placeholder="Auto-detect or select account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">
                                <div className="flex items-center gap-2">
                                  <ArrowRightLeft className="h-3 w-3" style={{ color: 'var(--color-muted-foreground)' }} />
                                  <span>Auto-detect account</span>
                                </div>
                              </SelectItem>
                              {accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  <div className="flex items-center gap-2">
                                    {acc.color && (
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ border: '1px solid var(--color-border)' }}
                                        style={{ backgroundColor: acc.color }}
                                      />
                                    )}
                                    <span style={{ color: 'var(--color-foreground)' }}>{acc.name}</span>
                                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                      ({acc.type})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Leave blank to auto-match with any account. Specify an account to only match transfers with that account.
                          </p>
                        </div>

                        {/* Auto-Match Toggle */}
                        <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                          <div className="flex-1 mr-4">
                            <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                              Auto-Match with Existing Transaction
                            </Label>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                              Search for matching opposite transaction to link as transfer pair (recommended)
                            </p>
                          </div>
                          <Switch
                            checked={Boolean((action.config as ActionConfig | undefined)?.autoMatch ?? true)}
                            onCheckedChange={(checked) =>
                              updateActionConfig(index, { ...(action.config as ActionConfig | undefined), autoMatch: checked })
                            }
                          />
                        </div>

                        {/* Advanced Options - Only show if Auto-Match is enabled */}
                        {Boolean((action.config as ActionConfig | undefined)?.autoMatch ?? true) && (
                          <div className="space-y-3 pl-4 mt-4" style={{ borderLeft: '2px solid var(--color-primary)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <Settings className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                              <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Advanced Matching Options</span>
                            </div>

                            {/* Amount Tolerance */}
                            <div className="space-y-2">
                              <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                                Amount Tolerance (%)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={(action.config as ActionConfig | undefined)?.matchTolerance ?? 1}
                                onChange={(e) =>
                                  updateActionConfig(index, {
                                    ...(action.config as ActionConfig | undefined),
                                    matchTolerance: parseFloat(e.target.value) || 1,
                                  })
                                }
                                style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}
                              />
                              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                Allow amount difference up to this percentage (default: 1%).
                                For $100 transaction with 1% tolerance, will match $99-$101.
                              </p>
                            </div>

                            {/* Date Range */}
                            <div className="space-y-2">
                              <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                                Date Range (days)
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                max="30"
                                value={(action.config as ActionConfig | undefined)?.matchDayRange ?? 7}
                                onChange={(e) =>
                                  updateActionConfig(index, {
                                    ...(action.config as ActionConfig | undefined),
                                    matchDayRange: parseInt(e.target.value) || 7,
                                  })
                                }
                                style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}
                              />
                              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                Search ±N days from transaction date (default: 7 days).
                                Larger range = more matches but less precision.
                              </p>
                            </div>

                            {/* Create if No Match Toggle */}
                            <div className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                              <div className="flex-1 mr-4">
                                <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                                  Create Transfer Pair if No Match
                                </Label>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                                  Automatically create matching transaction if no suitable match is found
                                </p>
                              </div>
                              <Switch
                                checked={Boolean((action.config as ActionConfig | undefined)?.createIfNoMatch ?? true)}
                                onCheckedChange={(checked) =>
                                  updateActionConfig(index, { ...(action.config as ActionConfig | undefined), createIfNoMatch: checked })
                                }
                              />
                            </div>

                            {/* Warning if Create Pair enabled but no target account */}
                            {Boolean((action.config as ActionConfig | undefined)?.createIfNoMatch ?? true) &&
                              !(action.config as ActionConfig | undefined)?.targetAccountId && (
                              <div
                                className="flex items-start gap-2 rounded-lg p-3"
                                style={{
                                  backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)',
                                  border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)',
                                }}
                              >
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
                                <div className="flex-1">
                                  <p className="text-xs" style={{ color: 'var(--color-foreground)' }}>
                                    <strong>Note:</strong> To create transfer pairs automatically, you should specify a target account above.
                                    Without a target account, the system can only link with existing transactions.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Auto-Match Disabled State - Show Info */}
                        {!(action.config?.autoMatch ?? true) && (
                          <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
                            <div className="flex-1">
                              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                Auto-matching is disabled. The transaction will be converted to a transfer type,
                                but will not be automatically linked with other transactions.
                                You can manually link it later.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* General Information Box */}
                        <div className="flex items-start gap-2 rounded-lg p-3 mt-4" style={{ backgroundColor: 'var(--color-elevated)' }}>
                          <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                          <div className="flex-1">
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-foreground)' }}>
                              <strong>How it works:</strong> This action converts transactions to transfers between accounts.
                              It can automatically find and link matching opposite transactions (e.g., expense in one account
                              matching income in another), or create a new transfer pair if none is found.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {action.type === 'create_split' && (
                      <div className="flex-1 space-y-4">
                        {/* Split Items List */}
                        {(((action.config as ActionConfig | undefined)?.splits ?? []) as SplitItem[]).length > 0 ? (
                          <div className="space-y-3">
                            {(((action.config as ActionConfig | undefined)?.splits ?? []) as SplitItem[]).map((split: SplitItem, splitIndex: number) => (
                              <div key={splitIndex} className="rounded-lg p-4 space-y-3" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                                {/* Split Header with Remove Button */}
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                                    Split {splitIndex + 1}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSplit(index, splitIndex)}
                                    className="h-7 w-7 p-0 hover:opacity-80"
                                    style={{ color: 'var(--color-destructive)' }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Category Selector */}
                                <div className="space-y-2">
                                  <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>Category</Label>
                                  {isCreatingCategory && categoryCreationActionIndex === index && categoryCreationSplitIndex === splitIndex ? (
                                    <div className="flex gap-2">
                                      <Input
                                        autoFocus
                                        type="text"
                                        placeholder="New category name..."
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCreateCategory(index, splitIndex);
                                          } else if (e.key === 'Escape') {
                                            cancelCategoryCreation();
                                          }
                                        }}
                                        className="flex-1"
                              style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        onClick={() => handleCreateCategory(index, splitIndex)}
                                        disabled={creatingCategory || !newCategoryName.trim()}
                                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                              className="hover:opacity-90"
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={cancelCategoryCreation}
                                        className="hover:opacity-90"
                              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Select
                                        value={split.categoryId || ''}
                                        onValueChange={(val) =>
                                          updateSplitField(index, splitIndex, 'categoryId', val)
                                        }
                                      >
                                        <SelectTrigger className="flex-1" style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}>
                                          <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {loadingData ? (
                                            <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading...</div>
                                          ) : categories.length > 0 ? (
                                            categories.map((category) => (
                                              <SelectItem key={category.id} value={category.id}>
                                                <div className="flex items-center gap-2">
                                                  <Tag className="w-3 h-3" />
                                                  {category.name}
                                                  <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                                    ({category.type})
                                                  </span>
                                                </div>
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No categories found</div>
                                          )}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => startCategoryCreation(index, splitIndex)}
                                        className="hover:opacity-90"
                              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
                                        title="Create new category"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* Amount Type Toggle (Fixed vs Percentage) */}
                                <div className="space-y-2">
                                  <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>Amount Type</Label>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        updateSplitField(index, splitIndex, 'isPercentage', false);
                                        if (!split.amount) {
                                          updateSplitField(index, splitIndex, 'amount', 0);
                                        }
                                      }}
                                      className="flex-1 hover:opacity-90"
                                      style={{
                                        backgroundColor: !split.isPercentage ? 'var(--color-primary)' : 'var(--color-elevated)',
                                        color: !split.isPercentage ? 'white' : 'var(--color-foreground)',
                                        borderColor: !split.isPercentage ? 'var(--color-primary)' : 'var(--color-border)',
                                      }}
                                    >
                                      <DollarSign className="h-4 w-4 mr-1" />
                                      Fixed Amount
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        updateSplitField(index, splitIndex, 'isPercentage', true);
                                        if (!split.percentage) {
                                          updateSplitField(index, splitIndex, 'percentage', 0);
                                        }
                                      }}
                                      className="flex-1 hover:opacity-90"
                                      style={{
                                        backgroundColor: split.isPercentage ? 'var(--color-primary)' : 'var(--color-elevated)',
                                        color: split.isPercentage ? 'white' : 'var(--color-foreground)',
                                        borderColor: split.isPercentage ? 'var(--color-primary)' : 'var(--color-border)',
                                      }}
                                    >
                                      <Percent className="h-4 w-4 mr-1" />
                                      Percentage
                                    </Button>
                                  </div>
                                </div>

                                {/* Amount/Percentage Input */}
                                <div className="space-y-2">
                                  {split.isPercentage ? (
                                    <>
                                      <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>Percentage (%)</Label>
                                      <Input
                                        type="number"
                                        min="0.1"
                                        max="100"
                                        step="0.1"
                                        value={split.percentage || ''}
                                        onChange={(e) =>
                                          updateSplitField(
                                            index,
                                            splitIndex,
                                            'percentage',
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        placeholder="e.g., 50"
                                        style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}
                                      />
                                      <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                        Enter percentage of total transaction amount (0.1% - 100%)
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>Amount ($)</Label>
                                      <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={split.amount || ''}
                                        onChange={(e) =>
                                          updateSplitField(
                                            index,
                                            splitIndex,
                                            'amount',
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        placeholder="e.g., 25.00"
                                        style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}
                                      />
                                      <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                        Enter fixed dollar amount
                                      </p>
                                    </>
                                  )}
                                </div>

                                {/* Optional Description */}
                                <div className="space-y-2">
                                  <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                                    Description
                                    <span className="ml-1" style={{ color: 'var(--color-muted-foreground)' }}>(Optional)</span>
                                  </Label>
                                  <Input
                                    type="text"
                                    value={split.description || ''}
                                    onChange={(e) =>
                                      updateSplitField(index, splitIndex, 'description', e.target.value)
                                    }
                                    placeholder="Optional note for this split"
                                    style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Empty State
                          <div className="text-center p-6 rounded-lg border-dashed" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                            <Scissors className="w-10 h-10 mx-auto mb-3 opacity-50" style={{ color: 'var(--color-muted-foreground)' }} />
                            <p className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>No splits configured</p>
                            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                              Add splits to divide this transaction across multiple categories.
                            </p>
                          </div>
                        )}

                        {/* Add Split Button */}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addSplit(index)}
                          className="w-full border-dashed border-2 hover:opacity-90"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)' }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Split
                        </Button>

                        {/* Validation Display */}
                        {(((action.config as ActionConfig | undefined)?.splits ?? []) as SplitItem[]).length > 0 && (
                          <div className="space-y-2">
                            {/* Total Percentage Display */}
                            {(() => {
                              const splits = ((action.config as ActionConfig | undefined)?.splits ?? []) as SplitItem[];
                              const percentageSplits = splits.filter((s: SplitItem) => s.isPercentage);
                              const totalPercentage = percentageSplits.reduce(
                                (sum: number, s: SplitItem) => sum + (s.percentage || 0),
                                0
                              );
                              const hasPercentage = percentageSplits.length > 0;

                              if (hasPercentage) {
                                return (
                                  <div
                                    className="flex items-center gap-2 p-3 rounded-lg border"
                                    style={{
                                      backgroundColor: totalPercentage > 100 ? 'color-mix(in oklch, var(--color-destructive) 10%, transparent)' : totalPercentage === 100 ? 'color-mix(in oklch, var(--color-success) 10%, transparent)' : 'var(--color-elevated)',
                                      borderColor: totalPercentage > 100 ? 'color-mix(in oklch, var(--color-destructive) 30%, transparent)' : totalPercentage === 100 ? 'color-mix(in oklch, var(--color-success) 30%, transparent)' : 'var(--color-border)',
                                    }}
                                  >
                                    <Percent className="h-4 w-4" style={{ color: 'var(--color-foreground)' }} />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                                        Total Percentage: {totalPercentage.toFixed(1)}%
                                      </p>
                                      {totalPercentage > 100 && (
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-destructive)' }}>
                                          Total exceeds 100% - please adjust your splits
                                        </p>
                                      )}
                                      {totalPercentage < 100 && (
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                          {(100 - totalPercentage).toFixed(1)}% will remain unallocated
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Fixed Amount Summary */}
                            {(() => {
                              const splits = ((action.config as ActionConfig | undefined)?.splits ?? []) as SplitItem[];
                              const fixedSplits = splits.filter((s: SplitItem) => !s.isPercentage);
                              const totalFixed = fixedSplits.reduce(
                                (sum: number, s: SplitItem) => sum + (s.amount || 0),
                                0
                              );
                              const hasFixed = fixedSplits.length > 0;

                              if (hasFixed) {
                                return (
                                  <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                                    <DollarSign className="h-4 w-4" style={{ color: 'var(--color-foreground)' }} />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                                        Total Fixed Amount: ${totalFixed.toFixed(2)}
                                      </p>
                                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                                        This amount will be allocated regardless of transaction total
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}

                        {/* Information Box */}
                        <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)' }}>
                          <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                          <div className="flex-1">
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-foreground)' }}>
                              <strong>How it works:</strong> This action automatically splits transactions across multiple categories.
                              You can use percentages (e.g., 60% Groceries, 40% Household) or fixed amounts (e.g., $50 Food, $30 Gas).
                              Mixed splits are also supported. Any unallocated amount remains with the original transaction.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {action.type === 'set_account' && (
                      <div className="flex-1 space-y-4">
                        {/* Account Selector */}
                        <div className="space-y-2">
                          <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>Target Account</Label>
                          <Select
                            value={action.value || ''}
                            onValueChange={(value) => updateAction(index, { ...action, value })}
                          >
                            <SelectTrigger style={{ backgroundColor: 'var(--color-input)', borderColor: 'var(--color-border)' }}>
                              <SelectValue placeholder="Select account">
                                {action.value && accounts.find(a => a.id === action.value)?.name}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {loadingData ? (
                                  <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading...</div>
                              ) : accounts.length > 0 ? (
                                accounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    <div className="flex items-center gap-2">
                                      {account.color && (
                                        <div
                                          className="w-3 h-3 rounded-full"
                                        style={{ border: '1px solid var(--color-border)' }}
                                          style={{ backgroundColor: account.color }}
                                        />
                                      )}
                                      <span style={{ color: 'var(--color-foreground)' }}>{account.name}</span>
                                      <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                                        ({account.type})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                  <div className="p-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No accounts found</div>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                            Transactions matching this rule will be moved to this account
                          </p>
                        </div>

                        {/* Warning Box */}
                        <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
                          <div className="flex-1">
                            <p className="text-xs" style={{ color: 'var(--color-foreground)' }}>
                              <strong>Important:</strong> Changing an account will update account balances automatically.
                              Transfer transactions cannot be moved between accounts.
                            </p>
                          </div>
                        </div>

                        {/* Information Box */}
                        <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: 'var(--color-elevated)' }}>
                          <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                          <div className="flex-1">
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-foreground)' }}>
                              <strong>How it works:</strong> This action moves transactions to a different account.
                              Use this to automatically route transactions to the correct account based on merchant,
                              amount, or other criteria. Account balances are updated automatically.
                            </p>
                          </div>
                        </div>

                        {/* Use Case Examples */}
                        <div className="space-y-2">
                          <Label className="text-sm" style={{ color: 'var(--color-foreground)' }}>Common Use Cases:</Label>
                          <div className="space-y-1 text-xs pl-3" style={{ color: 'var(--color-muted-foreground)' }}>
                            <p>• Move all business expenses to business account</p>
                            <p>• Route specific merchants to preferred payment card</p>
                            <p>• Organize transactions by account type automatically</p>
                            <p>• Correct misclassified transactions by amount threshold</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAction(index)}
                    className="shrink-0 hover:opacity-80"
                    style={{ color: 'var(--color-destructive)' }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {actions.length === 0 && (
          <div className="text-center p-8 rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" style={{ color: 'var(--color-muted-foreground)' }} />
            <p className="text-sm mb-1" style={{ color: 'var(--color-muted-foreground)' }}>No actions configured</p>
            <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
              Add at least one action to apply when conditions match.
            </p>
          </div>
        )}

        {/* Add Action Button */}
        <Button
          type="button"
          variant="outline"
          onClick={addAction}
          className="w-full border-dashed border-2 hover:opacity-90"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)' }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Action
        </Button>

        {/* Helper Text */}
        <div className="text-xs p-3 rounded-lg flex gap-2" style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <FileEdit className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div>
            <p className="mb-1">About actions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Actions are applied in the order listed when a rule matches</li>
              <li>Use pattern variables in descriptions to insert dynamic values</li>
              <li>Example: &quot;{'{original}'} - Work&quot; becomes &quot;Coffee at Starbucks - Work&quot;</li>
              <li>At least one action is required for the rule to work</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
