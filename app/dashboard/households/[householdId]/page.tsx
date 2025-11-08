'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Shield, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface HouseholdMember {
  id: string;
  userId: string;
  userName?: string;
  userEmail: string;
  role: string;
  joinedAt: string;
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

export default function HouseholdManagementPage() {
  const params = useParams();
  const householdId = params.householdId as string;

  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchHouseholdData();
  }, [householdId]);

  const fetchHouseholdData = async () => {
    try {
      setLoading(true);
      const [householdRes, membersRes, invitationsRes, permissionsRes] = await Promise.all([
        fetch(`/api/households/${householdId}`),
        fetch(`/api/households/${householdId}/members`),
        fetch(`/api/households/${householdId}/invitations`),
        fetch(`/api/households/${householdId}/permissions`),
      ]);

      if (householdRes.ok) {
        setHousehold(await householdRes.json());
      }
      if (membersRes.ok) {
        setMembers(await membersRes.json());
      }
      if (invitationsRes.ok) {
        setInvitations(await invitationsRes.json());
      }
      if (permissionsRes.ok) {
        setUserPermissions(await permissionsRes.json());
      }
    } catch (error) {
      console.error('Error fetching household data:', error);
      toast.error('Failed to load household data');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setInviting(true);

    try {
      const response = await fetch(`/api/households/${householdId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitedEmail: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send invitation');
      }

      const data = await response.json();
      toast.success('Invitation sent successfully');
      setInviteEmail('');
      setInviteRole('member');
      setInviteOpen(false);

      // Refresh invitations
      await fetchHouseholdData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(
        `/api/households/${householdId}/members/${memberId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Member removed successfully');
        setMembers(members.filter((m) => m.id !== memberId));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to remove member');
      }
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(
        `/api/households/${householdId}/members/${memberId}`,
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
            m.id === memberId ? { ...m, role: newRole } : m
          )
        );
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update role');
      }
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success('Invitation link copied');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-[#60a5fa] animate-spin" />
      </div>
    );
  }

  if (!household) {
    return (
      <div className="p-6">
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-6">
          <p className="text-[#f87171]">Household not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">{household.name}</h1>
        <p className="text-[#9ca3af]">Manage household members and settings</p>
      </div>

      {/* Members Section */}
      <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Members</h2>
          {userPermissions.invite_members && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#10b981] hover:bg-[#059669] text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                <DialogHeader>
                  <DialogTitle className="text-white">Invite Member</DialogTitle>
                  <DialogDescription className="text-[#9ca3af]">
                    Send an invitation to a new household member
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-[#242424] border-[#2a2a2a] text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-white">
                      Role
                    </Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleInviteMember}
                    disabled={inviting}
                    className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Invitation'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-[#242424] rounded-lg border border-[#2a2a2a]"
            >
              <div className="flex-1">
                <p className="font-medium text-white">
                  {member.userName || member.userEmail}
                </p>
                <p className="text-sm text-[#6b7280]">{member.userEmail}</p>
              </div>
              <div className="flex items-center gap-3">
                {userPermissions.manage_permissions ? (
                  <Select
                    value={member.role}
                    onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                  >
                    <SelectTrigger className="w-32 bg-[#1a1a1a] border-[#2a2a2a] text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-1 px-3 py-2 bg-[#1a1a1a] rounded text-white text-sm capitalize">
                    <Shield className="w-4 h-4" />
                    {member.role}
                  </div>
                )}
                {userPermissions.remove_members && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-[#f87171] hover:bg-[#f87171]/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pending Invitations Section */}
      {invitations.length > 0 && (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-6">
          <h2 className="text-xl font-bold text-white mb-6">Pending Invitations</h2>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 bg-[#242424] rounded-lg border border-[#fbbf24]/30"
              >
                <div className="flex-1">
                  <p className="font-medium text-white">{invitation.invitedEmail}</p>
                  <p className="text-sm text-[#6b7280] capitalize">
                    Role: {invitation.role}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyInviteLink(invitation.invitationToken)}
                  className="border-[#2a2a2a] text-[#9ca3af]"
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
            ))}
          </div>
        </Card>
      )}
      </div>
    </div>
  );
}
