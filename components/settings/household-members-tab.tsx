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
import { Users, UserPlus, LogOut, Crown, Shield, Eye, Loader2, Trash2, Copy, Check, Edit, Settings } from 'lucide-react';
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

interface HouseholdMembersTabProps {
  householdId: string;
}

export function HouseholdMembersTab({ householdId }: HouseholdMembersTabProps) {
  const { selectedHousehold, refreshHouseholds } = useHousehold();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
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
  const [loading, setLoading] = useState(true);

  const fetchHouseholdDetails = useCallback(async () => {
    try {
      setLoading(true);
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
        const currentMember = membersData.find((m: HouseholdMember) =>
          m.userId === selectedHousehold?.createdBy
        );
        if (currentMember) {
          setCurrentUserRole(currentMember.role);
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
    } finally {
      setLoading(false);
    }
  }, [householdId, selectedHousehold?.createdBy]);

  // Fetch household details when householdId changes
  useEffect(() => {
    if (householdId) {
      fetchHouseholdDetails();
    }
  }, [householdId, fetchHouseholdDetails]);

  async function inviteMember() {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${householdId}/invitations`, {
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
        fetchHouseholdDetails(); // Refresh
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
    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${householdId}/leave`, {
        credentials: 'include',
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Left household successfully');
        setLeaveDialogOpen(false);
        await refreshHouseholds();
        // Redirect to first household or account settings
        window.location.href = '/dashboard/settings?section=account&tab=profile';
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
    if (!newHouseholdName.trim()) {
      toast.error('Household name is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${householdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHouseholdName }),
      });

      if (response.ok) {
        toast.success('Household renamed successfully');
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
    if (!selectedHousehold) return;

    if (deleteConfirmName !== selectedHousehold.name) {
      toast.error('Household name does not match');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${householdId}`, {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Household deleted successfully');
        setDeleteDialogOpen(false);
        setDeleteConfirmName('');
        await refreshHouseholds();
        // Redirect to account settings
        window.location.href = '/dashboard/settings?section=account&tab=profile';
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
    try {
      const response = await fetch(`/api/households/${householdId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

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
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(`/api/households/${householdId}/members/${memberId}`, {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Member removed successfully');
        setMembers(members.filter((m) => m.id !== memberId));
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove member');
      }
    } catch (_error) {
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
        return <Crown className="w-4 h-4 text-warning" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-primary" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Users className="w-4 h-4 text-muted-foreground" />;
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'owner':
        return 'bg-warning text-white';
      case 'admin':
        return 'bg-primary text-white';
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
  const isOwner = currentUserRole === 'owner';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Members & Access</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage household members, roles, and permissions
        </p>
      </div>

      {/* Household Actions */}
      {selectedHousehold && (
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{selectedHousehold.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="border-error text-error hover:bg-error/10"
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
                className="border-error text-error hover:bg-error/10"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Leave
              </Button>
            )}
          </div>
        </div>
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
              className="bg-primary hover:opacity-90"
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
                      className="text-error hover:bg-error/10"
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
                className="p-4 bg-elevated border-border border-warning/30"
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
            <DialogTitle className="text-error">
              Leave Household
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to leave &quot;{selectedHousehold?.name}&quot;? You&apos;ll lose access to all shared data.
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
              className="bg-error hover:bg-error/90"
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
              className="bg-primary hover:opacity-90"
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
            <DialogTitle className="text-error">
              Delete Household
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action is permanent and cannot be undone. All household data including transactions,
              budgets, and bills will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="deleteConfirm" className="text-foreground">
              Type the household name <span className="font-semibold">&quot;{selectedHousehold?.name}&quot;</span> to confirm
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
              className="bg-error hover:bg-error/90"
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

      {/* Permission Manager Dialog */}
      {selectedMemberForPermissions && (
        <PermissionManager
          open={permissionManagerOpen}
          onOpenChange={(open) => {
            setPermissionManagerOpen(open);
            if (!open) {
              setSelectedMemberForPermissions(null);
            }
          }}
          householdId={householdId}
          memberId={selectedMemberForPermissions.id}
          memberName={selectedMemberForPermissions.name}
          memberRole={selectedMemberForPermissions.role}
          onSave={() => {
            fetchHouseholdDetails();
          }}
        />
      )}
    </div>
  );
}

