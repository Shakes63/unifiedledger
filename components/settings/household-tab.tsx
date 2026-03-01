'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, UserPlus, LogOut, Crown, Shield, Eye, Loader2, Trash2, Copy, Check, Edit, Plus, Star, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useHousehold } from '@/contexts/household-context';
import { PermissionManager } from './permission-manager';

interface HouseholdMember {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userAvatarUrl?: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  isActive: boolean;
}

interface HouseholdInvitation {
  id: string;
  invitedEmail: string;
  role: string;
  invitationToken: string;
  expiresAt: string;
  status: string;
}

interface _Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  joinedAt: string;
  isFavorite: boolean;
}

export function HouseholdTab() {
  const { households, selectedHouseholdId, setSelectedHouseholdId: _setSelectedHouseholdId, loading, refreshHouseholds } = useHousehold();
  const [activeTab, setActiveTab] = useState<string>('');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [householdName, setHouseholdName] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [permissionManagerOpen, setPermissionManagerOpen] = useState(false);
  const [selectedMemberForPermissions, setSelectedMemberForPermissions] = useState<{
    id: string;
    name: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
  } | null>(null);

  // Initialize active tab on mount to the currently selected household
  // After initial mount, activeTab is independent from selectedHouseholdId
  useEffect(() => {
    if (households.length > 0 && !activeTab) {
      const initialTab = selectedHouseholdId || households[0].id;
      setActiveTab(initialTab);
    }
  }, [households, activeTab, selectedHouseholdId]);

  const fetchHouseholdDetails = useCallback(async (householdId: string) => {
    try {
      // Fetch members, invitations, and permissions in parallel
      const [membersResponse, invitationsResponse, permissionsResponse] = await Promise.all([
        fetch(`/api/households/${householdId}/members`, { credentials: 'include' }),
        fetch(`/api/households/${householdId}/invitations`, { credentials: 'include' }),
        fetch(`/api/households/${householdId}/permissions`, { credentials: 'include' }),
      ]);

      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData);

        // Find current user's role from the members list
        const household = households.find(h => h.id === householdId);
        if (household) {
          const currentMember = membersData.find((m: HouseholdMember) =>
            m.userId === household.createdBy
          );
          if (currentMember) {
            setCurrentUserRole(currentMember.role);
          }
        }
      }

      if (invitationsResponse.ok) {
        setInvitations(await invitationsResponse.json());
      }

      if (permissionsResponse.ok) {
        setUserPermissions(await permissionsResponse.json());
      }
    } catch (_error) {
      toast.error('Failed to load household details');
    }
  }, [households]);

  // Fetch household details when active tab changes
  useEffect(() => {
    if (activeTab && activeTab !== 'create-new') {
      fetchHouseholdDetails(activeTab);
    }
  }, [activeTab, fetchHouseholdDetails]);

  // Fetch member counts for all households
  useEffect(() => {
    async function fetchMemberCounts() {
      const counts: Record<string, number> = {};
      await Promise.all(
        households.map(async (household) => {
          try {
            const response = await fetch(`/api/households/${household.id}/members`, { credentials: 'include' });
            if (response.ok) {
              const membersData = await response.json();
              counts[household.id] = membersData.length;
            }
          } catch (_error) {
            // Silently fail for member counts
          }
        })
      );
      setMemberCounts(counts);
    }

    if (households.length > 0) {
      fetchMemberCounts();
    }
  }, [households]);

  async function createHousehold() {
    const trimmedName = householdName.trim();
    if (!trimmedName) {
      toast.error('Household name is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmedName }),
      });

      if (response.ok) {
        const newHousehold = await response.json();
        toast.success('Household created successfully');
        setCreateDialogOpen(false);
        setHouseholdName('');
        // Refresh households and view the new one in settings
        await refreshHouseholds();
        setActiveTab(newHousehold.id);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create household');
      }
    } catch (_error) {
      toast.error('Failed to create household');
    } finally {
      setSubmitting(false);
    }
  }

  async function inviteMember() {
    if (!inviteEmail.trim() || !activeTab || activeTab === 'create-new') {
      toast.error('Email is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${activeTab}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          invitedEmail: inviteEmail,
          role: inviteRole,
        }),
      });

      if (response.ok) {
        toast.success('Invitation sent successfully');
        setInviteDialogOpen(false);
        setInviteEmail('');
        setInviteRole('member');
        fetchHouseholdDetails(activeTab); // Refresh
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to send invitation');
      }
    } catch (_error) {
      toast.error('Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveHousehold() {
    if (!activeTab || activeTab === 'create-new') return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${activeTab}/leave`, { credentials: 'include', method: 'POST', });

      if (response.ok) {
        toast.success('Left household successfully');
        setLeaveDialogOpen(false);
        // Refresh households and switch settings view to next available
        const leavingHouseholdId = activeTab;
        await refreshHouseholds();

        // Switch settings view to first remaining household or create-new tab
        const remainingHouseholds = households.filter(h => h.id !== leavingHouseholdId);
        if (remainingHouseholds.length > 0) {
          setActiveTab(remainingHouseholds[0].id);
        } else {
          setActiveTab('create-new');
        }

        setMembers([]);
        setInvitations([]);
        setCurrentUserRole(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to leave household');
      }
    } catch (_error) {
      toast.error('Failed to leave household');
    } finally {
      setSubmitting(false);
    }
  }

  async function renameHousehold() {
    if (!activeTab || activeTab === 'create-new') return;

    if (!newHouseholdName.trim()) {
      toast.error('Household name is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHouseholdName }),
      });

      if (response.ok) {
        toast.success('Household renamed successfully');
        // Refresh households to show updated name
        await refreshHouseholds();
        setRenameDialogOpen(false);
        setNewHouseholdName('');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to rename household');
      }
    } catch (_error) {
      toast.error('Failed to rename household');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteHousehold() {
    if (!activeTab || activeTab === 'create-new') return;

    const household = households.find(h => h.id === activeTab);
    if (!household) return;

    if (deleteConfirmName !== household.name) {
      toast.error('Household name does not match');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${activeTab}`, { credentials: 'include', method: 'DELETE', });

      if (response.ok) {
        toast.success('Household deleted successfully');
        setDeleteDialogOpen(false);
        setDeleteConfirmName('');
        // Refresh households and switch settings view to next available
        const deletedHouseholdId = activeTab;
        await refreshHouseholds();

        // Switch settings view to first remaining household or create-new tab
        const remainingHouseholds = households.filter(h => h.id !== deletedHouseholdId);
        if (remainingHouseholds.length > 0) {
          setActiveTab(remainingHouseholds[0].id);
        } else {
          setActiveTab('create-new');
        }

        setMembers([]);
        setInvitations([]);
        setCurrentUserRole(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete household');
      }
    } catch (_error) {
      toast.error('Failed to delete household');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeMemberRole(memberId: string, newRole: string) {
    if (!activeTab || activeTab === 'create-new') return;

    try {
      const response = await fetch(
        `/api/households/${activeTab}/members/${memberId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (response.ok) {
        toast.success('Member role updated');
        setMembers(
          members.map((m) =>
            m.id === memberId ? { ...m, role: newRole as HouseholdMember['role'] } : m
          )
        );
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update role');
      }
    } catch (_error) {
      toast.error('Failed to update role');
    }
  }

  async function removeMember(memberId: string) {
    if (!activeTab || activeTab === 'create-new') return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(`/api/households/${activeTab}/members/${memberId}`, { credentials: 'include', method: 'DELETE' });

      if (response.ok) {
        toast.success('Member removed successfully');
        setMembers(members.filter((m) => m.id !== memberId));
        // Update member count
        setMemberCounts(prev => ({
          ...prev,
          [activeTab]: (prev[activeTab] || 1) - 1,
        }));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove member');
      }
    } catch (_error) {
      toast.error('Failed to remove member');
    }
  }

  function handleTabChange(tabId: string) {
    // Only update the local activeTab state for viewing household settings
    // DO NOT change the global selectedHouseholdId (active household)
    // This allows viewing/editing any household's settings without changing
    // which household is active throughout the app (controlled by sidebar)
    setActiveTab(tabId);
  }

  async function toggleFavorite(householdId: string, currentStatus: boolean, event: React.MouseEvent) {
    // Prevent tab switch when clicking the star
    event.stopPropagation();

    try {
      const response = await fetch(`/api/households/${householdId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentStatus }),
      });

      if (response.ok) {
        // Refresh households to update the favorite status
        await refreshHouseholds();
        toast.success(currentStatus ? 'Removed from favorites' : 'Added to favorites');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update favorite status');
      }
    } catch (_error) {
      toast.error('Failed to update favorite status');
    }
  }

  async function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
        setCopiedToken(token);
        toast.success('Invitation link copied');
        setTimeout(() => setCopiedToken(null), 2000);
        return;
      }
      toast.error(`Could not copy automatically. Link: ${link}`, { duration: 10000 });
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      toast.error(`Could not copy automatically. Link: ${link}`, { duration: 10000 });
    }
  }

  function getRoleIcon(role: string) {
    switch (role) {
      case 'owner': return <Crown className="w-3 h-3" style={{ color: 'var(--color-warning)' }} />;
      case 'admin': return <Shield className="w-3 h-3" style={{ color: 'var(--color-primary)' }} />;
      case 'viewer': return <Eye className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />;
      default: return <Users className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />;
    }
  }

  function getRoleBadgeStyle(role: string): React.CSSProperties {
    switch (role) {
      case 'owner': return { backgroundColor: 'color-mix(in oklch, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in oklch, var(--color-warning) 25%, transparent)' };
      case 'admin': return { backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)' };
      case 'viewer': return { backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' };
      default: return { backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' };
    }
  }

  const canInvite = userPermissions.invite_members;
  const canLeave = currentUserRole !== 'owner';
  const canManagePermissions = userPermissions.manage_permissions;
  const canRemoveMembers = userPermissions.remove_members;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-muted-foreground)' }}>
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  const currentHousehold = activeTab && activeTab !== 'create-new'
    ? households.find(h => h.id === activeTab)
    : null;

  // Sort households by join date (oldest first - chronological order of when user joined)
  const sortedHouseholds = [...households].sort((a, b) =>
    new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );

  if (households.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-14 rounded-xl" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)' }}>
            <Users className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--color-foreground)' }}>Not in a Household</h3>
          <p className="text-[13px] mb-5" style={{ color: 'var(--color-muted-foreground)' }}>Create a household to collaborate on finances with family or roommates</p>
          <Button onClick={() => setCreateDialogOpen(true)} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Create Household
          </Button>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
            <DialogHeader>
              <DialogTitle className="text-[15px]" style={{ color: 'var(--color-foreground)' }}>Create Household</DialogTitle>
              <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Choose a name for your household</DialogDescription>
            </DialogHeader>
            <div className="mt-1">
              <Label htmlFor="householdName" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Household Name</Label>
              <Input id="householdName" name="householdName" type="text" value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder="e.g., The Smiths" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
            </div>
            <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setHouseholdName(''); }} className="h-9 text-[13px]">Cancel</Button>
              <Button onClick={createHousehold} disabled={!householdName.trim() || submitting} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}Create Household
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="w-full">
        {/* Desktop: Horizontal Tabs */}
        <div className="hidden lg:flex w-full gap-1 p-1.5 rounded-xl overflow-x-auto" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
          {sortedHouseholds.map((household) => (
            <button key={household.id} onClick={() => handleTabChange(household.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all shrink-0"
              style={{
                backgroundColor: activeTab === household.id ? 'var(--color-elevated)' : 'transparent',
                color: activeTab === household.id ? 'var(--color-primary)' : 'var(--color-foreground)',
                boxShadow: activeTab === household.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              <Star className="w-3.5 h-3.5 shrink-0 transition-colors cursor-pointer"
                style={{ color: household.isFavorite ? 'var(--color-warning)' : 'var(--color-muted-foreground)', fill: household.isFavorite ? 'var(--color-warning)' : 'transparent' }}
                onClick={e => toggleFavorite(household.id, household.isFavorite, e)} />
              <Users className="w-3.5 h-3.5" />
              <span>{household.name}</span>
              {memberCounts[household.id] !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>
                  {memberCounts[household.id]}
                </span>
              )}
            </button>
          ))}
          <button onClick={() => handleTabChange('create-new')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all shrink-0"
            style={{
              backgroundColor: activeTab === 'create-new' ? 'var(--color-elevated)' : 'transparent',
              color: 'var(--color-primary)',
            }}>
            <Plus className="w-3.5 h-3.5" />Create New
          </button>
        </div>

        {/* Mobile: Dropdown */}
        <div className="lg:hidden mb-4">
          <Select value={activeTab} onValueChange={handleTabChange}>
            <SelectTrigger id="household-tab-select" name="household-tab" aria-label="Select household" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortedHouseholds.map(h => (
                <SelectItem key={h.id} value={h.id}>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>{h.name}</span>
                    {memberCounts[h.id] !== undefined && <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>({memberCounts[h.id]})</span>}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="create-new">
                <div className="flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                  <Plus className="w-3.5 h-3.5" /><span>Create New Household</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tab Content */}
        {sortedHouseholds.map(household => activeTab === household.id && (
          <div key={household.id} className="mt-4 space-y-4">
            {/* Household Header */}
            <div className="flex items-start justify-between pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 className="text-[17px] font-semibold" style={{ color: 'var(--color-foreground)' }}>{household.name}</h3>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                  Created {new Date(household.createdAt).toLocaleDateString()} · {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentUserRole === 'owner' && (
                  <>
                    <button onClick={() => { setNewHouseholdName(household.name); setRenameDialogOpen(true); }}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors"
                      style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                      <Edit className="w-3 h-3" />Rename
                    </button>
                    <button onClick={() => setDeleteDialogOpen(true)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors"
                      style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)', color: 'var(--color-destructive)' }}>
                      <Trash2 className="w-3 h-3" />Delete
                    </button>
                  </>
                )}
                {canLeave && (
                  <button onClick={() => setLeaveDialogOpen(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)', color: 'var(--color-destructive)' }}>
                    <LogOut className="w-3 h-3" />Leave
                  </button>
                )}
              </div>
            </div>

            {/* Members List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Members ({members.length})</p>
                {canInvite && (
                  <button onClick={() => setInviteDialogOpen(true)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                    <UserPlus className="w-3.5 h-3.5" />Invite Member
                  </button>
                )}
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
                {members.map((member, idx) => (
                  <div key={member.id} className="flex items-center justify-between px-4 py-3 gap-3"
                    style={{ borderTop: idx > 0 ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none' }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <UserAvatar userId={member.userId} userName={member.userName || member.userEmail} avatarUrl={member.userAvatarUrl} size="md" className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{member.userName || 'Unknown'}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>{member.userEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canManagePermissions ? (
                        <Select value={member.role} onValueChange={r => changeMemberRole(member.id, r)}>
                          <SelectTrigger className="h-7 text-[12px] w-28" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-medium" style={getRoleBadgeStyle(member.role)}>
                          {getRoleIcon(member.role)}
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </span>
                      )}
                      {canManagePermissions && member.role !== 'owner' && (
                        <button onClick={() => { setSelectedMemberForPermissions({ id: member.id, name: member.userName || member.userEmail, role: member.role }); setPermissionManagerOpen(true); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
                          title="Manage Permissions">
                          <Settings className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                        </button>
                      )}
                      {canRemoveMembers && (
                        <button onClick={() => removeMember(member.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                          style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)' }}>
                          <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--color-destructive)' }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-muted-foreground)' }}>Pending Invitations ({invitations.length})</p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in oklch, var(--color-warning) 25%, var(--color-border))', backgroundColor: 'var(--color-elevated)' }}>
                  {invitations.map((invitation, idx) => (
                    <div key={invitation.id} className="flex items-center justify-between px-4 py-3 gap-3"
                      style={{ borderTop: idx > 0 ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{invitation.invitedEmail}</p>
                        <p className="text-[11px] capitalize" style={{ color: 'var(--color-muted-foreground)' }}>Role: {invitation.role}</p>
                      </div>
                      <button onClick={() => copyInviteLink(invitation.invitationToken)}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] shrink-0 transition-colors"
                        style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                        {copiedToken === invitation.invitationToken ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy Link</>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Create New Household Tab Content */}
        {activeTab === 'create-new' && (
          <div className="mt-4">
            <div className="text-center py-12 rounded-xl" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)' }}>
                <Users className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--color-foreground)' }}>Create a New Household</h3>
              <p className="text-[13px] mb-5 max-w-sm mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>Collaborate on finances with family, roommates, or teams</p>
              <div className="max-w-xs mx-auto space-y-2.5">
                <Input type="text" value={householdName} onChange={e => setHouseholdName(e.target.value)}
                  placeholder="e.g., The Smiths" className="h-9 text-[13px]"
                  style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                  onKeyDown={e => { if (e.key === 'Enter' && householdName.trim()) createHousehold(); }} />
                <Button onClick={createHousehold} disabled={!householdName.trim() || submitting} className="w-full h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}Create Household
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="text-[15px]" style={{ color: 'var(--color-foreground)' }}>Invite Member</DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Send an invitation to join your household</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div>
              <Label htmlFor="inviteEmail" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Email Address</Label>
              <Input id="inviteEmail" name="inviteEmail" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="member@example.com" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
            </div>
            <div>
              <Label htmlFor="inviteRole" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Role</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as 'admin' | 'member' | 'viewer')}>
                <SelectTrigger id="inviteRole" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                  <SelectItem value="member">Member — Standard access</SelectItem>
                  <SelectItem value="viewer">Viewer — Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Button variant="outline" onClick={() => { setInviteDialogOpen(false); setInviteEmail(''); setInviteRole('member'); }} className="h-9 text-[13px]">Cancel</Button>
            <Button onClick={inviteMember} disabled={!inviteEmail.trim() || submitting} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}Send Invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="text-[15px]" style={{ color: 'var(--color-destructive)' }}>Leave Household</DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Are you sure you want to leave &quot;{currentHousehold?.name}&quot;? You&apos;ll lose access to all shared data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)} className="h-9 text-[13px]">Cancel</Button>
            <Button onClick={leaveHousehold} disabled={submitting} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-1.5" />}Leave Household
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="text-[15px]" style={{ color: 'var(--color-foreground)' }}>Rename Household</DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Enter a new name for your household</DialogDescription>
          </DialogHeader>
          <div className="mt-1">
            <Label htmlFor="newHouseholdName" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Household Name</Label>
            <Input id="newHouseholdName" name="newHouseholdName" type="text" value={newHouseholdName} onChange={e => setNewHouseholdName(e.target.value)} placeholder="e.g., The Smiths" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Button variant="outline" onClick={() => { setRenameDialogOpen(false); setNewHouseholdName(''); }} className="h-9 text-[13px]">Cancel</Button>
            <Button onClick={renameHousehold} disabled={!newHouseholdName.trim() || submitting} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit className="w-3.5 h-3.5 mr-1.5" />}Rename Household
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="text-[15px]" style={{ color: 'var(--color-destructive)' }}>Delete Household</DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              This action is permanent and cannot be undone. All household data including transactions, budgets, and bills will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-1">
            <Label htmlFor="deleteConfirm" className="text-[11px] font-medium block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
              Type <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>&quot;{currentHousehold?.name}&quot;</span> to confirm
            </Label>
            <Input id="deleteConfirm" name="deleteConfirm" type="text" value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} placeholder={currentHousehold?.name} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmName(''); }} className="h-9 text-[13px]">Cancel</Button>
            <Button onClick={deleteHousehold} disabled={deleteConfirmName !== currentHousehold?.name || submitting} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}Delete Household
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Household Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="text-[15px]" style={{ color: 'var(--color-foreground)' }}>Create Household</DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Choose a name for your new household</DialogDescription>
          </DialogHeader>
          <div className="mt-1">
            <Label htmlFor="createHouseholdName" className="text-[11px] font-medium uppercase tracking-wide block mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>Household Name</Label>
            <Input id="createHouseholdName" name="createHouseholdName" type="text" value={householdName} onChange={e => setHouseholdName(e.target.value)} placeholder="e.g., The Smiths" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} autoFocus />
          </div>
          <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setHouseholdName(''); }} className="h-9 text-[13px]">Cancel</Button>
            <Button onClick={createHousehold} disabled={!householdName.trim() || submitting} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}Create Household
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Manager Dialog */}
      {selectedMemberForPermissions && activeTab && activeTab !== 'create-new' && (
        <PermissionManager
          open={permissionManagerOpen}
          onOpenChange={open => { setPermissionManagerOpen(open); if (!open) setSelectedMemberForPermissions(null); }}
          householdId={activeTab}
          memberId={selectedMemberForPermissions.id}
          memberName={selectedMemberForPermissions.name}
          memberRole={selectedMemberForPermissions.role}
          onSave={() => { if (activeTab) fetchHouseholdDetails(activeTab); }}
        />
      )}
    </div>
  );
}
