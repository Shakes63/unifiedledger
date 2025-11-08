'use client';

import { useState } from 'react';
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
import { Plus, X, ChevronDown, AlertCircle } from 'lucide-react';
import { Condition, ConditionGroup, ComparisonOperator, ConditionField } from '@/lib/rules/condition-evaluator';
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

interface RuleBuilderProps {
  initialConditions?: ConditionGroup | Condition;
  onConditionsChange: (conditions: ConditionGroup | Condition) => void;
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
    <div className="flex gap-2 items-end p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]">
      <Select value={condition.field} onValueChange={(field) => onUpdate({ ...condition, field: field as ConditionField })}>
        <SelectTrigger className="w-32 bg-[#1a1a1a] border-[#3a3a3a] text-white">
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
        <SelectTrigger className="w-40 bg-[#1a1a1a] border-[#3a3a3a] text-white">
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
        className="flex-1 bg-[#1a1a1a] border-[#3a3a3a] text-white placeholder-gray-600"
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="text-red-400 hover:bg-red-500/20"
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
    <div className={`space-y-3 p-4 rounded-lg border border-[#2a2a2a] ${level > 0 ? 'bg-[#1a1a1a]' : 'bg-[#0a0a0a]'}`}>
      {/* Group Logic Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Logic:</span>
        <div className="flex gap-2">
          {(['AND', 'OR'] as const).map((logic) => (
            <Button
              key={logic}
              variant={group.logic === logic ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdate({ ...group, logic })}
              className={group.logic === logic ? 'bg-white text-black' : 'bg-[#242424] text-white border-[#3a3a3a]'}
            >
              {logic}
            </Button>
          ))}
        </div>
        {level > 0 && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="ml-auto text-red-400 hover:bg-red-500/20"
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
              <div className="text-xs text-gray-500 px-3 py-1">{group.logic}</div>
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
      <div className="flex gap-2 pt-2 border-t border-[#2a2a2a]">
        <Button
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Condition
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addGroup}
          className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]"
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

  const handleUpdate = (updated: ConditionGroup | Condition) => {
    setConditions(updated);
    onConditionsChange(updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-white mb-2 block">Conditions</label>
        <p className="text-xs text-gray-400 mb-3">
          Define conditions that must match for this rule to apply to a transaction.
        </p>
      </div>

      {'conditions' in conditions ? (
        <ConditionGroupEditor
          group={conditions as ConditionGroup}
          onUpdate={handleUpdate}
        />
      ) : (
        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
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

      <div className="text-xs text-gray-500 p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] flex gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
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
    </div>
  );
}
