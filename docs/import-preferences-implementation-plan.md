# Import Preferences Implementation Plan

## Overview
Add "Import Preferences" section to the Data Management tab allowing users to set a default CSV import template that will be pre-selected when they open the CSV import modal.

## Current State
- CSV import functionality exists with `CSVImportModal` component
- `importTemplates` table in database with templates (name, column mappings, date format, etc.)
- API endpoints exist: `/api/import-templates` (GET, POST) and `/api/import-templates/[id]` (GET, PUT, DELETE)
- No UI in settings to select default template
- No field in `userSettings` to store default template preference

## Goals
1. Add `defaultImportTemplateId` field to userSettings
2. Create UI in Data Management tab to select default import template
3. Update CSV import modal to pre-select the default template
4. Auto-save preference changes
5. Display template details (name, last used, usage count)

## Implementation Steps

### Phase 1: Database Schema (15 minutes)
1. Add `defaultImportTemplateId` field to `userSettings` table in `lib/db/schema.ts`
2. Create migration file `0041_add_default_import_template.sql`
3. Apply migration to database

```sql
ALTER TABLE `user_settings` ADD COLUMN `default_import_template_id` TEXT;
```

### Phase 2: API Updates (30 minutes)
1. Update `/api/user/settings` GET endpoint to return `defaultImportTemplateId`
2. Update `/api/user/settings` POST endpoint to accept `defaultImportTemplateId`
3. Add validation to ensure template belongs to user before setting as default

### Phase 3: Data Management Tab UI (45 minutes)
1. Update `components/settings/data-tab.tsx`:
   - Add state for `defaultImportTemplateId`
   - Fetch user's import templates from `/api/import-templates`
   - Add new section "Import Preferences" with:
     - Select dropdown to choose default template
     - Display template details (name, last used date, usage count)
     - "Manage Templates" button linking to import modal or templates page
     - Auto-save on selection change
   - Use semantic theme variables for all styling

### Phase 4: CSV Import Modal Integration (30 minutes)
1. Update `components/csv-import/csv-import-modal.tsx`:
   - Accept `defaultTemplateId` prop (optional)
   - Pre-select default template when modal opens
   - Fall back to no selection if no default or if default not found

### Phase 5: Transactions Page Integration (15 minutes)
1. Update `app/dashboard/transactions/page.tsx`:
   - Fetch user settings to get `defaultImportTemplateId`
   - Pass `defaultTemplateId` to `CSVImportModal`

### Phase 6: Testing (30 minutes)
1. Test setting default template in Data Management tab
2. Test CSV import modal pre-selects default template
3. Test changing default template updates modal behavior
4. Test removing default template (set to null)
5. Test with user who has no templates (graceful handling)
6. Test with user who has templates but no default set

### Phase 7: Documentation (15 minutes)
1. Update `docs/features.md` to mark "Import preferences" as complete
2. Add comments explaining the feature in code

## Implementation Details

### Database Schema Update
```typescript
// In lib/db/schema.ts - userSettings table
export const userSettings = sqliteTable(
  'user_settings',
  {
    // ... existing fields ...
    defaultImportTemplateId: text('default_import_template_id'), // NEW
  }
);
```

### UI Component Structure (Data Management Tab)
```typescript
// New section in components/settings/data-tab.tsx

<div>
  <h3 className="text-lg font-semibold text-foreground mb-2">
    Import Preferences
  </h3>
  <p className="text-sm text-muted-foreground mb-4">
    Set your default CSV import template for faster imports
  </p>

  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="defaultTemplate" className="text-foreground">
        Default Import Template
      </Label>
      <Select
        value={defaultImportTemplateId || 'none'}
        onValueChange={handleTemplateChange}
        disabled={loadingTemplates || savingTemplate}
      >
        <SelectTrigger
          id="defaultTemplate"
          name="defaultTemplate"
          aria-label="Select default import template"
          className="bg-background border-border text-foreground"
        >
          <SelectValue placeholder="No default template" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          <SelectItem value="none" className="text-foreground hover:bg-elevated">
            No default template
          </SelectItem>
          {importTemplates.map((template) => (
            <SelectItem
              key={template.id}
              value={template.id}
              className="text-foreground hover:bg-elevated"
            >
              {template.name}
              {template.usageCount > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({template.usageCount} uses)
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        The selected template will be pre-selected when you import CSV files
      </p>
    </div>

    {/* Display selected template details */}
    {selectedTemplate && (
      <Card className="p-4 bg-elevated border-border">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedTemplate.name}
            </span>
            {selectedTemplate.isFavorite && (
              <Badge variant="secondary" className="bg-[var(--color-primary)] text-white">
                Favorite
              </Badge>
            )}
          </div>
          {selectedTemplate.description && (
            <p className="text-xs text-muted-foreground">
              {selectedTemplate.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {selectedTemplate.lastUsedAt && (
              <span>
                Last used: {new Date(selectedTemplate.lastUsedAt).toLocaleDateString()}
              </span>
            )}
            <span>Used {selectedTemplate.usageCount} times</span>
          </div>
        </div>
      </Card>
    )}

    {/* No templates message */}
    {importTemplates.length === 0 && (
      <Card className="p-4 bg-elevated border-border text-center">
        <p className="text-sm text-muted-foreground mb-3">
          You don't have any import templates yet
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={openImportModal}
          className="border-border"
        >
          Create Your First Template
        </Button>
      </Card>
    )}
  </div>
</div>
```

