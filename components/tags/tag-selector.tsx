'use client';

import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface TagSelectorProps {
  transactionId: string;
  selectedTagIds?: string[];
  onTagsChange?: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({
  transactionId,
  selectedTagIds = [],
  onTagsChange,
  disabled = false,
}: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(selectedTagIds);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tags?sortBy=usage&limit=100', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch tags');

      const data = await response.json();
      setAllTags(data.data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (selectedTags.includes(tagId)) return;

    try {
      const response = await fetch('/api/transaction-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          tagId,
        }),
      });

      if (!response.ok) throw new Error('Failed to add tag');

      const newSelectedTags = [...selectedTags, tagId];
      setSelectedTags(newSelectedTags);
      onTagsChange?.(newSelectedTags);
      toast.success('Tag added');
    } catch (error) {
      console.error('Error adding tag:', error);
      toast.error('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const response = await fetch('/api/transaction-tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          tagId,
        }),
      });

      if (!response.ok) throw new Error('Failed to remove tag');

      const newSelectedTags = selectedTags.filter((id) => id !== tagId);
      setSelectedTags(newSelectedTags);
      onTagsChange?.(newSelectedTags);
      toast.success('Tag removed');
    } catch (error) {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
    }
  };

  const selectedTagObjects = allTags.filter((tag) =>
    selectedTags.includes(tag.id)
  );
  const availableTags = allTags.filter(
    (tag) => !selectedTags.includes(tag.id)
  );

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTagObjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagObjects.map((tag) => (
            <Badge
              key={tag.id}
              className="text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                disabled={disabled}
                className="ml-1 hover:opacity-70 disabled:opacity-50"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Selector Dropdown */}
      <div className="relative">
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || loading}
          className="border-[#2a2a2a] text-gray-400 hover:text-white w-full justify-start"
        >
          <Plus className="w-4 h-4 mr-2" />
          {selectedTags.length > 0 ? 'Add more tags' : 'Add tags'}
        </Button>

        {isOpen && availableTags.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  handleAddTag(tag.id);
                  if (availableTags.length === 1) {
                    setIsOpen(false);
                  }
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#242424] transition-colors flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: tag.color }}
                />
                <div className="flex-1">
                  <p className="text-sm text-white">{tag.name}</p>
                  {tag.description && (
                    <p className="text-xs text-gray-500">{tag.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500">{tag.usageCount}</span>
              </button>
            ))}
          </div>
        )}

        {isOpen && availableTags.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-center text-gray-500 text-sm">
            All tags are already added
          </div>
        )}
      </div>
    </div>
  );
}
