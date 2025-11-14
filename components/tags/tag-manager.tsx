'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  description?: string;
  icon?: string;
  usageCount: number;
  lastUsedAt?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tags?sortBy=usage&limit=100', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch tags');

      const data = await response.json();
      setTags(data.data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast.error('Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
          description: newTagDescription,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tag');
      }

      const newTag = await response.json();
      setTags([newTag, ...tags]);
      setNewTagName('');
      setNewTagColor('#6366f1');
      setNewTagDescription('');
      toast.success('Tag created successfully');
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    }
  };

  const handleUpdateTag = async (tagId: string) => {
    if (!editName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          color: editColor,
          description: editDescription,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tag');
      }

      const updated = await response.json();
      setTags(tags.map((t) => (t.id === tagId ? updated : t)));
      setEditingId(null);
      setEditName('');
      setEditColor('');
      setEditDescription('');
      toast.success('Tag updated successfully');
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;

    try {
      const response = await fetch(`/api/tags/${tagId}`, { credentials: 'include', method: 'DELETE', });

      if (!response.ok) throw new Error('Failed to delete tag');

      setTags(tags.filter((t) => t.id !== tagId));
      toast.success('Tag deleted successfully');
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('Failed to delete tag');
    }
  };

  const colorPresets = [
    '#6366f1', // indigo
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#8b5cf6', // violet
  ];

  return (
    <div className="space-y-6">
      {/* Create New Tag */}
      <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle>Create New Tag</CardTitle>
          <CardDescription className="text-gray-500">
            Create a new tag to organize your transactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tag-name" className="text-gray-400 block mb-2">
              Tag Name
            </Label>
            <Input
              id="tag-name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g., Business, Groceries, Subscription"
              className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            />
          </div>

          <div>
            <Label htmlFor="tag-description" className="text-gray-400 block mb-2">
              Description (Optional)
            </Label>
            <Input
              id="tag-description"
              value={newTagDescription}
              onChange={(e) => setNewTagDescription(e.target.value)}
              placeholder="What is this tag for?"
              className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
            />
          </div>

          <div>
            <Label className="text-gray-400 block mb-2">Color</Label>
            <div className="flex gap-2">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    newTagColor === color ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleCreateTag}
            className="bg-blue-600 hover:bg-blue-700 w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Tag
          </Button>
        </CardContent>
      </Card>

      {/* Tags List */}
      <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle>Tags ({tags.length})</CardTitle>
          <CardDescription className="text-gray-500">
            Manage your existing tags
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <div className="h-8 w-8 border-4 border-[#2a2a2a] border-t-blue-600 rounded-full" />
              </div>
            </div>
          ) : tags.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No tags yet. Create your first tag above!</p>
          ) : (
            <div className="space-y-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors"
                >
                  {editingId === tag.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-[#0a0a0a] border-[#2a2a2a] text-white text-sm"
                        placeholder="Tag name"
                      />
                      <div className="flex gap-2">
                        {colorPresets.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`w-6 h-6 rounded border-2 transition-all ${
                              editColor === color ? 'border-white' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateTag(tag.id)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="border-[#2a2a2a] text-gray-400"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: tag.color }}
                        />
                        <div>
                          <p className="font-medium text-white">{tag.name}</p>
                          {tag.description && (
                            <p className="text-xs text-gray-500">{tag.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-[#2a2a2a] text-gray-400">
                          {tag.usageCount} use{tag.usageCount !== 1 ? 's' : ''}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(tag.id);
                            setEditName(tag.name);
                            setEditColor(tag.color);
                            setEditDescription(tag.description || '');
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteTag(tag.id)}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