### API Endpoint Updates
```typescript
// In /app/api/user/settings/route.ts

// GET endpoint - add defaultImportTemplateId to response
return NextResponse.json({
  settings: {
    // ... existing fields ...
    defaultImportTemplateId: settings.defaultImportTemplateId,
  },
});

// POST endpoint - handle defaultImportTemplateId
const { defaultImportTemplateId, ...otherSettings } = await request.json();

// Validate template belongs to user if setting default
if (defaultImportTemplateId) {
  const template = await db.query.importTemplates.findFirst({
    where: and(
      eq(importTemplates.id, defaultImportTemplateId),
      eq(importTemplates.userId, user.id)
    ),
  });

  if (!template) {
    return NextResponse.json(
      { error: 'Template not found or does not belong to you' },
      { status: 404 }
    );
  }
}

await db.update(userSettings)
  .set({
    // ... other fields ...
    defaultImportTemplateId,
  })
  .where(eq(userSettings.userId, user.id));
```

### CSV Import Modal Updates
```typescript
// Update CSVImportModal props
interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTemplateId?: string; // NEW
}

// In component, pre-select template if provided
useEffect(() => {
  if (defaultTemplateId && templates.length > 0) {
    const defaultTemplate = templates.find(t => t.id === defaultTemplateId);
    if (defaultTemplate) {
      setSelectedTemplate(defaultTemplate);
    }
  }
}, [defaultTemplateId, templates]);
```

## User Experience Flow

1. **User goes to Settings → Data Management**
2. **Sees "Import Preferences" section**
3. **Clicks dropdown to see their import templates**
4. **Selects a template (e.g., "Chase Credit Card")**
5. **Template details display below (last used, usage count)**
6. **Setting auto-saves with success toast**
7. **User goes to Transactions page**
8. **Clicks "Import CSV" button**
9. **Modal opens with "Chase Credit Card" template already selected**
10. **User can proceed with import or change template**

## Benefits

1. **Faster Workflow:** Regular importers save time by not selecting template each time
2. **User-Friendly:** One-click setup for their most common import source
3. **Discoverable:** Exposes import templates feature in settings
4. **Flexible:** Users can still change template in modal if needed
5. **Non-Breaking:** Existing users without default continue normal workflow

## Edge Cases & Handling

1. **User has no templates:** Show message + button to create first template
2. **Default template deleted:** Modal opens with no pre-selection, settings show "none"
3. **User sets "none" as default:** Clear the preference, modal opens with no pre-selection
4. **Template belongs to another user:** Validation prevents setting, returns error
5. **User in different household:** Template selection filtered by user/household ownership

## Estimated Time
- Phase 1: Database Schema - 15 minutes
- Phase 2: API Updates - 30 minutes
- Phase 3: Data Management Tab UI - 45 minutes
- Phase 4: CSV Import Modal Integration - 30 minutes
- Phase 5: Transactions Page Integration - 15 minutes
- Phase 6: Testing - 30 minutes
- Phase 7: Documentation - 15 minutes

**Total: ~3 hours**

## Success Criteria
1. ✅ User can select default import template in Data Management tab
2. ✅ Template details display correctly
3. ✅ CSV import modal pre-selects default template
4. ✅ Setting auto-saves with toast notification
5. ✅ Works with users who have no templates
6. ✅ All styling uses semantic theme variables
7. ✅ No breaking changes to existing import flow
