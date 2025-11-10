# Rules Actions System - Phase 1C: UI Implementation Plan

## Overview
This plan details the frontend UI implementation for the Rules Actions System. The backend (Phase 1A & 1B) is complete, including database schema, types, actions executor, and API integration. Now we need to build the user interface to allow users to configure multiple actions per rule.

**Status:** Phase 1A ✅ | Phase 1B ✅ | **Phase 1C (This Plan) 🟡**

---

## Current State Analysis

### Backend Complete ✅
- **Database:** `actions` column added to `categorizationRules` table (JSON array)
- **Types:** Complete type system in `lib/rules/types.ts` (9 action types, 5 implemented)
- **Executor:** `lib/rules/actions-executor.ts` with full action execution logic
- **APIs:** Transaction creation, bulk apply, rules CRUD all support actions
- **Pattern Variables:** `{original}`, `{merchant}`, `{category}`, `{amount}`, `{date}`
- **Backward Compatibility:** Old rules with only `categoryId` continue to work

### Frontend Needs 🟡
1. **Rule Builder:** Currently only supports conditions, needs actions section
2. **Rules List:** Shows only category, needs to display multiple actions
3. **Rule Cards:** No action preview or count badges
4. **Pattern Builder:** No UI for description pattern variables
5. **Merchant Selector:** No UI for set_merchant action
6. **Details Modal:** No modal to view full rule details with all actions

---

## Design Principles

### UI/UX Goals
1. **Progressive Disclosure:** Show simple view by default, expand for details
2. **Clear Visual Hierarchy:** Actions are secondary to conditions in importance
3. **Inline Editing:** Allow quick edits without full modal flow
4. **Visual Feedback:** Preview action results, show what will change
5. **Consistent Theming:** Use semantic color tokens throughout

### Component Architecture
```
RuleBuilder (Enhanced)
├── Conditions Section (existing)
└── Actions Section (NEW)
    ├── Action List
    │   ├── ActionItem (repeatable)
    │   │   ├── Action Type Selector
    │   │   ├── Action Config (varies by type)
    │   │   │   ├── CategorySelector
    │   │   │   ├── MerchantSelector
    │   │   │   └── PatternBuilder
    │   │   └── Remove Button
    │   └── Add Action Button
    └── Action Preview (optional)

RulesManager (Enhanced)
├── Header with Create Button
├── Rules List
│   └── RuleCard (Enhanced)
│       ├── Rule Name & Status
│       ├── Action Count Badge (NEW)
│       ├── Action Preview (NEW)
│       ├── Priority Controls
│       └── Action Buttons
└── Info Panel

RuleDetailsModal (NEW)
├── Modal Header
├── Conditions Summary
├── Actions List (full detail)
├── Execution History
└── Test Section (before/after preview)
```

---

## Implementation Tasks

### Task 15: Update Rule Builder Component (Actions Section)

**File:** `components/rules/rule-builder.tsx`

**Changes:**
1. Add `actions` state to RuleBuilder component
2. Add `initialActions` prop for editing existing rules
3. Add `onActionsChange` callback prop
4. Create new "Actions" section after conditions
5. Add action type selector dropdown
6. Add dynamic action configuration UI based on type
7. Add remove action button
8. Add "Add Action" button
9. Ensure proper theme integration

**New Props:**
```typescript
interface RuleBuilderProps {
  initialConditions?: ConditionGroup | Condition;
  onConditionsChange: (conditions: ConditionGroup | Condition) => void;
  initialActions?: RuleAction[];  // NEW
  onActionsChange: (actions: RuleAction[]) => void;  // NEW
}
```

**Action Item Component:**
```typescript
function ActionItem({
  action,
  index,
  onUpdate,
  onRemove,
  categories,
  merchants
}: {
  action: RuleAction;
  index: number;
  onUpdate: (action: RuleAction) => void;
  onRemove: () => void;
  categories: Category[];
  merchants: Merchant[];
}) {
  // Render action type selector
  // Render action-specific config UI
  // Render remove button
}
```

