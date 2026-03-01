'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Code, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDeveloperMode } from '@/contexts/developer-mode-context';
import { useHousehold } from '@/contexts/household-context';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { betterAuthClient } from '@/lib/better-auth-client';

export function DeveloperToolsPanel() {
  const { isDeveloperMode } = useDeveloperMode();
  const { selectedHousehold } = useHousehold();
  const { data: session } = betterAuthClient.useSession();
  const user = session?.user;
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if developer mode is off
  if (!isDeveloperMode) return null;

  const handleExportDebugData = () => {
    const debugData = {
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
      },
      household: {
        id: selectedHousehold?.id,
        name: selectedHousehold?.name,
      },
      route: pathname,
      timestamp: new Date().toISOString(),
      localStorage: typeof window !== 'undefined' ? { ...localStorage } : {},
      sessionStorage: typeof window !== 'undefined' ? { ...sessionStorage } : {},
    };

    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Debug data exported');
  };

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      toast.success('Cache cleared - Page will reload');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {isExpanded ? (
        <Card className="w-96 max-h-[600px] overflow-hidden shadow-lg border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--color-foreground)' }}>Developer Tools</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-7 w-7 p-0"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[500px] space-y-4">
            {/* User Info */}
            <div>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-muted-foreground)' }}>User Info</h4>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--color-muted-foreground)' }}>ID:</span>
                  <span className="truncate max-w-[200px]" style={{ color: 'var(--color-foreground)' }} title={user?.id}>
                    {user?.id ? `${user.id.slice(0, 8)}...${user.id.slice(-4)}` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Email:</span>
                  <span className="truncate max-w-[200px]" style={{ color: 'var(--color-foreground)' }} title={user?.email}>
                    {user?.email || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Household Info */}
            <div>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Household Info</h4>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--color-muted-foreground)' }}>ID:</span>
                  <span className="truncate max-w-[200px]" style={{ color: 'var(--color-foreground)' }} title={selectedHousehold?.id}>
                    {selectedHousehold?.id ? `${selectedHousehold.id.slice(0, 8)}...${selectedHousehold.id.slice(-4)}` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Name:</span>
                  <span className="truncate max-w-[200px]" style={{ color: 'var(--color-foreground)' }} title={selectedHousehold?.name}>
                    {selectedHousehold?.name || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Navigation</h4>
              <div className="text-xs font-mono break-all p-2 rounded border" style={{ color: 'var(--color-foreground)', backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                {pathname}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDebugData}
                className="w-full justify-start text-xs"
              >
                <Download className="w-3 h-3 mr-2" />
                Export Debug Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                className="w-full justify-start text-xs"
                style={{ color: 'var(--color-destructive)' }}
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Clear Cache
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="h-9 px-3 shadow-lg border"
          style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
        >
          <Code className="w-4 h-4 mr-2" style={{ color: 'var(--color-primary)' }} />
          <span className="text-xs font-semibold">Dev Tools</span>
          <ChevronUp className="w-3 h-3 ml-2" />
        </Button>
      )}
    </div>
  );
}
