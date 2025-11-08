/**
 * Categorization Rule Condition Evaluator
 * Evaluates transaction data against rule conditions
 */

export type ComparisonOperator =
  | 'equals'           // exact match
  | 'not_equals'       // not equal
  | 'contains'         // string contains
  | 'not_contains'     // string does not contain
  | 'starts_with'      // string starts with
  | 'ends_with'        // string ends with
  | 'greater_than'     // amount greater than
  | 'less_than'        // amount less than
  | 'between'          // amount between two values
  | 'regex'            // regex pattern match
  | 'in_list'          // value in comma-separated list
  | 'matches_day'      // transaction day matches (0-31)
  | 'matches_weekday'  // transaction weekday matches (0-6)
  | 'matches_month';   // transaction month matches (1-12)

export type ConditionField =
  | 'description'      // transaction description
  | 'amount'           // transaction amount
  | 'account_name'     // account name
  | 'date'             // transaction date (YYYY-MM-DD)
  | 'day_of_month'     // day portion of date
  | 'weekday'          // day of week (0=Sunday)
  | 'month'            // month (1-12)
  | 'notes';           // transaction notes

export interface Condition {
  id?: string;
  field: ConditionField;
  operator: ComparisonOperator;
  value: string;      // value to compare (can be comma-separated for in_list)
  caseSensitive?: boolean;
}

export interface ConditionGroup {
  id?: string;
  logic: 'AND' | 'OR';  // how to combine conditions in this group
  conditions: (Condition | ConditionGroup)[];
}

export interface TransactionData {
  description: string;
  amount: number;
  accountName: string;
  date: string;      // YYYY-MM-DD format
  notes?: string;
}

/**
 * Evaluate a single condition against transaction data
 */
function evaluateCondition(condition: Condition, transaction: TransactionData): boolean {
  const { field, operator, value, caseSensitive = false } = condition;

  // Get the field value from transaction
  let fieldValue: string | number | undefined;

  switch (field) {
    case 'description':
      fieldValue = transaction.description;
      break;
    case 'amount':
      fieldValue = transaction.amount;
      break;
    case 'account_name':
      fieldValue = transaction.accountName;
      break;
    case 'date':
      fieldValue = transaction.date;
      break;
    case 'day_of_month':
      fieldValue = parseInt(transaction.date.split('-')[2], 10);
      break;
    case 'weekday':
      fieldValue = new Date(transaction.date).getDay();
      break;
    case 'month':
      fieldValue = parseInt(transaction.date.split('-')[1], 10);
      break;
    case 'notes':
      fieldValue = transaction.notes || '';
      break;
    default:
      return false;
  }

  // Convert field value to string for comparison (except for numeric operations)
  const stringFieldValue = String(fieldValue).toLowerCase();
  const normalizedValue = caseSensitive ? value : value.toLowerCase();

  // Apply operator
  switch (operator) {
    case 'equals':
      return stringFieldValue === normalizedValue;

    case 'not_equals':
      return stringFieldValue !== normalizedValue;

    case 'contains':
      return stringFieldValue.includes(normalizedValue);

    case 'not_contains':
      return !stringFieldValue.includes(normalizedValue);

    case 'starts_with':
      return stringFieldValue.startsWith(normalizedValue);

    case 'ends_with':
      return stringFieldValue.endsWith(normalizedValue);

    case 'greater_than':
      return Number(fieldValue) > Number(value);

    case 'less_than':
      return Number(fieldValue) < Number(value);

    case 'between': {
      const [min, max] = value.split(',').map(v => Number(v.trim()));
      return Number(fieldValue) >= min && Number(fieldValue) <= max;
    }

    case 'regex':
      try {
        const regex = new RegExp(value, caseSensitive ? '' : 'i');
        return regex.test(stringFieldValue);
      } catch {
        return false;
      }

    case 'in_list': {
      const list = value.split(',').map(v => v.trim().toLowerCase());
      return list.includes(stringFieldValue);
    }

    case 'matches_day':
      return String(fieldValue) === value.trim();

    case 'matches_weekday':
      return String(fieldValue) === value.trim();

    case 'matches_month':
      return String(fieldValue) === value.trim();

    default:
      return false;
  }
}

/**
 * Recursively evaluate a condition group or single condition
 */
function evaluateConditionGroup(
  group: ConditionGroup | Condition,
  transaction: TransactionData
): boolean {
  // If it's a single condition, evaluate it directly
  if (!('conditions' in group)) {
    return evaluateCondition(group as Condition, transaction);
  }

  // If it's a group, evaluate all conditions
  const conditionGroup = group as ConditionGroup;
  const { logic, conditions } = conditionGroup;

  if (conditions.length === 0) {
    return true; // Empty group matches all
  }

  const results = conditions.map(cond =>
    evaluateConditionGroup(cond, transaction)
  );

  if (logic === 'AND') {
    return results.every(r => r === true);
  } else {
    return results.some(r => r === true);
  }
}

/**
 * Evaluate a condition tree against a transaction
 * Returns true if the transaction matches all conditions
 */
export function evaluateConditions(
  conditions: ConditionGroup | Condition,
  transaction: TransactionData
): boolean {
  return evaluateConditionGroup(conditions, transaction);
}

/**
 * Validate condition syntax and return any errors
 */
export function validateCondition(condition: Condition): string[] {
  const errors: string[] = [];

  if (!condition.field) {
    errors.push('Field is required');
  }

  if (!condition.operator) {
    errors.push('Operator is required');
  }

  if (!condition.value) {
    errors.push('Value is required');
  }

  // Validate specific operator-field combinations
  const numericFields = ['amount', 'day_of_month', 'weekday', 'month'];
  const isNumericField = numericFields.includes(condition.field);

  if (
    (condition.operator === 'greater_than' ||
     condition.operator === 'less_than' ||
     condition.operator === 'between') &&
    !isNumericField
  ) {
    errors.push(`Operator ${condition.operator} can only be used with numeric fields`);
  }

  // Validate regex patterns
  if (condition.operator === 'regex') {
    try {
      new RegExp(condition.value);
    } catch {
      errors.push('Invalid regex pattern');
    }
  }

  // Validate between operator format
  if (condition.operator === 'between') {
    const parts = condition.value.split(',');
    if (parts.length !== 2) {
      errors.push('Between operator requires two comma-separated values');
    }
    if (parts.some(p => isNaN(Number(p.trim())))) {
      errors.push('Between operator values must be numeric');
    }
  }

  return errors;
}

/**
 * Validate a condition group recursively
 */
export function validateConditionGroup(group: ConditionGroup | Condition): string[] {
  const errors: string[] = [];

  if (!('conditions' in group)) {
    // It's a condition
    return validateCondition(group as Condition);
  }

  // It's a group
  const conditionGroup = group as ConditionGroup;

  if (!conditionGroup.logic || !['AND', 'OR'].includes(conditionGroup.logic)) {
    errors.push('Group logic must be AND or OR');
  }

  if (!Array.isArray(conditionGroup.conditions) || conditionGroup.conditions.length === 0) {
    errors.push('Group must contain at least one condition');
  }

  // Recursively validate all conditions
  conditionGroup.conditions.forEach((cond, index) => {
    const subErrors = validateConditionGroup(cond);
    subErrors.forEach(err => {
      errors.push(`Condition ${index + 1}: ${err}`);
    });
  });

  return errors;
}
