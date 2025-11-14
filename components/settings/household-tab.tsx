'use client';

import { useState, useEffect } from 'react';
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
import { Users, UserPlus, LogOut, Crown, Shield, Eye, Loader2, Trash2, Copy, Check, Edit, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useHousehold } from '@/contexts/household-context';

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

interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export function HouseholdTab() {
  const { households, selectedHouseholdId, setSelectedHouseholdId, loading, refreshHouseholds } = useHousehold();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
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

  useEffect(() => {
    if (selectedHouseholdId) {
      fetchHouseholdDetails(selectedHouseholdId);
    }
  }, [selectedHouseholdId]);

  async function fetchHouseholdDetails(householdId: string) {
    try {
      // Fetch members, invitations, and permissions in parallel
      const [membersResponse, invitationsResponse, permissionsResponse] = await Promise.all([
        fetch(`/api/households/${householdId}/members`),
        fetch(`/api/households/${householdId}/invitations`),
        fetch(`/api/households/${householdId}/permissions`),
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
    } catch (error) {
      toast.error('Failed to load household details');
    }
  }

  async function createHousehold() {
    if (!householdName.trim()) {
      toast.error('Household name is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName }),
      });

      if (response.ok) {
        const newHousehold = await response.json();
        toast.success('Household created successfully');
        setCreateDialogOpen(false);
        setHouseholdName('');
        // Refresh households and select the new one
        await refreshHouseholds();
        setSelectedHouseholdId(newHousehold.id);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create household');
      }
    } catch (error) {
      toast.error('Failed to create household');
    } finally {
      setSubmitting(false);
    }
  }

  async function inviteMember() {
    if (!inviteEmail.trim() || !selectedHouseholdId) {
      toast.error('Email is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${selectedHouseholdId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        fetchHouseholdDetails(selectedHouseholdId); // Refresh
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveHousehold() {
    if (!selectedHouseholdId) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${selectedHouseholdId}/leave`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Left household successfully');
        setLeaveDialogOpen(false);
        // Refresh households and clear details
        await refreshHouseholds();
        setMembers([]);
        setInvitations([]);
        setCurrentUserRole(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to leave household');
      }
    } catch (error) {
      toast.error('Failed to leave household');
    } finally {
      setSubmitting(false);
    }
  }

  async function renameHousehold() {
    if (!selectedHouseholdId) return;

    if (!newHouseholdName.trim()) {
      toast.error('Household name is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${selectedHouseholdId}`, {
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
    } catch (error) {
      toast.error('Failed to rename household');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteHousehold() {
    if (!selectedHouseholdId) return;

    const household = households.find(h => h.id === selectedHouseholdId);
    if (!household) return;

    if (deleteConfirmName !== household.name) {
      toast.error('Household name does not match');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${selectedHouseholdId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Household deleted successfully');
        setDeleteDialogOpen(false);
        setDeleteConfirmName('');
        // Refresh households and clear details
        await refreshHouseholds();
        setMembers([]);
        setInvitations([]);
        setCurrentUserRole(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete household');
      }
    } catch (error) {
      toast.error('Failed to delete household');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeMemberRole(memberId: string, newRole: string) {
    if (!selectedHouseholdId) return;

    try {
      const response = await fetch(
        `/api/households/${selectedHouseholdId}/members/${memberId}`,
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
            m.id === memberId ? { ...m, role: newRole as any } : m
          )
        );
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update role');
      }
    } catch (error) {
      toast.error('Failed to update role');
    }
  }

  async function removeMember(memberId: string) {
    if (!selectedHouseholdId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(
        `/api/households/${selectedHouseholdId}/members/${memberId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Member removed successfully');
        setMembers(members.filter((m) => m.id !== memberId));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove member');
      }
    } catch (error) {
      toast.error('Failed to remove member');
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
        return <Crown className="w-4 h-4 text-[var(--color-warning)]" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-[var(--color-primary)]" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Users className="w-4 h-4 text-muted-foreground" />;
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'owner':
        return 'bg-[var(--color-warning)] text-white';
      case 'admin':
        return 'bg-[var(--color-primary)] text-white';
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

  const selectedHousehold = selectedHouseholdId
    ? households.find(h => h.id === selectedHouseholdId)
    : null;

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
      {/* Household List & Create Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          My Households ({households.length})
        </h3>
        <Button
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
          className="bg-[var(--color-primary)] hover:opacity-90"
        >
          <Plus className="w-4 h-4 mr-1" />
          Create Household
        </Button>
      </div>

      {/* Households Grid */}
      <div className="grid gap-3">
        {households.map((household) => (
          <Card
            key={household.id}
            className={`p-4 cursor-pointer transition-all border-2 ${
              selectedHouseholdId === household.id
                ? 'border-[var(--color-primary)] bg-elevated'
                : 'border-border bg-card hover:bg-elevated'
            }`}
            onClick={() => setSelectedHouseholdId(household.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-foreground">{household.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(household.createdAt).toLocaleDateString()}
                </p>
              </div>
              {selectedHouseholdId === household.id && (
                <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Selected Household Details */}
      {selectedHousehold && (
        <>
          {/* Household Actions */}
          <div className="flex items-center gap-2">
            {currentUserRole === 'owner' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewHouseholdName(selectedHousehold.name);
                  setRenameDialogOpen(true);
                }}
                className="border-border"
              >
                <Edit className="w-4 h-4 mr-1" />
                Rename
              </Button>
            )}
          </div>
        </>
      )}

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
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Invite
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

                  {canRemoveMembers && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member.id)}
                      className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
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
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-foreground">
              Pending Invitations ({invitations.length})
            </h4>
          </div>

          <div className="space-y-2">
            {invitations.map((invitation) => (
              <Card
                key={invitation.id}
                className="p-4 bg-elevated border-border border-[var(--color-warning)]/30"
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

      {/* Leave Household */}
      {canLeave && (
        <div>
          <Button
            variant="outline"
            onClick={() => setLeaveDialogOpen(true)}
            className="border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Household
          </Button>
        </div>
      )}

      {/* Delete Household (Owner Only) */}
      {currentUserRole === 'owner' && (
        <div className="border-t border-border pt-6">
          <h4 className="font-medium text-foreground mb-2">Danger Zone</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete this household and all associated data. This action cannot be undone.
          </p>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className="border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Household
          </Button>
        </div>
      )}

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
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
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
            <DialogTitle className="text-[var(--color-error)]">
              Leave Household
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to leave "{selectedHousehold?.name}"? You'll lose access to all shared data.
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
              className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
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
              className="bg-[var(--color-primary)] hover:opacity-90"
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
            <DialogTitle className="text-[var(--color-error)]">
              Delete Household
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action is permanent and cannot be undone. All household data including transactions,
              budgets, and bills will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="deleteConfirm" className="text-foreground">
              Type the household name <span className="font-semibold">"{selectedHousehold?.name}"</span> to confirm
            </Label>
            <Input
              id="deleteConfirm"
              name="deleteConfirm"
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={selectedHousehold?.name}
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
              disabled={deleteConfirmName !== selectedHousehold?.name || submitting}
              className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
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
    </div>
  );
}
