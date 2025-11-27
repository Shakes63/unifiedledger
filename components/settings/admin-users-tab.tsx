'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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

interface User {
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
  users: User[];
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

export function AdminUsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [householdsLoading, setHouseholdsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state for create/edit
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formHouseholdId, setFormHouseholdId] = useState<string>('');
  const [formRole, setFormRole] = useState<string>('member');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
    fetchHouseholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, offset: 0 })); // Reset to first page on search
      fetchUsers(searchQuery, 0);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function fetchUsers(search?: string, offsetOverride?: number) {
    try {
      setLoading(true);
      const currentOffset = offsetOverride !== undefined ? offsetOverride : pagination.offset;
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: currentOffset.toString(),
      });
      if (search) params.append('search', search);

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Access denied: Owner access required');
          return;
        }
        throw new Error('Failed to fetch users');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setPagination((prev) => ({ ...prev, total: data.total }));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function fetchHouseholds() {
    try {
      setHouseholdsLoading(true);
      const response = await fetch('/api/admin/households', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Access denied: Owner access required');
          return;
        }
        throw new Error('Failed to fetch households');
      }

      const data: HouseholdsResponse = await response.json();
      setHouseholds(data.households);
    } catch (error) {
      console.error('Error fetching households:', error);
      toast.error('Failed to load households');
    } finally {
      setHouseholdsLoading(false);
    }
  }

  function validateForm(isEdit = false): boolean {
    const errors: Record<string, string> = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formEmail || !emailRegex.test(formEmail)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation (only for create)
    if (!isEdit && (!formPassword || formPassword.length < 8)) {
      errors.password = 'Password must be at least 8 characters';
    }

    // Role validation (if household selected)
    if (formHouseholdId && !formRole) {
      errors.role = 'Please select a role';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function resetForm() {
    setFormEmail('');
    setFormPassword('');
    setFormName('');
    setFormHouseholdId('');
    setFormRole('member');
    setFormErrors({});
  }

  function handleCreateClick() {
    resetForm();
    setCreateDialogOpen(true);
  }

  function handleEditClick(user: User) {
    setSelectedUser(user);
    setFormEmail(user.email);
    setFormName(user.name || '');
    setFormPassword(''); // Don't pre-fill password
    setFormHouseholdId(''); // TODO: Fetch user's household assignment
    setFormRole('member');
    setFormErrors({});
    setEditDialogOpen(true);
  }

  function handleDeleteClick(user: User) {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  }

  async function handleCreate() {
    if (!validateForm(false)) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formEmail,
          password: formPassword,
          name: formName || undefined,
          householdId: formHouseholdId || undefined,
          role: formHouseholdId ? formRole : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create user');
      }

      toast.success('User created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchUsers(searchQuery);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!selectedUser || !validateForm(true)) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formEmail,
          name: formName || undefined,
          householdId: formHouseholdId || null,
          role: formHouseholdId ? formRole : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update user');
      }

      toast.success('User updated successfully');
      setEditDialogOpen(false);
      resetForm();
      setSelectedUser(null);
      fetchUsers(searchQuery);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete user');
      }

      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers(searchQuery);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePageChange(newOffset: number) {
    setPagination((prev) => ({ ...prev, offset: newOffset }));
    fetchUsers(searchQuery, newOffset);
  }

  const _RoleIcon = formRole ? ROLE_ICONS[formRole] || User : User;

  return (
    <div className="space-y-6">
      {/* Header with Search and Create Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-border text-foreground"
            />
          </div>
        </div>
        <Button
          onClick={handleCreateClick}
          className="bg-[var(--color-primary)] hover:opacity-90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create User
        </Button>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No users found matching your search' : 'No users found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Created</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Households</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border hover:bg-card/50 transition-all"
                  >
                    <td className="py-3 px-4 text-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]" title={user.email}>
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {user.name || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="bg-elevated text-muted-foreground">
                        <Home className="w-3 h-3 mr-1" />
                        {user.householdCount}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(user)}
                          className="bg-elevated border-border text-foreground hover:bg-elevated"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(user)}
                          className="bg-elevated border-border text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} users
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                  disabled={pagination.offset === 0}
                  className="border-border text-foreground"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="border-border text-foreground"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create New User</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a user account and optionally assign them to a household
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-email" className="text-foreground">
                Email <span className="text-[var(--color-error)]">*</span>
              </Label>
              <Input
                id="create-email"
                type="email"
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="user@example.com"
                className={`bg-background border-border text-foreground ${
                  formErrors.email ? 'border-[var(--color-error)]' : ''
                }`}
              />
              {formErrors.email && (
                <p className="text-sm text-[var(--color-error)]">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-password" className="text-foreground">
                Password <span className="text-[var(--color-error)]">*</span>
              </Label>
              <Input
                id="create-password"
                type="password"
                value={formPassword}
                onChange={(e) => {
                  setFormPassword(e.target.value);
                  if (formErrors.password) setFormErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Minimum 8 characters"
                className={`bg-background border-border text-foreground ${
                  formErrors.password ? 'border-[var(--color-error)]' : ''
                }`}
              />
              {formErrors.password && (
                <p className="text-sm text-[var(--color-error)]">{formErrors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-name" className="text-foreground">
                Name (Optional)
              </Label>
              <Input
                id="create-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Display name"
                className="bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-household" className="text-foreground">
                Household (Optional)
              </Label>
              <Select
                value={formHouseholdId}
                onValueChange={(value) => {
                  setFormHouseholdId(value);
                  if (!value) setFormRole('member');
                  if (formErrors.role) setFormErrors((prev) => ({ ...prev, role: '' }));
                }}
                disabled={householdsLoading}
              >
                <SelectTrigger
                  id="create-household"
                  className="bg-background border-border text-foreground"
                >
                  <SelectValue placeholder={householdsLoading ? 'Loading...' : 'Select household (optional)'} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {households.map((household) => (
                    <SelectItem
                      key={household.id}
                      value={household.id}
                      className="text-foreground"
                    >
                      {household.name} ({household.memberCount} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formHouseholdId && (
              <div className="space-y-2">
                <Label htmlFor="create-role" className="text-foreground">
                  Role <span className="text-[var(--color-error)]">*</span>
                </Label>
                <Select
                  value={formRole}
                  onValueChange={(value) => {
                    setFormRole(value);
                    if (formErrors.role) setFormErrors((prev) => ({ ...prev, role: '' }));
                  }}
                >
                  <SelectTrigger
                    id="create-role"
                    className="bg-background border-border text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => {
                      const Icon = ROLE_ICONS[value] || User;
                      return (
                        <SelectItem
                          key={value}
                          value={value}
                          className="text-foreground"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {formErrors.role && (
                  <p className="text-sm text-[var(--color-error)]">{formErrors.role}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-[var(--color-primary)] hover:opacity-90 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit User</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update user details and household assignment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-foreground">
                Email <span className="text-[var(--color-error)]">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: '' }));
                }}
                className={`bg-background border-border text-foreground ${
                  formErrors.email ? 'border-[var(--color-error)]' : ''
                }`}
              />
              {formErrors.email && (
                <p className="text-sm text-[var(--color-error)]">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-foreground">
                Name (Optional)
              </Label>
              <Input
                id="edit-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Display name"
                className="bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-household" className="text-foreground">
                Household (Optional)
              </Label>
              <Select
                value={formHouseholdId}
                onValueChange={(value) => {
                  setFormHouseholdId(value);
                  if (!value) setFormRole('member');
                  if (formErrors.role) setFormErrors((prev) => ({ ...prev, role: '' }));
                }}
                disabled={householdsLoading}
              >
                <SelectTrigger
                  id="edit-household"
                  className="bg-background border-border text-foreground"
                >
                  <SelectValue placeholder={householdsLoading ? 'Loading...' : 'Select household (optional)'} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="" className="text-foreground">
                    None
                  </SelectItem>
                  {households.map((household) => (
                    <SelectItem
                      key={household.id}
                      value={household.id}
                      className="text-foreground"
                    >
                      {household.name} ({household.memberCount} members)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formHouseholdId && (
              <div className="space-y-2">
                <Label htmlFor="edit-role" className="text-foreground">
                  Role <span className="text-[var(--color-error)]">*</span>
                </Label>
                <Select
                  value={formRole}
                  onValueChange={(value) => {
                    setFormRole(value);
                    if (formErrors.role) setFormErrors((prev) => ({ ...prev, role: '' }));
                  }}
                >
                  <SelectTrigger
                    id="edit-role"
                    className="bg-background border-border text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(ROLE_LABELS).map(([value, label]) => {
                      const Icon = ROLE_ICONS[value] || User;
                      return (
                        <SelectItem
                          key={value}
                          value={value}
                          className="text-foreground"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {formErrors.role && (
                  <p className="text-sm text-[var(--color-error)]">{formErrors.role}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                resetForm();
                setSelectedUser(null);
              }}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={submitting}
              className="bg-[var(--color-primary)] hover:opacity-90 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete User</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-foreground mb-2">
              <strong>Email:</strong> {selectedUser?.email}
            </p>
            {selectedUser?.name && (
              <p className="text-foreground mb-4">
                <strong>Name:</strong> {selectedUser.name}
              </p>
            )}
            <div className="p-4 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 rounded-lg">
              <p className="text-sm text-foreground">
                This will permanently delete the user account and remove them from all households.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedUser(null);
              }}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={submitting}
              className="bg-[var(--color-error)] hover:opacity-90 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