**UI Structure:**
```tsx
<div className="space-y-4">
  <div>
    <label className="text-sm font-medium text-foreground mb-2 block">
      Actions to Apply
    </label>
    <p className="text-xs text-muted-foreground mb-3">
      Define what changes to make when a transaction matches the conditions above.
    </p>
  </div>

  {/* Action Items */}
  <div className="space-y-3">
    {actions.map((action, index) => (
      <div key={index} className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start gap-4">
          {/* Action Type Selector */}
          <Select
            value={action.type}
            onValueChange={(type) => updateActionType(index, type)}
          >
            <SelectTrigger className="w-48 bg-input border-border text-foreground">
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

          {/* Action Configuration (varies by type) */}
          <div className="flex-1">
            {renderActionConfig(action, index)}
          </div>

          {/* Remove Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeAction(index)}
            className="text-[var(--color-error)] hover:bg-[var(--color-error)]/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ))}
  </div>

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

  {/* Empty State */}
  {actions.length === 0 && (
    <div className="text-center p-6 bg-card border border-border rounded-lg">
      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">
        No actions configured. Add at least one action to apply when conditions match.
      </p>
    </div>
  )}
</div>
```

**Theme Colors:**
- Backgrounds: `bg-card`, `bg-elevated`, `bg-input`
- Text: `text-foreground`, `text-muted-foreground`
- Borders: `border-border`
- Error: `text-[var(--color-error)]`, `hover:bg-[var(--color-error)]/20`
- Primary: `border-[var(--color-primary)]/30`

---

### Task 16: Create Pattern Builder UI

**File:** `components/rules/pattern-builder.tsx` (NEW)

**Purpose:** Visual UI for building description patterns with variable insertion

**Features:**
1. Text input for pattern
2. Variable chips/buttons for quick insertion
3. Live preview of pattern result
4. Pattern validation
5. Helper text explaining each variable

**Component Structure:**
```typescript
interface PatternBuilderProps {
  value: string;
  onChange: (pattern: string) => void;
  placeholder?: string;
  label?: string;
}

export function PatternBuilder({
  value,
  onChange,
  placeholder = "Enter pattern with variables",
  label = "Pattern"
}: PatternBuilderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const insertVariable = (variable: string) => {
    // Insert variable at cursor position
  };

  const variables = [
    { key: '{original}', label: 'Original', description: 'Original description' },
    { key: '{merchant}', label: 'Merchant', description: 'Merchant name' },
    { key: '{category}', label: 'Category', description: 'Category name' },
    { key: '{amount}', label: 'Amount', description: 'Transaction amount' },
    { key: '{date}', label: 'Date', description: 'Transaction date' },
  ];

  return (
    <div className="space-y-3">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Pattern Input */}
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-input border-border text-foreground font-mono text-sm"
      />

      {/* Variable Buttons */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">
          Insert variable:
        </span>
        {variables.map((variable) => (
          <Button
            key={variable.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => insertVariable(variable.key)}
            className="bg-elevated text-foreground border-border hover:bg-elevated hover:border-[var(--color-primary)]/50 text-xs"
            title={variable.description}
          >
            {variable.label}
          </Button>
        ))}
      </div>

      {/* Preview */}
      {value && (
        <div className="p-3 bg-elevated border border-border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Preview:</div>
          <div className="text-sm text-foreground font-mono">
            {generatePreview(value)}
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground">
        Use variables like {'{original}'} to insert dynamic values. Example: "Work - {'{original}'}"
      </p>
    </div>
  );
}
```

**Preview Function:**
```typescript
function generatePreview(pattern: string): string {
  // Replace variables with example values
  return pattern
    .replace('{original}', 'Coffee at Starbucks')
    .replace('{merchant}', 'Starbucks')
    .replace('{category}', 'Coffee Shops')
    .replace('{amount}', '5.99')
    .replace('{date}', '2025-11-09');
}
```

---

### Task 17: Add Merchant Selector

**File:** `components/rules/merchant-selector.tsx` (NEW)

**Purpose:** Searchable dropdown for selecting merchants in set_merchant action

**Features:**
1. Search/filter merchants by name
2. Create new merchant option
3. Show merchant usage count
4. Clear selection button
5. Responsive design

**Component Structure:**
```typescript
interface MerchantSelectorProps {
  value?: string;
  onChange: (merchantId: string | null) => void;
  placeholder?: string;
}

export function MerchantSelector({
  value,
  onChange,
  placeholder = "Select merchant"
}: MerchantSelectorProps) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      const response = await fetch('/api/merchants');
      if (response.ok) {
        const data = await response.json();
        setMerchants(data);
      }
    } catch (error) {
      console.error('Failed to fetch merchants:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMerchants = merchants.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedMerchant = merchants.find(m => m.id === value);

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-input border-border text-foreground">
          <SelectValue placeholder={placeholder}>
            {selectedMerchant?.name || placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search merchants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 bg-input border-border text-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredMerchants.length > 0 ? (
              filteredMerchants.map((merchant) => (
                <SelectItem key={merchant.id} value={merchant.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{merchant.name}</span>
                    {merchant.usageCount && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {merchant.usageCount}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground text-center">
                No merchants found
              </div>
            )}
          </div>
        </SelectContent>
      </Select>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear selection
        </Button>
      )}
    </div>
  );
}
```

