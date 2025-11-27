'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CustomField {
  id: string;
  userId: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email';
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  options?: string[] | null;
  defaultValue?: string;
  placeholder?: string;
  validationPattern?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', description: 'Single line text' },
  { value: 'number', label: 'Number', description: 'Decimal number' },
  { value: 'date', label: 'Date', description: 'Date picker' },
  { value: 'email', label: 'Email', description: 'Email address' },
  { value: 'url', label: 'URL', description: 'Web link' },
  { value: 'select', label: 'Dropdown', description: 'Single selection' },
  { value: 'multiselect', label: 'Multi-select', description: 'Multiple selection' },
  { value: 'checkbox', label: 'Checkbox', description: 'True/false' },
];

export function CustomFieldManager() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomField['type']>('text');
  const [newFieldDescription, setNewFieldDescription] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');

  // Edit state
  const [_editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/custom-fields?activeOnly=false&limit=100', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch fields');

      const data = await response.json();
      setFields(data.data || []);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      toast.error('Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateField = async () => {
    if (!newFieldName.trim()) {
      toast.error('Field name is required');
      return;
    }

    try {
      const body: any = {
        name: newFieldName.trim(),
        type: newFieldType,
        description: newFieldDescription,
        isRequired: newFieldRequired,
        placeholder: newFieldPlaceholder,
      };

      if (
        (newFieldType === 'select' || newFieldType === 'multiselect') &&
        newFieldOptions.trim()
      ) {
        body.options = newFieldOptions.split('\n').map((o) => o.trim()).filter(Boolean);
      }

      const response = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create field');
      }

      const newField = await response.json();
      setFields([...fields, newField]);
      setShowForm(false);
      resetForm();
      toast.success('Custom field created');
    } catch (error) {
      console.error('Error creating field:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create field');
    }
  };

  const handleToggleActive = async (fieldId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/custom-fields/${fieldId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (!response.ok) throw new Error('Failed to update field');

      const updated = await response.json();
      setFields(fields.map((f) => (f.id === fieldId ? updated : f)));
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Failed to update field');
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/custom-fields/${fieldId}`, { credentials: 'include', method: 'DELETE', });

      if (!response.ok) throw new Error('Failed to delete field');

      setFields(fields.filter((f) => f.id !== fieldId));
      toast.success('Custom field deleted');
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error('Failed to delete field');
    }
  };

  const resetForm = () => {
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldDescription('');
    setNewFieldRequired(false);
    setNewFieldOptions('');
    setNewFieldPlaceholder('');
    setEditingId(null);
  };

  const typeInfo = FIELD_TYPES.find((t) => t.value === newFieldType);

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle>Custom Fields</CardTitle>
          <CardDescription className="text-gray-500">
            Create custom fields to add extra information to your transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showForm ? (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Field
            </Button>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="field-name" className="text-gray-400 block mb-2">
                  Field Name
                </Label>
                <Input
                  id="field-name"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="e.g., Project, Invoice Number, Client"
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                />
              </div>

              <div>
                <Label htmlFor="field-type" className="text-gray-400 block mb-2">
                  Field Type
                </Label>
                <select
                  id="field-type"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as CustomField['type'])}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded px-3 py-2"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {typeInfo && (
                  <p className="text-xs text-gray-500 mt-1">{typeInfo.description}</p>
                )}
              </div>

              <div>
                <Label htmlFor="field-description" className="text-gray-400 block mb-2">
                  Description (Optional)
                </Label>
                <Input
                  id="field-description"
                  value={newFieldDescription}
                  onChange={(e) => setNewFieldDescription(e.target.value)}
                  placeholder="What is this field for?"
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                />
              </div>

              {(newFieldType === 'select' || newFieldType === 'multiselect') && (
                <div>
                  <Label htmlFor="field-options" className="text-gray-400 block mb-2">
                    Options (One per line)
                  </Label>
                  <textarea
                    id="field-options"
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    rows={4}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded px-3 py-2 resize-none"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="field-placeholder" className="text-gray-400 block mb-2">
                  Placeholder (Optional)
                </Label>
                <Input
                  id="field-placeholder"
                  value={newFieldPlaceholder}
                  onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                  placeholder="e.g., Enter a value..."
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="field-required" className="text-gray-400">
                  Required field
                </Label>
                <Switch
                  id="field-required"
                  checked={newFieldRequired}
                  onCheckedChange={setNewFieldRequired}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateField}
                  className="bg-blue-600 hover:bg-blue-700 flex-1"
                >
                  Create Field
                </Button>
                <Button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  variant="outline"
                  className="border-[#2a2a2a] text-gray-400 flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fields List */}
      <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle>Fields ({fields.length})</CardTitle>
          <CardDescription className="text-gray-500">
            Manage your custom fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <div className="h-8 w-8 border-4 border-[#2a2a2a] border-t-blue-600 rounded-full" />
              </div>
            </div>
          ) : fields.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No custom fields yet. Create your first field above!
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-white">{field.name}</p>
                      <Badge variant="outline" className="border-[#2a2a2a] text-gray-400 text-xs">
                        {field.type}
                      </Badge>
                      {field.isRequired && (
                        <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    {field.description && (
                      <p className="text-xs text-gray-500">{field.description}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      Used {field.usageCount} time{field.usageCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(field.id, field.isActive)}
                      className="text-gray-400 hover:text-white"
                      title={field.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {field.isActive ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteField(field.id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
