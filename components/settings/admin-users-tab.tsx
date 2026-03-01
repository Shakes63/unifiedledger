'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  Mail,
  Calendar,
  Home,
  Shield,
  Crown,
  Eye,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  householdCount: number;
}

interface Household {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
}

interface UsersResponse {
  users: UserRecord[];
  total: number;
  limit: number;
  offset: number;
}

interface HouseholdsResponse {
  households: Household[];
  total: number;
  limit: number;
  offset: number;
}

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };
const ROLE_ICONS: Record<string, typeof Shield> = { owner: Crown, admin: Shield, member: User, viewer: Eye };

// ── Section helper ────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  headerRight,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest flex-1" style={{ color: accent }}>{label}</span>
        {headerRight}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ── FormField helper ──────────────────────────────────────────────────────────
function FormField({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--color-destructive)' }}> *</span>}
      </p>
      {children}
      {error && <p className="text-[11px]" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminUsersTab() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [householdsLoading, setHouseholdsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formHouseholdId, setFormHouseholdId] = useState<string>('');
  const [formRole, setFormRole] = useState<string>('member');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { fetchUsers(); fetchHouseholds(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const t = setTimeout(() => { setPagination(p => ({ ...p, offset: 0 })); fetchUsers(searchQuery, 0); }, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [searchQuery]);

  async function fetchUsers(search?: string, offsetOverride?: number) {
    try {
      setLoading(true);
      const offset = offsetOverride !== undefined ? offsetOverride : pagination.offset;
      const params = new URLSearchParams({ limit: pagination.limit.toString(), offset: offset.toString() });
      if (search) params.append('search', search);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!res.ok) { if (res.status === 403) toast.error('Access denied: Owner access required'); else throw new Error(); return; }
      const d: UsersResponse = await res.json();
      setUsers(d.users);
      setPagination(p => ({ ...p, total: d.total }));
    } catch (e) { console.error('Error fetching users:', e); toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }

  async function fetchHouseholds() {
    try {
      setHouseholdsLoading(true);
      const res = await fetch('/api/admin/households', { credentials: 'include' });
      if (!res.ok) { if (res.status === 403) toast.error('Access denied: Owner access required'); return; }
      const d: HouseholdsResponse = await res.json();
      setHouseholds(d.households);
    } catch (e) { console.error('Error fetching households:', e); toast.error('Failed to load households'); }
    finally { setHouseholdsLoading(false); }
  }

  function validateForm(isEdit = false) {
    const errors: Record<string, string> = {};
    if (!formEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) errors.email = 'Please enter a valid email address';
    if (!isEdit && (!formPassword || formPassword.length < 8)) errors.password = 'Password must be at least 8 characters';
    if (formHouseholdId && !formRole) errors.role = 'Please select a role';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function resetForm() { setFormEmail(''); setFormPassword(''); setFormName(''); setFormHouseholdId(''); setFormRole('member'); setFormErrors({}); }
  function handleCreateClick() { resetForm(); setCreateDialogOpen(true); }
  function handleEditClick(user: UserRecord) { setSelectedUser(user); setFormEmail(user.email); setFormName(user.name || ''); setFormPassword(''); setFormHouseholdId(''); setFormRole('member'); setFormErrors({}); setEditDialogOpen(true); }
  function handleDeleteClick(user: UserRecord) { setSelectedUser(user); setDeleteDialogOpen(true); }

  async function handleCreate() {
    if (!validateForm(false)) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: formEmail, password: formPassword, name: formName || undefined, householdId: formHouseholdId || undefined, role: formHouseholdId ? formRole : undefined }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to create user'); }
      toast.success('User created'); setCreateDialogOpen(false); resetForm(); fetchUsers(searchQuery);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to create user'); }
    finally { setSubmitting(false); }
  }

  async function handleUpdate() {
    if (!selectedUser || !validateForm(true)) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: formEmail, name: formName || undefined, householdId: formHouseholdId || null, role: formHouseholdId ? formRole : undefined }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to update user'); }
      toast.success('User updated'); setEditDialogOpen(false); resetForm(); setSelectedUser(null); fetchUsers(searchQuery);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update user'); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to delete user'); }
      toast.success('User deleted'); setDeleteDialogOpen(false); setSelectedUser(null); fetchUsers(searchQuery);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to delete user'); }
    finally { setSubmitting(false); }
  }

  function handlePageChange(offset: number) { setPagination(p => ({ ...p, offset })); fetchUsers(searchQuery, offset); }

  const sel = (id: string) => ({ id, name: id, className: 'h-9 text-[13px]', style: { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' } });

  const UserFormFields = ({ isEdit = false }) => (
    <div className="space-y-3 py-2">
      <FormField label="Email" error={formErrors.email} required>
        <Input id={`${isEdit ? 'edit' : 'create'}-email`} type="email" value={formEmail} onChange={e => { setFormEmail(e.target.value); if (formErrors.email) setFormErrors(p => ({ ...p, email: '' })); }}
          placeholder="user@example.com" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: formErrors.email ? 'var(--color-destructive)' : 'var(--color-border)' }} />
      </FormField>
      {!isEdit && (
        <FormField label="Password" error={formErrors.password} required>
          <Input id="create-password" type="password" value={formPassword} onChange={e => { setFormPassword(e.target.value); if (formErrors.password) setFormErrors(p => ({ ...p, password: '' })); }}
            placeholder="Minimum 8 characters" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: formErrors.password ? 'var(--color-destructive)' : 'var(--color-border)' }} />
        </FormField>
      )}
      <FormField label="Name (optional)">
        <Input id={`${isEdit ? 'edit' : 'create'}-name`} type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Display name" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
      </FormField>
      <FormField label="Household (optional)">
        <Select value={formHouseholdId} onValueChange={v => { setFormHouseholdId(v); if (!v) setFormRole('member'); }} disabled={householdsLoading}>
          <SelectTrigger {...sel(`${isEdit ? 'edit' : 'create'}-household`)} aria-label="Select household">
            <SelectValue placeholder={householdsLoading ? 'Loading…' : 'Select household (optional)'} />
          </SelectTrigger>
          <SelectContent>
            {isEdit && <SelectItem value="">None</SelectItem>}
            {households.map(h => <SelectItem key={h.id} value={h.id}>{h.name} <span style={{ opacity: 0.6 }}>· {h.memberCount} members</span></SelectItem>)}
          </SelectContent>
        </Select>
      </FormField>
      {formHouseholdId && (
        <FormField label="Role" error={formErrors.role} required>
          <Select value={formRole} onValueChange={v => { setFormRole(v); if (formErrors.role) setFormErrors(p => ({ ...p, role: '' })); }}>
            <SelectTrigger {...sel(`${isEdit ? 'edit' : 'create'}-role`)} aria-label="Select role"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABELS).map(([value, label]) => {
                const Icon = ROLE_ICONS[value] || User;
                return <SelectItem key={value} value={value}><span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" />{label}</span></SelectItem>;
              })}
            </SelectContent>
          </Select>
        </FormField>
      )}
    </div>
  );

  return (
    <Section
      icon={Users}
      label={`Users${pagination.total > 0 ? ` (${pagination.total})` : ''}`}
      accent="var(--color-primary)"
      headerRight={
        <Button size="sm" onClick={handleCreateClick} className="h-6 text-[11px] px-2.5" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
          <Plus className="w-3 h-3 mr-1" />Create
        </Button>
      }
    >
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
        <Input type="text" placeholder="Search by email or name…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
      </div>

      {/* Users list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)', animationDelay: `${i * 60}ms` }} />)}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2">
          <Users className="w-8 h-8" style={{ color: 'var(--color-muted-foreground)', opacity: 0.4 }} />
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>{searchQuery ? 'No users found matching your search' : 'No users found'}</p>
        </div>
      ) : (
        <>
          <div className="divide-y rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-2.5 px-3 py-2.5 group" style={{ backgroundColor: 'var(--color-elevated)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {user.name && <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{user.name}</span>}
                    <span className="text-[12px] flex items-center gap-1 truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                      <Mail className="w-3 h-3 shrink-0" />{user.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(user.createdAt)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Home className="w-3 h-3" />{user.householdCount} households</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(user)} className="h-7 w-7 p-0">
                    <Edit className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(user)} className="h-7 w-7 p-0">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--color-destructive)' }} />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                {pagination.offset + 1}–{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))} disabled={pagination.offset === 0} className="h-7 text-[11px]">Prev</Button>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.offset + pagination.limit)} disabled={pagination.offset + pagination.limit >= pagination.total} className="h-7 text-[11px]">Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Create Dialog ───────────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Create New User</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>Create a user account and optionally assign them to a household.</DialogDescription>
          </DialogHeader>
          <UserFormFields isEdit={false} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCreateDialogOpen(false); resetForm(); }} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={submitting} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Edit User</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>Update user details and household assignment.</DialogDescription>
          </DialogHeader>
          <UserFormFields isEdit={true} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setEditDialogOpen(false); resetForm(); setSelectedUser(null); }} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={handleUpdate} disabled={submitting} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ───────────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Delete User?</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-2 space-y-1.5">
              <p className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{selectedUser.email}</p>
              {selectedUser.name && <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>{selectedUser.name}</p>}
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg mt-2" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
                <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  This will permanently delete the user account and remove them from all households.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDeleteDialogOpen(false); setSelectedUser(null); }} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={handleDelete} disabled={submitting} className="text-[12px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