**Similar Component Needed:**
- `components/rules/category-selector.tsx` (likely exists, reuse or enhance)

---

### Task 18: Update Rules List (Action Count & Preview)

**File:** `components/rules/rules-manager.tsx`

**Changes:**
1. Update `Rule` interface to include `actions` field
2. Fetch actions from API (already returned)
3. Display action count badge
4. Show first action preview
5. Handle "Multiple actions" case
6. Update info text about actions

**Updated Rule Interface:**
```typescript
interface Rule {
  id: string;
  name: string;
  categoryId: string;  // Keep for backward compat
  categoryName?: string;
  actions?: RuleAction[];  // NEW
  priority: number;
  isActive: boolean;
  matchCount: number;
  lastMatchedAt?: string;
  description?: string;
}
```

**Action Preview Component:**
```tsx
function ActionPreview({ actions, categories, merchants }: {
  actions: RuleAction[];
  categories: Category[];
  merchants: Merchant[];
}) {
  if (!actions || actions.length === 0) {
    return (
      <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-border">
        No actions
      </Badge>
    );
  }

  const getActionLabel = (action: RuleAction): string => {
    switch (action.type) {
      case 'set_category':
        const category = categories.find(c => c.id === action.value);
        return `Category: ${category?.name || 'Unknown'}`;
      case 'set_merchant':
        const merchant = merchants.find(m => m.id === action.value);
        return `Merchant: ${merchant?.name || 'Unknown'}`;
      case 'set_description':
        return `Set: "${action.pattern}"`;
      case 'prepend_description':
        return `Prepend: "${action.pattern}"`;
      case 'append_description':
        return `Append: "${action.pattern}"`;
      default:
        return action.type;
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Action Count Badge */}
      <Badge className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/40">
        {actions.length} action{actions.length !== 1 ? 's' : ''}
      </Badge>

      {/* First Action Preview */}
      <Badge variant="secondary" className="bg-accent/20 text-accent-foreground border-accent/40">
        {getActionLabel(actions[0])}
      </Badge>

      {/* "+" More Badge */}
      {actions.length > 1 && (
        <Badge variant="outline" className="bg-elevated text-muted-foreground border-border">
          +{actions.length - 1} more
        </Badge>
      )}
    </div>
  );
}
```

**Update RuleCard to use ActionPreview:**
```tsx
<div className="flex items-center gap-3 mb-2">
  <h3 className="font-semibold text-foreground text-lg">{rule.name}</h3>
  {!rule.isActive && (
    <Badge variant="outline" className="bg-muted/20 text-foreground border-border">
      Inactive
    </Badge>
  )}
  <Badge className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]">
    Priority {rule.priority}
  </Badge>
</div>

{/* NEW: Action Preview */}
<div className="mb-2">
  <ActionPreview
    actions={rule.actions || []}
    categories={categories}
    merchants={merchants}
  />
</div>

{rule.description && (
  <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
)}
```

---

### Task 19: Create Rule Details Modal

**File:** `components/rules/rule-details-modal.tsx` (NEW)

**Purpose:** Comprehensive view of all rule details including conditions and actions

**Features:**
1. Full conditions display (formatted nicely)
2. Complete actions list with all details
3. Execution history (last 10 applied instances)
4. Test section with before/after preview
5. Close button and backdrop click to close

