'use client';

import { useState, useEffect } from 'react';
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
import { Plus, X, ChevronDown, AlertCircle, Zap, Tag, Store, FileEdit, FileText, ArrowRightLeft, Settings, Lightbulb, Scissors, DollarSign, Percent, Banknote, Receipt } from 'lucide-react';
import { Condition, ConditionGroup, ComparisonOperator, ConditionField } from '@/lib/rules/condition-evaluator';
import { RuleAction } from '@/lib/rules/types';
import { nanoid } from 'nanoid';

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
  level = 0,
}: {
  condition: Condition;
  onUpdate: (updated: Condition) => void;
  onRemove: () => void;
  level?: number;
}) {
  return (
    <div className="flex gap-2 items-end p-3 bg-elevated rounded-lg border border-border">
      <Select value={condition.field} onValueChange={(field) => onUpdate({ ...condition, field: field as ConditionField })}>
        <SelectTrigger className="w-32 bg-card border-border text-foreground">
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
        <SelectTrigger className="w-40 bg-card border-border text-foreground">
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
        className="flex-1 bg-card border-border text-foreground placeholder:text-muted-foreground"
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-[var(--color-error)] hover:bg-[var(--color-error)]/20"
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
    <div className={`space-y-3 p-4 rounded-lg border border-border ${level > 0 ? 'bg-card' : 'bg-background'}`}>
      {/* Group Logic Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Logic:</span>
        <div className="flex gap-2">
          {(['AND', 'OR'] as const).map((logic) => (
            <button
              key={logic}
              type="button"
              onClick={() => onUpdate({ ...group, logic })}
              className={`px-3 py-1 text-sm font-medium rounded-md border-2 transition-colors ${
                group.logic === logic
                  ? 'bg-[var(--color-transfer)] text-white border-[var(--color-transfer)] hover:opacity-80'
                  : 'bg-elevated text-foreground border-border hover:bg-elevated hover:border-[var(--color-transfer)]/30'
              }`}
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
            className="ml-auto text-[var(--color-error)] hover:bg-[var(--color-error)]/20"
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
              <div className="text-xs text-muted-foreground px-3 py-1">{group.logic}</div>
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
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="bg-elevated text-foreground border-border hover:bg-elevated"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Condition
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addGroup}
          className="bg-elevated text-foreground border-border hover:bg-elevated"
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [taxCategories, setTaxCategories] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch categories, merchants, accounts, and tax categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, merchantsRes, accountsRes, taxCategoriesRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/merchants'),
          fetch('/api/accounts?sortBy=name&sortOrder=asc'),
          fetch('/api/sales-tax/categories')
        ]);

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }

        if (merchantsRes.ok) {
          const merchantsData = await merchantsRes.json();
          setMerchants(merchantsData);
        }

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.data || []);
        }

        if (taxCategoriesRes.ok) {
          const taxCategoriesData = await taxCategoriesRes.json();
          setTaxCategories(taxCategoriesData.categories || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, []);

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

  const updateActionConfig = (index: number, config: any) => {
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
    if (!updatedActions[actionIndex].config) {
      updatedActions[actionIndex].config = { splits: [] };
    }
    if (!updatedActions[actionIndex].config.splits) {
      updatedActions[actionIndex].config.splits = [];
    }

    updatedActions[actionIndex].config.splits.push(newSplit);
    handleActionsUpdate(updatedActions);
  };

  const removeSplit = (actionIndex: number, splitIndex: number) => {
    const updatedActions = [...actions];
    if (updatedActions[actionIndex].config?.splits) {
      updatedActions[actionIndex].config.splits.splice(splitIndex, 1);
      handleActionsUpdate(updatedActions);
    }
  };

  const updateSplitField = (
    actionIndex: number,
    splitIndex: number,
    field: string,
    value: any
  ) => {
    const updatedActions = [...actions];
    if (updatedActions[actionIndex].config?.splits) {
      updatedActions[actionIndex].config.splits[splitIndex][field] = value;
      handleActionsUpdate(updatedActions);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Conditions</label>
        <p className="text-xs text-muted-foreground mb-3">
          Define conditions that must match for this rule to apply to a transaction.
        </p>
      </div>

      {'conditions' in conditions ? (
        <ConditionGroupEditor
          group={conditions as ConditionGroup}
          onUpdate={handleUpdate}
        />
      ) : (
        <Card className="bg-background border-border">
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

      <div className="text-xs text-muted-foreground p-3 bg-card rounded-lg border border-border flex gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-primary)]" />
        <div>
          <p className="mb-1">Tips for writing conditions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use "Contains" for partial matches in description</li>
            <li>Use "In list" with comma-separated values for multiple options</li>
            <li>Use "Between" for amount ranges like "10, 50"</li>
            <li>Day of week: 0=Sunday, 1=Monday, etc.</li>
          </ul>
        </div>
      </div>

      {/* Actions Section */}
      <div className="space-y-4 pt-6 mt-6 border-t border-border">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--color-primary)]" />
            Actions to Apply
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Define what changes to make when a transaction matches the conditions above.
          </p>
        </div>

        {/* Action Items */}
        {actions.length > 0 && (
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div key={index} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start gap-4">
                  {/* Action Type Selector */}
                  <div className="w-48">
                    <Select
                      value={action.type}
                      onValueChange={(type: any) => {
                        const updated: RuleAction = {
                          type,
                          value: type === 'set_category' || type === 'set_merchant' ? '' : undefined,
                          pattern: type.includes('description') ? '' : undefined,
                        };
                        updateAction(index, updated);
                      }}
                    >
                      <SelectTrigger className="bg-input border-border text-foreground">
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
                            <Receipt className="h-4 w-4 text-[var(--color-warning)]" />
                            Set Sales Tax
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Configuration */}
                  <div className="flex-1">
                    {action.type === 'set_category' && (
                      <Select
                        value={action.value || ''}
                        onValueChange={(value) => updateAction(index, { ...action, value })}
                      >
                        <SelectTrigger className="bg-input border-border text-foreground">
                          <SelectValue placeholder="Select category">
                            {action.value && categories.find(c => c.id === action.value)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {loadingData ? (
                            <div className="p-2 text-sm text-muted-foreground">Loading...</div>
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
                            <div className="p-2 text-sm text-muted-foreground">No categories found</div>
                          )}
                        </SelectContent>
                      </Select>
                    )}

                    {action.type === 'set_merchant' && (
                      <Select
                        value={action.value || ''}
                        onValueChange={(value) => updateAction(index, { ...action, value })}
                      >
                        <SelectTrigger className="bg-input border-border text-foreground">
                          <SelectValue placeholder="Select merchant">
                            {action.value && merchants.find(m => m.id === action.value)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {loadingData ? (
                            <div className="p-2 text-sm text-muted-foreground">Loading...</div>
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
                            <div className="p-2 text-sm text-muted-foreground">No merchants found</div>
                          )}
                        </SelectContent>
                      </Select>
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
                          className="bg-input border-border text-foreground font-mono text-sm"
                        />
                        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                          <span>Variables:</span>
                          <code className="px-1 py-0.5 bg-elevated rounded text-[var(--color-primary)]">{'{original}'}</code>
                          <code className="px-1 py-0.5 bg-elevated rounded text-[var(--color-primary)]">{'{merchant}'}</code>
                          <code className="px-1 py-0.5 bg-elevated rounded text-[var(--color-primary)]">{'{category}'}</code>
                          <code className="px-1 py-0.5 bg-elevated rounded text-[var(--color-primary)]">{'{amount}'}</code>
                          <code className="px-1 py-0.5 bg-elevated rounded text-[var(--color-primary)]">{'{date}'}</code>
                        </div>
                      </div>
                    )}

                    {action.type === 'set_tax_deduction' && (
                      <div className="flex-1 bg-elevated rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-foreground">
                              This action will mark transactions as tax deductible if their category is configured as tax deductible.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Requires a category to be set (either manually or via a set_category action).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {action.type === 'set_sales_tax' && (
                      <div className="flex-1 space-y-4">
                        {/* Tax Rate Selector */}
                        <div className="space-y-2">
                          <Label className="text-sm text-foreground">Tax Rate</Label>
                          <Select
                            value={action.config?.taxCategoryId || ''}
                            onValueChange={(val) =>
                              updateActionConfig(index, {
                                ...action.config,
                                taxCategoryId: val
                              })
                            }
                          >
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Select tax rate" />
                            </SelectTrigger>
                            <SelectContent>
                              {taxCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name} ({(cat.rate * 100).toFixed(2)}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Warning Box */}
                        <div className="rounded-lg bg-[var(--color-warning)] bg-opacity-10 border border-[var(--color-warning)] p-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p className="font-medium text-foreground">Important Notes:</p>
                              <ul className="list-disc list-inside space-y-0.5 ml-1">
                                <li>Only applies to income transactions</li>
                                <li>Creates sales tax record for quarterly reporting</li>
                                <li>Tax amount calculated automatically based on rate</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Info Box */}
                        <div className="rounded-lg bg-[var(--color-accent)] bg-opacity-10 border border-[var(--color-accent)] p-3">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p className="font-medium text-foreground">Common Use Cases:</p>
                              <ul className="list-disc list-inside space-y-0.5 ml-1">
                                <li>Apply tax to all product sales</li>
                                <li>Apply different rates for different product categories</li>
                                <li>Automatically track taxable income for filing</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {action.type === 'convert_to_transfer' && (
                      <div className="flex-1 space-y-4">
                        {/* Target Account Selector */}
                        <div className="space-y-2">
                          <Label className="text-sm text-foreground">
                            Target Account
                            <span className="text-muted-foreground ml-1">(Optional)</span>
                          </Label>
                          <Select
                            value={action.config?.targetAccountId || ''}
                            onValueChange={(val) =>
                              updateActionConfig(index, {
                                ...action.config,
                                targetAccountId: val || undefined
                              })
                            }
                          >
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Auto-detect or select account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">
                                <div className="flex items-center gap-2">
                                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                                  <span>Auto-detect account</span>
                                </div>
                              </SelectItem>
                              {accounts.map((acc) => (
                                <SelectItem key={acc.id} value={acc.id}>
                                  <div className="flex items-center gap-2">
                                    {acc.color && (
                                      <div
                                        className="w-3 h-3 rounded-full border border-border"
                                        style={{ backgroundColor: acc.color }}
                                      />
                                    )}
                                    <span className="text-foreground">{acc.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({acc.type})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Leave blank to auto-match with any account. Specify an account to only match transfers with that account.
                          </p>
                        </div>

                        {/* Auto-Match Toggle */}
                        <div className="flex items-center justify-between bg-elevated rounded-lg p-3 border border-border">
                          <div className="flex-1 mr-4">
                            <Label className="text-sm text-foreground font-medium">
                              Auto-Match with Existing Transaction
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Search for matching opposite transaction to link as transfer pair (recommended)
                            </p>
                          </div>
                          <Switch
                            checked={action.config?.autoMatch ?? true}
                            onCheckedChange={(checked) =>
                              updateActionConfig(index, { ...action.config, autoMatch: checked })
                            }
                          />
                        </div>

                        {/* Advanced Options - Only show if Auto-Match is enabled */}
                        {(action.config?.autoMatch ?? true) && (
                          <div className="space-y-3 border-l-2 border-[var(--color-primary)] pl-4 mt-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Settings className="h-4 w-4 text-[var(--color-primary)]" />
                              <span className="text-sm font-medium text-foreground">Advanced Matching Options</span>
                            </div>

                            {/* Amount Tolerance */}
                            <div className="space-y-2">
                              <Label className="text-sm text-foreground">
                                Amount Tolerance (%)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={action.config?.matchTolerance ?? 1}
                                onChange={(e) =>
                                  updateActionConfig(index, {
                                    ...action.config,
                                    matchTolerance: parseFloat(e.target.value) || 1,
                                  })
                                }
                                className="bg-input border-border"
                              />
                              <p className="text-xs text-muted-foreground">
                                Allow amount difference up to this percentage (default: 1%).
                                For $100 transaction with 1% tolerance, will match $99-$101.
                              </p>
                            </div>

                            {/* Date Range */}
                            <div className="space-y-2">
                              <Label className="text-sm text-foreground">
                                Date Range (days)
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                max="30"
                                value={action.config?.matchDayRange ?? 7}
                                onChange={(e) =>
                                  updateActionConfig(index, {
                                    ...action.config,
                                    matchDayRange: parseInt(e.target.value) || 7,
                                  })
                                }
                                className="bg-input border-border"
                              />
                              <p className="text-xs text-muted-foreground">
                                Search ±N days from transaction date (default: 7 days).
                                Larger range = more matches but less precision.
                              </p>
                            </div>

                            {/* Create if No Match Toggle */}
                            <div className="flex items-center justify-between bg-card rounded-lg p-3 border border-border">
                              <div className="flex-1 mr-4">
                                <Label className="text-sm text-foreground font-medium">
                                  Create Transfer Pair if No Match
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Automatically create matching transaction if no suitable match is found
                                </p>
                              </div>
                              <Switch
                                checked={action.config?.createIfNoMatch ?? true}
                                onCheckedChange={(checked) =>
                                  updateActionConfig(index, { ...action.config, createIfNoMatch: checked })
                                }
                              />
                            </div>

                            {/* Warning if Create Pair enabled but no target account */}
                            {(action.config?.createIfNoMatch ?? true) && !action.config?.targetAccountId && (
                              <div className="flex items-start gap-2 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-3">
                                <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-foreground">
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
                          <div className="flex items-start gap-2 bg-elevated border border-border rounded-lg p-3">
                            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground">
                                Auto-matching is disabled. The transaction will be converted to a transfer type,
                                but will not be automatically linked with other transactions.
                                You can manually link it later.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* General Information Box */}
                        <div className="flex items-start gap-2 bg-elevated rounded-lg p-3 mt-4">
                          <Lightbulb className="h-4 w-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground leading-relaxed">
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
                        {action.config?.splits && action.config.splits.length > 0 ? (
                          <div className="space-y-3">
                            {action.config.splits.map((split: any, splitIndex: number) => (
                              <div key={splitIndex} className="bg-elevated border border-border rounded-lg p-4 space-y-3">
                                {/* Split Header with Remove Button */}
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-foreground">
                                    Split {splitIndex + 1}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSplit(index, splitIndex)}
                                    className="text-[var(--color-error)] hover:bg-[var(--color-error)]/20 h-7 w-7 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Category Selector */}
                                <div className="space-y-2">
                                  <Label className="text-sm text-foreground">Category</Label>
                                  <Select
                                    value={split.categoryId || ''}
                                    onValueChange={(val) =>
                                      updateSplitField(index, splitIndex, 'categoryId', val)
                                    }
                                  >
                                    <SelectTrigger className="bg-input border-border">
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {loadingData ? (
                                        <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                                      ) : categories.length > 0 ? (
                                        categories.map((category) => (
                                          <SelectItem key={category.id} value={category.id}>
                                            <div className="flex items-center gap-2">
                                              <Tag className="w-3 h-3" />
                                              {category.name}
                                              <span className="text-xs text-muted-foreground">
                                                ({category.type})
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <div className="p-2 text-sm text-muted-foreground">No categories found</div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Amount Type Toggle (Fixed vs Percentage) */}
                                <div className="space-y-2">
                                  <Label className="text-sm text-foreground">Amount Type</Label>
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
                                      className={`flex-1 ${
                                        !split.isPercentage
                                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:opacity-90'
                                          : 'bg-elevated border-border text-foreground hover:bg-elevated hover:border-[var(--color-primary)]/30'
                                      }`}
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
                                      className={`flex-1 ${
                                        split.isPercentage
                                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:opacity-90'
                                          : 'bg-elevated border-border text-foreground hover:bg-elevated hover:border-[var(--color-primary)]/30'
                                      }`}
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
                                      <Label className="text-sm text-foreground">Percentage (%)</Label>
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
                                        className="bg-input border-border"
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Enter percentage of total transaction amount (0.1% - 100%)
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <Label className="text-sm text-foreground">Amount ($)</Label>
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
                                        className="bg-input border-border"
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Enter fixed dollar amount
                                      </p>
                                    </>
                                  )}
                                </div>

                                {/* Optional Description */}
                                <div className="space-y-2">
                                  <Label className="text-sm text-foreground">
                                    Description
                                    <span className="text-muted-foreground ml-1">(Optional)</span>
                                  </Label>
                                  <Input
                                    type="text"
                                    value={split.description || ''}
                                    onChange={(e) =>
                                      updateSplitField(index, splitIndex, 'description', e.target.value)
                                    }
                                    placeholder="Optional note for this split"
                                    className="bg-input border-border"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Empty State
                          <div className="text-center p-6 bg-card border border-border rounded-lg border-dashed">
                            <Scissors className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-sm text-muted-foreground mb-1">No splits configured</p>
                            <p className="text-xs text-muted-foreground">
                              Add splits to divide this transaction across multiple categories.
                            </p>
                          </div>
                        )}

                        {/* Add Split Button */}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => addSplit(index)}
                          className="w-full border-dashed border-2 border-border bg-elevated hover:bg-elevated hover:border-[var(--color-primary)]/30 text-foreground"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Split
                        </Button>

                        {/* Validation Display */}
                        {action.config?.splits && action.config.splits.length > 0 && (
                          <div className="space-y-2">
                            {/* Total Percentage Display */}
                            {(() => {
                              const percentageSplits = action.config.splits.filter((s: any) => s.isPercentage);
                              const totalPercentage = percentageSplits.reduce(
                                (sum: number, s: any) => sum + (s.percentage || 0),
                                0
                              );
                              const hasPercentage = percentageSplits.length > 0;

                              if (hasPercentage) {
                                return (
                                  <div
                                    className={`flex items-center gap-2 p-3 rounded-lg border ${
                                      totalPercentage > 100
                                        ? 'bg-[var(--color-error)]/10 border-[var(--color-error)]/30'
                                        : totalPercentage === 100
                                        ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
                                        : 'bg-elevated border-border'
                                    }`}
                                  >
                                    <Percent className="h-4 w-4 text-foreground" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-foreground">
                                        Total Percentage: {totalPercentage.toFixed(1)}%
                                      </p>
                                      {totalPercentage > 100 && (
                                        <p className="text-xs text-[var(--color-error)] mt-0.5">
                                          Total exceeds 100% - please adjust your splits
                                        </p>
                                      )}
                                      {totalPercentage < 100 && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
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
                              const fixedSplits = action.config.splits.filter((s: any) => !s.isPercentage);
                              const totalFixed = fixedSplits.reduce(
                                (sum: number, s: any) => sum + (s.amount || 0),
                                0
                              );
                              const hasFixed = fixedSplits.length > 0;

                              if (hasFixed) {
                                return (
                                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-elevated border-border">
                                    <DollarSign className="h-4 w-4 text-foreground" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-foreground">
                                        Total Fixed Amount: ${totalFixed.toFixed(2)}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
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
                        <div className="flex items-start gap-2 bg-elevated rounded-lg p-3">
                          <Lightbulb className="h-4 w-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground leading-relaxed">
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
                          <Label className="text-sm text-foreground">Target Account</Label>
                          <Select
                            value={action.value || ''}
                            onValueChange={(value) => updateAction(index, { ...action, value })}
                          >
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue placeholder="Select account">
                                {action.value && accounts.find(a => a.id === action.value)?.name}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {loadingData ? (
                                <div className="p-2 text-sm text-muted-foreground">Loading...</div>
                              ) : accounts.length > 0 ? (
                                accounts.map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    <div className="flex items-center gap-2">
                                      {account.color && (
                                        <div
                                          className="w-3 h-3 rounded-full border border-border"
                                          style={{ backgroundColor: account.color }}
                                        />
                                      )}
                                      <span className="text-foreground">{account.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        ({account.type})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">No accounts found</div>
                              )}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Transactions matching this rule will be moved to this account
                          </p>
                        </div>

                        {/* Warning Box */}
                        <div className="flex items-start gap-2 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-lg p-3">
                          <AlertCircle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground">
                              <strong>Important:</strong> Changing an account will update account balances automatically.
                              Transfer transactions cannot be moved between accounts.
                            </p>
                          </div>
                        </div>

                        {/* Information Box */}
                        <div className="flex items-start gap-2 bg-elevated rounded-lg p-3">
                          <Lightbulb className="h-4 w-4 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground leading-relaxed">
                              <strong>How it works:</strong> This action moves transactions to a different account.
                              Use this to automatically route transactions to the correct account based on merchant,
                              amount, or other criteria. Account balances are updated automatically.
                            </p>
                          </div>
                        </div>

                        {/* Use Case Examples */}
                        <div className="space-y-2">
                          <Label className="text-sm text-foreground">Common Use Cases:</Label>
                          <div className="space-y-1 text-xs text-muted-foreground pl-3">
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
                    className="text-[var(--color-error)] hover:bg-[var(--color-error)]/20 flex-shrink-0"
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
          <div className="text-center p-8 bg-card border border-border rounded-lg">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-1">No actions configured</p>
            <p className="text-xs text-muted-foreground">
              Add at least one action to apply when conditions match.
            </p>
          </div>
        )}

        {/* Add Action Button */}
        <Button
          type="button"
          variant="outline"
          onClick={addAction}
          className="w-full border-dashed border-2 border-border bg-elevated hover:bg-elevated hover:border-[var(--color-primary)]/30 text-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Action
        </Button>

        {/* Helper Text */}
        <div className="text-xs text-muted-foreground p-3 bg-card rounded-lg border border-border flex gap-2">
          <FileEdit className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--color-primary)]" />
          <div>
            <p className="mb-1">About actions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Actions are applied in the order listed when a rule matches</li>
              <li>Use pattern variables in descriptions to insert dynamic values</li>
              <li>Example: "{'{original}'} - Work" becomes "Coffee at Starbucks - Work"</li>
              <li>At least one action is required for the rule to work</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
