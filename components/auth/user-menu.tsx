'use client';

import { betterAuthClient } from '@/lib/better-auth-client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);

  // Fetch avatar URL when session is available
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/profile/avatar')
        .then(res => res.json())
        .then(data => setAvatarUrl(data.avatarUrl || null))
        .catch(() => setAvatarUrl(null))
        .finally(() => setAvatarLoading(false));
    } else {
      setAvatarLoading(false);
    }
  }, [session?.user?.id]);

  const handleSignOut = async () => {
    try {
      await betterAuthClient.signOut();
      toast.success('Signed out successfully');
      router.push('/sign-in');
      router.refresh();
    } catch (error) {
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
          className="text-[var(--color-error)] hover:bg-elevated cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
