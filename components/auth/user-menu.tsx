'use client';

import { betterAuthClient } from '@/lib/better-auth-client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Settings, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = betterAuthClient.useSession();
  // State to track both URL and fetched status
  const [avatarState, setAvatarState] = useState<{ url: string | null; fetched: boolean }>({ 
    url: null, 
    fetched: false 
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track fetch status with ref to avoid re-triggering effect
  const fetchingRef = useRef(false);
  
  // Fetch avatar URL when session is available
  useEffect(() => {
    if (session?.user?.id && !avatarState.fetched && !fetchingRef.current) {
      // Mark as fetching to prevent duplicate requests
      fetchingRef.current = true;
      
      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController();
      
      fetch('/api/profile/avatar', { 
        credentials: 'include',
        signal: abortControllerRef.current.signal
      })
        .then(res => res.json())
        .then(data => {
          setAvatarState({ url: data.avatarUrl || null, fetched: true });
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setAvatarState({ url: null, fetched: true });
          }
        });
    }
    
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [session?.user?.id, avatarState.fetched]);

  const avatarUrl = avatarState.url;
  // Show loading while session is pending
  const avatarLoading = isPending;

  const handleSignOut = async () => {
    try {
      await betterAuthClient.signOut();
      toast.success('Signed out successfully');
      router.push('/sign-in');
      router.refresh();
    } catch (_error) {
      toast.error('Failed to sign out');
    }
  };

  if (isPending || avatarLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-elevated animate-pulse" />
    );
  }

  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8 hover:bg-elevated p-0"
        >
          <UserAvatar
            userId={session.user.id}
            userName={session.user.name || session.user.email}
            avatarUrl={avatarUrl}
            size="sm"
            showRing={false}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-card border-border"
      >
        <DropdownMenuLabel className="text-foreground">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {session.user.name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground leading-none">
              {session.user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={() => router.push('/dashboard/settings?tab=profile')}
          className="text-foreground hover:bg-elevated cursor-pointer"
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-(--color-error) hover:bg-elevated cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