**Component Structure:**
```typescript
interface RuleDetailsModalProps {
  rule: Rule;
  open: boolean;
  onClose: () => void;
}

export function RuleDetailsModal({ rule, open, onClose }: RuleDetailsModalProps) {
  const [executionHistory, setExecutionHistory] = useState<ExecutionLog[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && rule.id) {
      fetchExecutionHistory();
    }
  }, [open, rule.id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {rule.name}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
              Priority {rule.priority}
            </Badge>
            <Badge variant={rule.isActive ? "default" : "outline"}>
              {rule.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="secondary">
              {rule.matchCount} matches
            </Badge>
          </div>
        </DialogHeader>

        {/* Conditions Section */}
        <div className="space-y-3 mt-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Conditions
          </h3>
          <div className="bg-elevated border border-border rounded-lg p-4">
            <ConditionsDisplay conditions={rule.conditions} />
          </div>
        </div>

        {/* Actions Section */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Actions ({rule.actions?.length || 0})
          </h3>
          <div className="space-y-2">
            {rule.actions && rule.actions.length > 0 ? (
              rule.actions.map((action, index) => (
                <div key={index} className="bg-elevated border border-border rounded-lg p-3">
                  <ActionDetailView action={action} index={index} />
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground p-3 bg-elevated border border-border rounded-lg">
                No actions configured
              </div>
            )}
          </div>
        </div>

        {/* Execution History */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <History className="w-4 h-4" />
            Recent Activity
          </h3>
          <ExecutionHistoryList history={executionHistory} />
        </div>

        {/* Test Section */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Test Rule
          </h3>
          <RuleTestSection ruleId={rule.id} onTest={setTestResult} />
          {testResult && <TestResultDisplay result={testResult} />}
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="bg-elevated text-foreground border-border hover:bg-elevated"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Supporting Components:**
```tsx
// Display action details
function ActionDetailView({ action, index }: { action: RuleAction; index: number }) {
  const getActionIcon = (type: RuleActionType) => {
    switch (type) {
      case 'set_category': return <Tag className="w-4 h-4" />;
      case 'set_merchant': return <Store className="w-4 h-4" />;
      case 'set_description': return <FileEdit className="w-4 h-4" />;
      case 'prepend_description': return <ArrowLeftToLine className="w-4 h-4" />;
      case 'append_description': return <ArrowRightToLine className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getActionDescription = (action: RuleAction): string => {
    switch (action.type) {
      case 'set_category':
        return `Set category to "${getCategoryName(action.value)}"`;
      case 'set_merchant':
        return `Set merchant to "${getMerchantName(action.value)}"`;
      case 'set_description':
        return `Replace description with: "${action.pattern}"`;
      case 'prepend_description':
        return `Add "${action.pattern}" before description`;
      case 'append_description':
        return `Add "${action.pattern}" after description`;
      default:
        return action.type;
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-[var(--color-primary)]">
        {getActionIcon(action.type)}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground mb-1">
          Action {index + 1}: {action.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </div>
        <div className="text-sm text-muted-foreground">
          {getActionDescription(action)}
        </div>
        {action.pattern && (
          <div className="mt-2 p-2 bg-background border border-border rounded text-xs font-mono">
            Pattern: {action.pattern}
          </div>
        )}
      </div>
    </div>
  );
}

// Display conditions in readable format
function ConditionsDisplay({ conditions }: { conditions: any }) {
  // Format conditions as human-readable text
  // Show logic operators (AND/OR)
  // Highlight field names, operators, values
}

// Display execution history
function ExecutionHistoryList({ history }: { history: ExecutionLog[] }) {
  if (history.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 bg-elevated border border-border rounded-lg">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {history.map((log, index) => (
        <div key={index} className="bg-elevated border border-border rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-foreground">
              Transaction: {log.transactionDescription}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(log.executedAt)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {log.appliedActions?.length || 0} action{log.appliedActions?.length !== 1 ? 's' : ''} applied
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Add "View Details" Button to RuleCard:**
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setDetailsModalOpen(true)}
  className="text-foreground hover:bg-elevated"
  title="View details"
>
  <Info className="w-4 h-4" />
</Button>
```

---

### Task 20: Update Page to Connect Everything

**File:** `app/dashboard/rules/page.tsx`

**Changes:**
1. Update rule creation/edit form to include actions
2. Pass `initialActions` to RuleBuilder when editing
3. Handle `onActionsChange` callback
4. Update API calls to send/receive actions
5. Add state management for rule details modal
6. Fetch categories and merchants for selectors

**Updated Page Structure:**
```typescript
export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsRule, setDetailsRule] = useState<Rule | null>(null);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [priority, setPriority] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [conditions, setConditions] = useState<ConditionGroup | Condition>(defaultConditions);
  const [actions, setActions] = useState<RuleAction[]>([]);  // NEW

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  // Fetch reference data
  useEffect(() => {
    fetchCategories();
    fetchMerchants();
  }, []);

  const handleCreateRule = async () => {
    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          priority,
          isActive,
          conditions: JSON.stringify(conditions),
          actions: actions,  // NEW: Send actions array
        }),
      });

      if (!response.ok) throw new Error('Failed to create rule');

      toast.success('Rule created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchRules();
    } catch (error) {
      toast.error('Failed to create rule');
    }
  };

  const handleEditRule = async () => {
    if (!editingRule) return;

    try {
      const response = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRule.id,
          name: ruleName,
          priority,
          isActive,
          conditions: JSON.stringify(conditions),
          actions: actions,  // NEW: Send actions array
        }),
      });

      if (!response.ok) throw new Error('Failed to update rule');

      toast.success('Rule updated successfully');
      setShowCreateModal(false);
      setEditingRule(null);
      resetForm();
      fetchRules();
    } catch (error) {
      toast.error('Failed to update rule');
    }
  };

  const openEditModal = (rule: Rule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setPriority(rule.priority);
    setIsActive(rule.isActive);
    setConditions(rule.conditions);
    setActions(rule.actions || []);  // NEW: Load actions
    setShowCreateModal(true);
  };

  const openDetailsModal = (rule: Rule) => {
    setDetailsRule(rule);
    setShowDetailsModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Rules Manager */}
      <RulesManager
        onCreateRule={() => setShowCreateModal(true)}
        onEditRule={openEditModal}
        onViewDetails={openDetailsModal}  // NEW
      />

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {editingRule ? 'Edit Rule' : 'Create New Rule'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Rule Name</label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Categorize Starbucks as Coffee"
                  className="bg-input border-border text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Priority</label>
                  <Input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    min={1}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">Active</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Conditions */}
            <RuleBuilder
              initialConditions={conditions}
              onConditionsChange={setConditions}
              initialActions={actions}  // NEW
              onActionsChange={setActions}  // NEW
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingRule(null);
                resetForm();
              }}
              className="bg-elevated text-foreground border-border hover:bg-elevated"
            >
              Cancel
            </Button>
            <Button
              onClick={editingRule ? handleEditRule : handleCreateRule}
              className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90"
              disabled={!ruleName || actions.length === 0}
            >
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      {detailsRule && (
        <RuleDetailsModal
          rule={detailsRule}
          open={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}
```

---

## Theme Integration Checklist

All components must use semantic color tokens:

### Colors to Use:
- **Backgrounds:** `bg-background`, `bg-card`, `bg-elevated`, `bg-input`
- **Text:** `text-foreground`, `text-muted-foreground`, `text-card-foreground`
- **Borders:** `border-border`
- **Primary:** `bg-[var(--color-primary)]`, `text-[var(--color-primary)]`, `border-[var(--color-primary)]`
- **Success:** `bg-[var(--color-success)]`, `text-[var(--color-success)]`
- **Warning:** `bg-[var(--color-warning)]`, `text-[var(--color-warning)]`
- **Error:** `bg-[var(--color-error)]`, `text-[var(--color-error)]`
- **Accent:** `bg-accent`, `text-accent-foreground`
- **Muted:** `bg-muted`, `text-muted-foreground`

### Icons:
- **Always use Lucide icons** (NOT emojis)
- Common icons for actions:
  - Set Category: `<Tag />`
  - Set Merchant: `<Store />`
  - Description: `<FileEdit />`, `<ArrowLeftToLine />`, `<ArrowRightToLine />`
  - Actions: `<Zap />`
  - Details: `<Info />`
  - Test: `<TestTube />`
  - History: `<History />`
  - Conditions: `<Filter />`

### Hover States:
- Buttons: `hover:opacity-90` for primary, `hover:bg-elevated` for ghost
- Interactive elements: `hover:border-[var(--color-primary)]/30`
- Destructive: `hover:bg-[var(--color-error)]/20`

---

## Validation & Error Handling

### Action Validation:
1. **Set Category:** Ensure category ID is valid and exists
2. **Set Merchant:** Ensure merchant ID is valid and exists
3. **Description Actions:** Ensure pattern is not empty, validate variables
4. **General:** At least one action must be configured
5. **Order:** Actions are applied in order, warn if order matters

### Error Messages:
- "At least one action is required"
- "Pattern cannot be empty"
- "Invalid pattern variable: {variable}"
- "Category not found"
- "Merchant not found"
- "Failed to save rule. Please try again."

### Form Validation:
```typescript
function validateActions(actions: RuleAction[]): string[] {
  const errors: string[] = [];

  if (actions.length === 0) {
    errors.push('At least one action is required');
  }

  actions.forEach((action, index) => {
    if (action.type === 'set_category' && !action.value) {
      errors.push(`Action ${index + 1}: Category is required`);
    }
    if (action.type === 'set_merchant' && !action.value) {
      errors.push(`Action ${index + 1}: Merchant is required`);
    }
    if (action.type.includes('description') && !action.pattern) {
      errors.push(`Action ${index + 1}: Pattern is required`);
    }
  });

  return errors;
}
```

---

## Testing Checklist

### Manual Testing:
- [ ] Create new rule with single action
- [ ] Create rule with multiple actions (2-3)
- [ ] Edit existing rule and add/remove actions
- [ ] Change action types and verify config UI updates
- [ ] Test pattern builder with all variables
- [ ] Test merchant selector search and selection
- [ ] Verify action preview in rules list
- [ ] Open rule details modal and verify all sections
- [ ] Test rule with description actions (prepend/append/set)
- [ ] Apply rule and verify actions execute correctly
- [ ] Test both themes (Dark Mode & Dark Pink)
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Verify all Lucide icons render correctly
- [ ] Test validation errors display properly
- [ ] Test backward compatibility with old rules

### Browser Testing:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

### Accessibility:
- [ ] All buttons have proper labels/titles
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader friendly

---

## Performance Considerations

1. **Lazy Loading:** Load merchants/categories once and cache
2. **Debounce:** Search input in merchant selector
3. **Memoization:** Pattern preview calculation
4. **Virtual Scrolling:** If execution history grows large
5. **Optimistic Updates:** Update UI before API response for better UX

---

## Success Criteria

Phase 1C is complete when:

- ✅ RuleBuilder component has actions section
- ✅ Pattern builder UI works with all variables
- ✅ Merchant selector allows search and selection
- ✅ Rules list shows action count and preview
- ✅ Rule details modal displays all information
- ✅ Create new rules with multiple actions
- ✅ Edit existing rules and modify actions
- ✅ Actions execute correctly when rules match
- ✅ All components use theme variables
- ✅ All icons are Lucide (no emojis)
- ✅ Responsive design works on all screen sizes
- ✅ Validation prevents invalid configurations
- ✅ Error messages are clear and helpful
- ✅ Manual testing passes all scenarios
- ✅ Both themes look correct
- ✅ Backward compatibility maintained

---

## Implementation Order

### Day 1: Core Components (Tasks 15-16)
1. ✅ Update RuleBuilder with actions section (3 hours)
2. ✅ Create PatternBuilder component (2 hours)
3. ✅ Create MerchantSelector component (2 hours)
4. ✅ Test action configuration UI (1 hour)

### Day 2: Rules List & Display (Tasks 17-18)
5. ✅ Create ActionPreview component (1 hour)
6. ✅ Update RulesManager with action badges (2 hours)
7. ✅ Update RuleCard with action display (2 hours)
8. ✅ Test rules list with multiple actions (1 hour)

### Day 3: Details Modal & Integration (Tasks 19-20)
9. ✅ Create RuleDetailsModal component (3 hours)
10. ✅ Create supporting detail components (2 hours)
11. ✅ Update rules page to connect everything (2 hours)
12. ✅ Test end-to-end flow (1 hour)

### Day 4: Testing & Polish
13. ✅ Manual testing all scenarios (2 hours)
14. ✅ Fix bugs and UI issues (3 hours)
15. ✅ Theme testing (Dark Mode & Dark Pink) (1 hour)
16. ✅ Responsive design testing (1 hour)
17. ✅ Final review and documentation (1 hour)

**Total Estimated Time:** 4 days (~28 hours)

---

## Next Steps After Completion

After Phase 1C is complete:

1. **Phase 1D:** Testing & Documentation
   - Write unit tests for UI components
   - Write integration tests
   - Create user documentation
   - Performance testing

2. **Phase 2:** Advanced Actions (Future)
   - Convert to transfer action
   - Split transaction action
   - Change account action
   - Set tax deduction action
   - Conditional actions

3. **Enhancements:** (Optional)
   - Drag-and-drop to reorder actions
   - Action templates for quick setup
   - Import/export rules
   - Rule analytics dashboard

---

## Notes

- This plan focuses on **Phase 1C only** (UI implementation)
- Backend is already complete and working
- Must maintain backward compatibility with existing rules
- All UI must use semantic color tokens (no hardcoded colors)
- Always use Lucide icons (never emojis)
- Focus on user experience and visual clarity
- Progressive disclosure: simple by default, detailed when needed

Let's build an amazing rules UI! 🚀
