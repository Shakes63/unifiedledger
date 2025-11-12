'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Reusable container for all chart components
 * Provides consistent styling, loading states, and error handling
 */
export function ChartContainer({
  title,
  description,
  children,
  isLoading,
  error,
  className = '',
}: ChartContainerProps) {
  return (
    <Card className={`w-full overflow-hidden ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {error ? (
          <div className="flex items-center justify-center h-80">
            <div className="text-center">
              <p className="text-red-400 font-medium">Error loading chart</p>
              <p className="text-sm text-gray-500 mt-1">{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading chart...</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-80 overflow-x-auto" style={{ height: '320px' }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
