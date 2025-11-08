'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Save, Trash2, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: Record<string, any>;
  isDefault: boolean;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface SavedSearchesProps {
  currentFilters: Record<string, any>;
  onLoadSearch: (filters: Record<string, any>) => void;
  isLoading?: boolean;
}

export function SavedSearches({
  currentFilters,
  onLoadSearch,
  isLoading = false,
}: SavedSearchesProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaves, setIsLoadingSaves] = useState(false);
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null);

  // Fetch saved searches on mount
  useEffect(() => {
    fetchSavedSearches();
  }, []);

  const fetchSavedSearches = async () => {
    try {
      setIsLoadingSaves(true);
      const response = await fetch('/api/saved-searches?limit=20&sortBy=lastUsedAt');
      if (response.ok) {
        const data = await response.json();
        setSavedSearches(data.searches);
      }
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      toast.error('Failed to load saved searches');
    } finally {
      setIsLoadingSaves(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!searchName.trim()) {
      toast.error('Please enter a search name');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchName,
          description: searchDescription,
          filters: currentFilters,
          isDefault: false,
        }),
      });

      if (response.ok) {
        toast.success(`Saved search "${searchName}" created`);
        setSearchName('');
        setSearchDescription('');
        setIsOpen(false);
        fetchSavedSearches();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save search');
      }
    } catch (error) {
      console.error('Error saving search:', error);
      toast.error('Failed to save search');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSearch = async (search: SavedSearch) => {
    try {
      // Increment usage count
      await fetch(`/api/saved-searches/${search.id}`, {
        method: 'POST',
      });

      onLoadSearch(search.filters);
      toast.success(`Loaded "${search.name}"`);
      fetchSavedSearches();
    } catch (error) {
      console.error('Error loading search:', error);
      toast.error('Failed to load search');
    }
  };

  const handleDeleteSearch = async (searchId: string, searchName: string) => {
    if (!confirm(`Delete "${searchName}"?`)) return;

    try {
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Saved search deleted');
        fetchSavedSearches();
      } else {
        toast.error('Failed to delete search');
      }
    } catch (error) {
      console.error('Error deleting search:', error);
      toast.error('Failed to delete search');
    }
  };

  const handleSetDefault = async (searchId: string) => {
    try {
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (response.ok) {
        toast.success('Default search updated');
        fetchSavedSearches();
      } else {
        toast.error('Failed to update default search');
      }
    } catch (error) {
      console.error('Error updating default search:', error);
      toast.error('Failed to update default search');
    }
  };

  return (
    <div className="space-y-4">
      {/* Save Current Search Button */}
      <Button
        onClick={() => setIsOpen(true)}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 flex items-center gap-2 justify-center"
      >
        <Save className="w-4 h-4" />
        Save This Search
      </Button>

      {/* Save Search Dialog */}
      {isOpen && (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="searchName" className="text-white">
              Search Name
            </Label>
            <Input
              id="searchName"
              placeholder="e.g., Monthly Expenses, Recent Transfers..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="bg-[#242424] border-[#2a2a2a] text-white placeholder-[#6b7280]"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="searchDescription" className="text-white">
              Description (Optional)
            </Label>
            <Input
              id="searchDescription"
              placeholder="Add notes about this search..."
              value={searchDescription}
              onChange={(e) => setSearchDescription(e.target.value)}
              className="bg-[#242424] border-[#2a2a2a] text-white placeholder-[#6b7280]"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveSearch}
              disabled={isSaving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              className="flex-1 border-[#2a2a2a] text-[#9ca3af] hover:bg-[#242424]"
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Saved Searches List */}
      {savedSearches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Saved Searches ({savedSearches.length})
            </h3>
            <Button
              onClick={() => setIsLoadingSaves(!isLoadingSaves)}
              variant="ghost"
              size="sm"
              className="text-xs text-[#9ca3af] hover:text-white"
            >
              {isLoadingSaves ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {isLoadingSaves ? (
            <div className="text-center py-4 text-[#6b7280] text-sm">
              Loading saved searches...
            </div>
          ) : (
            <div className="space-y-2">
              {savedSearches.map((search) => (
                <Card
                  key={search.id}
                  className="bg-[#242424] border-[#2a2a2a] p-3 hover:bg-[#2a2a2a] transition-colors"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedSearch(
                        expandedSearch === search.id ? null : search.id
                      )
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white truncate">
                            {search.name}
                          </h4>
                          {search.isDefault && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 text-xs flex-shrink-0">
                              Default
                            </Badge>
                          )}
                        </div>
                        {search.description && (
                          <p className="text-xs text-[#6b7280] truncate mt-1">
                            {search.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-[#9ca3af]">
                          {search.usageCount > 0 && (
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Used {search.usageCount} time
                              {search.usageCount !== 1 ? 's' : ''}
                            </div>
                          )}
                          {search.lastUsedAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(search.lastUsedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSearch(search);
                          }}
                          disabled={isLoading}
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white text-xs"
                        >
                          Load
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSearch(search.id, search.name);
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedSearch === search.id && (
                    <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-2">
                      <div className="text-xs">
                        <p className="text-[#6b7280] mb-1">Active Filters:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(search.filters).map(([key, value]) => {
                            if (
                              value === undefined ||
                              value === null ||
                              (Array.isArray(value) && value.length === 0)
                            )
                              return null;
                            return (
                              <Badge
                                key={key}
                                className="bg-[#1a1a1a] text-[#9ca3af] text-xs"
                              >
                                {key}: {Array.isArray(value) ? value.length : String(value).substring(0, 20)}
                              </Badge>
                            );
                          })}
                          {Object.values(search.filters).every(
                            (v) =>
                              v === undefined ||
                              v === null ||
                              (Array.isArray(v) && v.length === 0)
                          ) && <span className="text-[#6b7280]">No filters</span>}
                        </div>
                      </div>
                      {!search.isDefault && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(search.id);
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full text-xs border-[#2a2a2a] text-[#9ca3af] hover:bg-[#1a1a1a]"
                        >
                          Set as Default
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
