'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
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

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success('Invitation link copied');
    setTimeout(() => setCopiedToken(null), 2000);
  }

  function getRoleIcon(role: string) {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-(--color-warning)" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-(--color-primary)" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Users className="w-4 h-4 text-muted-foreground" />;
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'owner':
        return 'bg-(--color-warning) text-white';
      case 'admin':
        return 'bg-(--color-primary) text-white';
      case 'viewer':
        return 'bg-elevated text-muted-foreground';
      default:
        return 'bg-card text-foreground';
    }
  }

  const canInvite = userPermissions.invite_members;
  const canLeave = currentUserRole !== 'owner';
  const canManagePermissions = userPermissions.manage_permissions;
  const canRemoveMembers = userPermissions.remove_members;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
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
      <div className="space-y-6">
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Not in a Household
          </h3>
          <p className="text-muted-foreground mb-6">
            Create a household to collaborate on finances with family or roommates
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Household
          </Button>
        </div>

        {/* Create Household Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Household</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Choose a name for your household
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label htmlFor="householdName" className="text-foreground">
                Household Name
              </Label>
              <Input
                id="householdName"
                name="householdName"
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g., The Smiths"
                className="mt-1 bg-elevated border-border"
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setHouseholdName('');
                }}
                className="border-border"
              >
                Cancel
              </Button>
              <Button onClick={createHousehold} disabled={!householdName.trim() || submitting}>
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create Household
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="w-full">
        {/* Desktop: Horizontal Tabs */}
        <div className="hidden lg:flex w-full justify-start bg-elevated border border-border overflow-x-auto h-auto flex-wrap gap-1 p-2 rounded-md">
          {sortedHouseholds.map((household) => (
            <button
              key={household.id}
              onClick={() => handleTabChange(household.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors relative group",
                activeTab === household.id
                  ? "bg-card text-(--color-primary) shadow-sm"
                  : "text-foreground hover:bg-card/50"
              )}
            >
              <Star
                className={cn(
                  "w-4 h-4 cursor-pointer transition-colors shrink-0",
                  household.isFavorite
                    ? "fill-(--color-warning) text-(--color-warning)"
                    : "text-muted-foreground hover:text-(--color-warning)"
                )}
                onClick={(e) => toggleFavorite(household.id, household.isFavorite, e)}
              />
              <Users className="w-4 h-4" />
              <span>{household.name}</span>
              {memberCounts[household.id] !== undefined && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {memberCounts[household.id]}
                </Badge>
              )}
            </button>
          ))}
          <button
            onClick={() => handleTabChange('create-new')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === 'create-new'
                ? "bg-card text-(--color-primary) shadow-sm"
                : "text-(--color-primary) hover:bg-card/50"
            )}
          >
            <Plus className="w-4 h-4" />
            <span>Create New</span>
          </button>
        </div>

        {/* Mobile: Dropdown */}
        <div className="lg:hidden mb-4">
          <Select value={activeTab} onValueChange={handleTabChange}>
            <SelectTrigger
              id="household-tab-select"
              name="household-tab"
              aria-label="Select household"
              className="w-full bg-card border-border"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortedHouseholds.map((household) => (
                <SelectItem key={household.id} value={household.id}>
                  <div className="flex items-center gap-2 w-full">
                    <Star
                      className={cn(
                        "w-4 h-4 cursor-pointer transition-colors shrink-0",
                        household.isFavorite
                          ? "fill-(--color-warning) text-(--color-warning)"
                          : "text-muted-foreground hover:text-(--color-warning)"
                      )}
                      onClick={(e) => toggleFavorite(household.id, household.isFavorite, e)}
                    />
                    <Users className="w-4 h-4" />
                    <span>{household.name}</span>
                    {memberCounts[household.id] !== undefined && (
                      <span className="text-muted-foreground text-xs ml-auto">
                        ({memberCounts[household.id]} members)
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="create-new">
                <div className="flex items-center gap-2 text-(--color-primary)">
                  <Plus className="w-4 h-4" />
                  <span>Create New Household</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tab Content for each household */}
        {sortedHouseholds.map((household) => (
          activeTab === household.id && (
          <div key={household.id} className="mt-6 space-y-6">
            {/* Household Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-2xl font-semibold text-foreground">{household.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Created {new Date(household.createdAt).toLocaleDateString()} • {members.length} members
                </p>
              </div>

              {/* Household Actions */}
              <div className="flex items-center gap-2">
                {currentUserRole === 'owner' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewHouseholdName(household.name);
                        setRenameDialogOpen(true);
                      }}
                      className="border-border"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      className="border-(--color-error) text-(--color-error) hover:bg-(--color-error)/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </>
                )}
                {canLeave && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaveDialogOpen(true)}
                    className="border-(--color-error) text-(--color-error) hover:bg-(--color-error)/10"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Leave
                  </Button>
                )}
              </div>
            </div>

            {/* Members List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-foreground">
                  Members ({members.length})
                </h4>
                {canInvite && (
                  <Button
                    size="sm"
                    onClick={() => setInviteDialogOpen(true)}
                    className="bg-(--color-primary) hover:opacity-90"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Invite Member
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {members.map((member) => (
                  <Card
                    key={member.id}
                    className="p-4 bg-elevated border-border"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <UserAvatar
                          userId={member.userId}
                          userName={member.userName || member.userEmail}
                          avatarUrl={member.userAvatarUrl}
                          size="md"
                          className="shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {member.userName || 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {member.userEmail}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canManagePermissions ? (
                          <Select
                            value={member.role}
                            onValueChange={(newRole) => changeMemberRole(member.id, newRole)}
                          >
                            <SelectTrigger className="w-32 bg-card border-border text-foreground text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getRoleBadgeColor(member.role)}>
                            <div className="flex items-center gap-1">
                              {getRoleIcon(member.role)}
                              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </div>
                          </Badge>
                        )}

                        {canManagePermissions && member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMemberForPermissions({
                                id: member.id,
                                name: member.userName || member.userEmail,
                                role: member.role,
                              });
                              setPermissionManagerOpen(true);
                            }}
                            className="text-foreground hover:bg-elevated"
                            title="Manage Permissions"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        )}

                        {canRemoveMembers && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMember(member.id)}
                            className="text-(--color-error) hover:bg-(--color-error)/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-4">
                  Pending Invitations ({invitations.length})
                </h4>

                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <Card
                      key={invitation.id}
                      className="p-4 bg-elevated border-border border-(--color-warning)/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {invitation.invitedEmail}
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">
                            Role: {invitation.role}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.invitationToken)}
                          className="border-border text-muted-foreground shrink-0"
                        >
                          {copiedToken === invitation.invitationToken ? (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" />
                              Copy Link
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
          )
        ))}

        {/* Create New Household Tab Content */}
        {activeTab === 'create-new' && (
        <div className="mt-6">
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Create a New Household
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create a household to collaborate on finances with family, roommates, or teams
            </p>
            <div className="max-w-sm mx-auto space-y-4">
              <Input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="Household name (e.g., The Smiths)"
                className="bg-elevated border-border"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && householdName.trim()) {
                    createHousehold();
                  }
                }}
              />
              <Button
                onClick={createHousehold}
                disabled={!householdName.trim() || submitting}
                className="w-full bg-(--color-primary) hover:opacity-90"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create Household
              </Button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Invite Member</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send an invitation to join your household
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="inviteEmail" className="text-foreground">Email</Label>
              <Input
                id="inviteEmail"
                name="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@example.com"
                className="mt-1 bg-elevated border-border"
              />
            </div>

            <div>
              <Label htmlFor="inviteRole" className="text-foreground">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'member' | 'viewer')}>
                <SelectTrigger id="inviteRole" className="mt-1 bg-elevated border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                  <SelectItem value="member">Member - Standard access</SelectItem>
                  <SelectItem value="viewer">Viewer - Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(false);
                setInviteEmail('');
                setInviteRole('member');
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button onClick={inviteMember} disabled={!inviteEmail.trim() || submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-(--color-error)">
              Leave Household
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to leave &quot;{currentHousehold?.name}&quot;? You&apos;ll lose access to all shared data.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeaveDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={leaveHousehold}
              disabled={submitting}
              className="bg-(--color-error) hover:bg-(--color-error)/90"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-2" />
              )}
              Leave Household
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Household Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Rename Household
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter a new name for your household
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="newHouseholdName" className="text-foreground">
              Household Name
            </Label>
            <Input
              id="newHouseholdName"
              name="newHouseholdName"
              type="text"
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              placeholder="e.g., The Smiths"
              className="mt-2 bg-elevated border-border"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false);
                setNewHouseholdName('');
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={renameHousehold}
              disabled={!newHouseholdName.trim() || submitting}
              className="bg-(--color-primary) hover:opacity-90"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Edit className="w-4 h-4 mr-2" />
              )}
              Rename Household
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Household Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-(--color-error)">
              Delete Household
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action is permanent and cannot be undone. All household data including transactions,
              budgets, and bills will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="deleteConfirm" className="text-foreground">
              Type the household name <span className="font-semibold">&quot;{currentHousehold?.name}&quot;</span> to confirm
            </Label>
            <Input
              id="deleteConfirm"
              name="deleteConfirm"
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={currentHousehold?.name}
              className="mt-2 bg-elevated border-border"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmName('');
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteHousehold}
              disabled={deleteConfirmName !== currentHousehold?.name || submitting}
              className="bg-(--color-error) hover:bg-(--color-error)/90"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Household
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Household Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Household</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose a name for your new household
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="createHouseholdName" className="text-foreground">
              Household Name
            </Label>
            <Input
              id="createHouseholdName"
              name="createHouseholdName"
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="e.g., The Smiths"
              className="mt-1 bg-elevated border-border"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setHouseholdName('');
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button onClick={createHousehold} disabled={!householdName.trim() || submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Household
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Manager Dialog */}
      {selectedMemberForPermissions && activeTab && activeTab !== 'create-new' && (
        <PermissionManager
          open={permissionManagerOpen}
          onOpenChange={(open) => {
            setPermissionManagerOpen(open);
            if (!open) {
              setSelectedMemberForPermissions(null);
            }
          }}
          householdId={activeTab}
          memberId={selectedMemberForPermissions.id}
          memberName={selectedMemberForPermissions.name}
          memberRole={selectedMemberForPermissions.role}
          onSave={() => {
            // Refresh member list after saving permissions
            if (activeTab) {
              fetchHouseholdDetails(activeTab);
            }
          }}
        />
      )}
    </div>
  );
}
