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
import {
  Users, UserPlus, LogOut, Crown, Shield, Eye, Loader2, Trash2,
  Copy, Check, Edit, Settings, Home,
} from 'lucide-react';
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

// ── Shared helpers ────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  action,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest flex-1" style={{ color: accent }}>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  owner:  'var(--color-warning)',
  admin:  'var(--color-primary)',
  viewer: 'var(--color-muted-foreground)',
  member: 'var(--color-foreground)',
};

function RoleIcon({ role }: { role: string }) {
  if (role === 'owner')  return <Crown  className="w-3.5 h-3.5" style={{ color: ROLE_COLORS.owner }} />;
  if (role === 'admin')  return <Shield className="w-3.5 h-3.5" style={{ color: ROLE_COLORS.admin }} />;
  if (role === 'viewer') return <Eye    className="w-3.5 h-3.5" style={{ color: ROLE_COLORS.viewer }} />;
  return <Users className="w-3.5 h-3.5" style={{ color: ROLE_COLORS.member }} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

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
    id: string; name: string; role: 'owner' | 'admin' | 'member' | 'viewer';
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHouseholdDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, invitationsRes, permissionsRes] = await Promise.all([
        fetch(`/api/households/${householdId}/members`,     { credentials: 'include' }),
        fetch(`/api/households/${householdId}/invitations`, { credentials: 'include' }),
        fetch(`/api/households/${householdId}/permissions`, { credentials: 'include' }),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data);
        const currentMember = data.find((m: HouseholdMember) => m.userId === selectedHousehold?.createdBy);
        if (currentMember) setCurrentUserRole(currentMember.role);
      }
      if (invitationsRes.ok) setInvitations(await invitationsRes.json());
      if (permissionsRes.ok) setUserPermissions(await permissionsRes.json());
    } catch {
      toast.error('Failed to load household details');
    } finally {
      setLoading(false);
    }
  }, [householdId, selectedHousehold?.createdBy]);

  useEffect(() => {
    if (householdId) fetchHouseholdDetails();
  }, [householdId, fetchHouseholdDetails]);

  async function inviteMember() {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return; }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/households/${householdId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitedEmail: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        toast.success('Invitation sent');
        setInviteDialogOpen(false); setInviteEmail(''); setInviteRole('member');
        fetchHouseholdDetails();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to send invitation');
      }
    } catch { toast.error('Failed to send invitation'); }
    finally { setSubmitting(false); }
  }

  async function leaveHousehold() {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/households/${householdId}/leave`, { credentials: 'include', method: 'POST' });
      if (res.ok) {
        toast.success('Left household');
        setLeaveDialogOpen(false);
        await refreshHouseholds();
        window.location.href = '/dashboard/settings?section=account&tab=profile';
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to leave');
      }
    } catch { toast.error('Failed to leave household'); }
    finally { setSubmitting(false); }
  }

  async function renameHousehold() {
    if (!newHouseholdName.trim()) { toast.error('Name is required'); return; }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/households/${householdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHouseholdName }),
      });
      if (res.ok) {
        toast.success('Household renamed');
        await refreshHouseholds();
        setRenameDialogOpen(false); setNewHouseholdName('');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to rename');
      }
    } catch { toast.error('Failed to rename household'); }
    finally { setSubmitting(false); }
  }

  async function deleteHousehold() {
    if (!selectedHousehold || deleteConfirmName !== selectedHousehold.name) {
      toast.error('Household name does not match'); return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/households/${householdId}`, { credentials: 'include', method: 'DELETE' });
      if (res.ok) {
        toast.success('Household deleted');
        setDeleteDialogOpen(false); setDeleteConfirmName('');
        await refreshHouseholds();
        window.location.href = '/dashboard/settings?section=account&tab=profile';
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to delete');
      }
    } catch { toast.error('Failed to delete household'); }
    finally { setSubmitting(false); }
  }

  async function changeMemberRole(memberId: string, newRole: string) {
    try {
      const res = await fetch(`/api/households/${householdId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success('Role updated');
        setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole as HouseholdMember['role'] } : m));
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to update role');
      }
    } catch { toast.error('Failed to update role'); }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/households/${householdId}/members/${memberId}`, { credentials: 'include', method: 'DELETE' });
      if (res.ok) {
        toast.success('Member removed');
        setMembers(members.filter(m => m.id !== memberId));
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to remove');
      }
    } catch { toast.error('Failed to remove member'); }
  }

  async function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setCopiedToken(token);
        toast.success('Link copied');
        setTimeout(() => setCopiedToken(null), 2000);
        return;
      }
      toast.error(`Link: ${link}`, { duration: 10000 });
    } catch {
      toast.error(`Link: ${link}`, { duration: 10000 });
    }
  }

  const canInvite           = userPermissions.invite_members;
  const canLeave            = currentUserRole !== 'owner';
  const canManagePermissions = userPermissions.manage_permissions;
  const canRemoveMembers    = userPermissions.remove_members;
  const isOwner             = currentUserRole === 'owner';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Household identity card ──────────────────────────────────────── */}
      {selectedHousehold && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
          >
            <Home className="w-4.5 h-4.5" style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--color-foreground)' }}>
              {selectedHousehold.name}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isOwner && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setNewHouseholdName(selectedHousehold.name); setRenameDialogOpen(true); }}
                  className="h-7 px-2 text-[12px]"
                  style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
                >
                  <Edit className="w-3 h-3 mr-1" /> Rename
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="h-7 px-2 text-[12px]"
                  style={{ color: 'var(--color-destructive)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </>
            )}
            {canLeave && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLeaveDialogOpen(true)}
                className="h-7 px-2 text-[12px]"
                style={{ color: 'var(--color-destructive)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}
              >
                <LogOut className="w-3 h-3 mr-1" /> Leave
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Members ──────────────────────────────────────────────────────── */}
      <Section
        icon={Users}
        label={`Members · ${members.length}`}
        action={
          canInvite ? (
            <Button
              size="sm"
              onClick={() => setInviteDialogOpen(true)}
              className="h-6 px-2.5 text-[11px] font-medium"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <UserPlus className="w-3 h-3 mr-1" /> Invite
            </Button>
          ) : undefined
        }
      >
        {members.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>No members yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
            {members.map(member => (
              <div key={member.id} className="px-4 py-3 flex items-center gap-3 group">
                <UserAvatar
                  userId={member.userId}
                  userName={member.userName || member.userEmail}
                  avatarUrl={member.userAvatarUrl}
                  size="sm"
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                    {member.userName || 'Unknown'}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                    {member.userEmail}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canManagePermissions ? (
                    <Select value={member.role} onValueChange={v => changeMemberRole(member.id, v)}>
                      <SelectTrigger className="h-7 w-28 text-[12px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
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
                    <span
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${ROLE_COLORS[member.role]} 12%, transparent)`,
                        color: ROLE_COLORS[member.role],
                      }}
                    >
                      <RoleIcon role={member.role} />
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                  )}

                  {canManagePermissions && member.role !== 'owner' && (
                    <button
                      onClick={() => {
                        setSelectedMemberForPermissions({ id: member.id, name: member.userName || member.userEmail, role: member.role });
                        setPermissionManagerOpen(true);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-muted-foreground)' }}
                      title="Manage Permissions"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canRemoveMembers && (
                    <button
                      onClick={() => removeMember(member.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-destructive)' }}
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Pending Invitations ───────────────────────────────────────────── */}
      {invitations.length > 0 && (
        <Section
          icon={UserPlus}
          label={`Pending Invitations · ${invitations.length}`}
          accent="var(--color-warning)"
        >
          <div className="divide-y" style={{ borderColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
            {invitations.map(inv => (
              <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{inv.invitedEmail}</p>
                  <p className="text-[11px] capitalize" style={{ color: 'var(--color-muted-foreground)' }}>Role: {inv.role}</p>
                </div>
                <button
                  onClick={() => copyInviteLink(inv.invitationToken)}
                  className="flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                  style={{ border: '1px solid var(--color-border)', color: copiedToken === inv.invitationToken ? 'var(--color-success)' : 'var(--color-muted-foreground)', backgroundColor: 'var(--color-elevated)' }}
                >
                  {copiedToken === inv.invitationToken
                    ? <><Check className="w-3 h-3" /> Copied</>
                    : <><Copy className="w-3 h-3" /> Copy Link</>
                  }
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}

      {/* Invite */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '1rem', maxWidth: '26rem', boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)' }}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>Invite Member</DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Send an invitation to join your household.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="inviteEmail" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Email</Label>
              <Input id="inviteEmail" name="inviteEmail" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="member@example.com" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inviteRole" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Role</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as 'admin' | 'member' | 'viewer')}>
                <SelectTrigger id="inviteRole" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setInviteDialogOpen(false); setInviteEmail(''); setInviteRole('member'); }} className="text-[13px]" style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}>Cancel</Button>
            <Button onClick={inviteMember} disabled={!inviteEmail.trim() || submitting} className="text-[13px] font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1.5" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '1rem', maxWidth: '26rem', boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)' }}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-destructive)' }}>Leave Household</DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              Are you sure you want to leave &quot;{selectedHousehold?.name}&quot;? You&apos;ll lose access to all shared data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaveDialogOpen(false)} className="text-[13px]" style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}>Cancel</Button>
            <Button onClick={leaveHousehold} disabled={submitting} className="text-[13px] font-medium" style={{ backgroundColor: 'var(--color-destructive)', color: '#fff' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-1.5" />}
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '1rem', maxWidth: '26rem', boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)' }}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>Rename Household</DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Enter a new name for your household.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="newHouseholdName" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>New Name</Label>
            <Input id="newHouseholdName" name="newHouseholdName" type="text" value={newHouseholdName} onChange={e => setNewHouseholdName(e.target.value)} placeholder="e.g., The Smiths" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRenameDialogOpen(false); setNewHouseholdName(''); }} className="text-[13px]" style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}>Cancel</Button>
            <Button onClick={renameHousehold} disabled={!newHouseholdName.trim() || submitting} className="text-[13px] font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Edit className="w-3.5 h-3.5 mr-1.5" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid color-mix(in oklch, var(--color-destructive) 35%, var(--color-border))', borderRadius: '1rem', maxWidth: '28rem', boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-destructive) 20%, transparent)' }}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-destructive)' }}>Delete Household</DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              This is permanent and cannot be undone. All household data including transactions, budgets, and bills will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="deleteConfirm" className="text-[11px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
              Type <strong style={{ color: 'var(--color-foreground)' }}>&quot;{selectedHousehold?.name}&quot;</strong> to confirm
            </Label>
            <Input id="deleteConfirm" name="deleteConfirm" type="text" value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} placeholder={selectedHousehold?.name} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmName(''); }} className="text-[13px]" style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}>Cancel</Button>
            <Button onClick={deleteHousehold} disabled={deleteConfirmName !== selectedHousehold?.name || submitting} className="text-[13px] font-medium" style={{ backgroundColor: 'var(--color-destructive)', color: '#fff' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Manager */}
      {selectedMemberForPermissions && (
        <PermissionManager
          open={permissionManagerOpen}
          onOpenChange={open => { setPermissionManagerOpen(open); if (!open) setSelectedMemberForPermissions(null); }}
          householdId={householdId}
          memberId={selectedMemberForPermissions.id}
          memberName={selectedMemberForPermissions.name}
          memberRole={selectedMemberForPermissions.role}
          onSave={fetchHouseholdDetails}
        />
      )}
    </div>
  );
}
