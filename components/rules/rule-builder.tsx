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
import { Plus, X, ChevronDown, AlertCircle, Zap, Tag, Store, FileEdit } from 'lucide-react';
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
  const [loadingData, setLoadingData] = useState(true);

  // Fetch categories and merchants
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, merchantsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/merchants')
        ]);

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData);
        }

        if (merchantsRes.ok) {
          const merchantsData = await merchantsRes.json();
          setMerchants(merchantsData);
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
                        <SelectItem value="set_category">Set Category</SelectItem>
                        <SelectItem value="set_description">Set Description</SelectItem>
                        <SelectItem value="prepend_description">Prepend to Description</SelectItem>
                        <SelectItem value="append_description">Append to Description</SelectItem>
                        <SelectItem value="set_merchant">Set Merchant</SelectItem>
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
