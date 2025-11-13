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
import { Users, UserPlus, LogOut, Crown, Shield, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface HouseholdMember {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  isActive: boolean;
}

interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export function HouseholdTab() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [householdName, setHouseholdName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHousehold();
  }, []);

  async function fetchHousehold() {
    try {
      setLoading(true);
      // Get user's households
      const response = await fetch('/api/households');
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          // Use first household (user can only have one for now)
          const household = data[0];
          setHousehold(household);

          // Fetch members
          const membersResponse = await fetch(`/api/households/${household.id}/members`);
          if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            setMembers(membersData);

            // Find current user's role
            // Note: We'll need to get the current user's ID from somewhere
            // For now, we'll check if they're the creator (owner)
            const currentMember = membersData.find((m: HouseholdMember) =>
              m.userId === household.createdBy
            );
            if (currentMember) {
              setCurrentUserRole(currentMember.role);
            }
          }
        }
      }
    } catch (error) {
      toast.error('Failed to load household');
    } finally {
      setLoading(false);
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
        toast.success('Household created successfully');
        setCreateDialogOpen(false);
        setHouseholdName('');
        fetchHousehold(); // Refresh
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
    if (!inviteEmail.trim() || !household) {
      toast.error('Email is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${household.id}/invitations`, {
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
        fetchHousehold(); // Refresh
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
    if (!household) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/households/${household.id}/leave`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Left household successfully');
        setLeaveDialogOpen(false);
        setHousehold(null);
        setMembers([]);
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

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canLeave = currentUserRole !== 'owner';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!household) {
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
            <UserPlus className="w-4 h-4 mr-2" />
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
                  <UserPlus className="w-4 h-4 mr-2" />
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
      {/* Household Info */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {household.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          Created {new Date(household.createdAt).toLocaleDateString()}
        </p>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>

                  <div>
                    <div className="font-medium text-foreground">
                      {member.userName || 'Unknown'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {member.userEmail}
                    </div>
                  </div>
                </div>

                <Badge className={getRoleBadgeColor(member.role)}>
                  <div className="flex items-center gap-1">
                    {getRoleIcon(member.role)}
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </div>
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

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
              Are you sure you want to leave "{household.name}"? You'll lose access to all shared data.
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
    </div>
  );
}
