'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { HistoryIcon } from 'lucide-react';

interface Suggestion {
  type: 'merchant' | 'category' | 'amount';
  value: string;
  label: string;
  frequency: number;
  averageAmount?: number;
}

interface MerchantAutocompleteProps {
  value: string;
  onChange: (value: string, suggestion?: Suggestion) => void;
  placeholder?: string;
}

export function MerchantAutocomplete({
  value,
  onChange,
  placeholder = 'Description (or start typing for suggestions)',
}: MerchantAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/suggestions?q=${encodeURIComponent(value)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.label, suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-elevated border border-border rounded-lg shadow-lg z-50"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-muted border-b border-border last:border-b-0 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2 flex-1">
                <HistoryIcon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {suggestion.label}
                  </p>
                  {suggestion.averageAmount && (
                    <p className="text-xs text-muted-foreground">
                      Avg: ${suggestion.averageAmount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {suggestion.frequency}x
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
