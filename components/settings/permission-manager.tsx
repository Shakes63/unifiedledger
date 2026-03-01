'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Info, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type {
  HouseholdPermission,
  CustomPermissions,
  HouseholdRole,
} from '@/lib/household/permissions';

interface PermissionInfo {
  name: HouseholdPermission;
  label: string;
  description: string;
  category: string;
}

const PERMISSION_INFO: PermissionInfo[] = [
  // Membership
  {
    name: 'invite_members',
    label: 'Invite Members',
    description: 'Send invitations to join the household',
    category: 'Membership',
  },
  {
    name: 'remove_members',
    label: 'Remove Members',
    description: 'Remove members from the household',
    category: 'Membership',
  },
  {
    name: 'manage_permissions',
    label: 'Manage Permissions',
    description: 'Modify custom permissions for members',
    category: 'Membership',
  },
  // Accounts
  {
    name: 'create_accounts',
    label: 'Create Accounts',
    description: 'Create new financial accounts',
    category: 'Accounts',
  },
  {
    name: 'edit_accounts',
    label: 'Edit Accounts',
    description: 'Modify existing account details',
    category: 'Accounts',
  },
  {
    name: 'delete_accounts',
    label: 'Delete Accounts',
    description: 'Remove accounts from the household',
    category: 'Accounts',
  },
  // Transactions
  {
    name: 'create_transactions',
    label: 'Create Transactions',
    description: 'Add new income, expense, or transfer transactions',
    category: 'Transactions',
  },
  {
    name: 'edit_all_transactions',
    label: 'Edit All Transactions',
    description: 'Modify any transaction (not just own)',
    category: 'Transactions',
  },
  // Data
  {
    name: 'view_all_data',
    label: 'View All Data',
    description: 'Access all household financial data',
    category: 'Data',
  },
  // Budget
  {
    name: 'manage_budget',
    label: 'Manage Budget',
    description: 'Create and modify budget categories and periods',
    category: 'Budget',
  },
  // Household
  {
    name: 'delete_household',
    label: 'Delete Household',
    description: 'Permanently delete the household',
    category: 'Household',
  },
  {
    name: 'leave_household',
    label: 'Leave Household',
    description: 'Leave the household (owners cannot leave)',
    category: 'Household',
  },
];

interface PermissionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  memberId: string;
  memberName: string;
  memberRole: HouseholdRole;
  onSave?: () => void;
}

interface PermissionData {
  role: HouseholdRole;
  rolePermissions: Record<HouseholdPermission, boolean>;
  customPermissions: CustomPermissions | null;
  effectivePermissions: Record<HouseholdPermission, boolean>;
}

export function PermissionManager({
  open,
  onOpenChange,
  householdId,
  memberId,
  memberName,
  memberRole,
  onSave,
}: PermissionManagerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissionData, setPermissionData] = useState<PermissionData | null>(null);
  const [pendingChanges, setPendingChanges] = useState<CustomPermissions>({});
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/households/${householdId}/members/${memberId}/permissions`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to load permissions');
        return;
      }

      const data: PermissionData = await response.json();
      setPermissionData(data);
      setPendingChanges(data.customPermissions || {});
    } catch (error) {
      toast.error('Failed to load permissions');
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [householdId, memberId]);

  // Fetch permissions when dialog opens
  useEffect(() => {
    if (open && householdId && memberId) {
      fetchPermissions();
    } else {
      // Reset state when dialog closes
      setPermissionData(null);
      setPendingChanges({});
      setHasChanges(false);
    }
  }, [open, householdId, memberId, fetchPermissions]);

  function toggleCustomPermission(permission: HouseholdPermission) {
    if (!permissionData) return;

    const roleDefault = permissionData.rolePermissions[permission];
    const currentCustom = pendingChanges[permission];
    const currentEffective = currentCustom !== undefined ? currentCustom : roleDefault;

    // Toggle the effective permission
    const newEffective = !currentEffective;

    // If new effective matches role default, remove custom override
    if (newEffective === roleDefault) {
      const newPending = { ...pendingChanges };
      delete newPending[permission];
      setPendingChanges(newPending);
      setHasChanges(
        JSON.stringify(newPending) !== JSON.stringify(permissionData.customPermissions || {})
      );
    } else {
      // Set custom override
      const newPending = { ...pendingChanges, [permission]: newEffective };
      setPendingChanges(newPending);
      setHasChanges(
        JSON.stringify(newPending) !== JSON.stringify(permissionData.customPermissions || {})
      );
    }
  }

  function _resetToDefaults() {
    if (!permissionData) return;
    setPendingChanges({});
    setHasChanges(false);
  }

  async function handleSave() {
    if (!permissionData) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/households/${householdId}/members/${memberId}/permissions`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ permissions: pendingChanges }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to save permissions');
        return;
      }

      toast.success('Permissions updated successfully');
      await fetchPermissions(); // Refresh data
      onSave?.();
    } catch (error) {
      toast.error('Failed to save permissions');
      console.error('Error saving permissions:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!permissionData) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/households/${householdId}/members/${memberId}/permissions`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to reset permissions');
        return;
      }

      toast.success('Permissions reset to role defaults');
      await fetchPermissions(); // Refresh data
      onSave?.();
    } catch (error) {
      toast.error('Failed to reset permissions');
      console.error('Error resetting permissions:', error);
    } finally {
      setSaving(false);
    }
  }

  // Group permissions by category
  const permissionsByCategory = PERMISSION_INFO.reduce(
    (acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    },
    {} as Record<string, PermissionInfo[]>
  );

  // Check for security warnings
  const hasManagePermissionsOverride =
    pendingChanges.manage_permissions === false && memberRole === 'admin';
  const hasCustomPermissions = Object.keys(pendingChanges).length > 0;

  if (memberRole === 'owner') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
              <Shield className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              Manage Permissions
            </DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              {memberName} · Owner
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 px-3 py-3 rounded-xl mt-1" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
            <div>
              <p className="text-[13px] font-medium mb-0.5" style={{ color: 'var(--color-foreground)' }}>Owners cannot have custom permissions</p>
              <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Owners always have all permissions and cannot be modified.</p>
            </div>
          </div>
          <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="h-9 text-[13px]">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}>
              <Shield className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
            </div>
            Manage Permissions
          </DialogTitle>
          <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
            {memberName} · {memberRole.charAt(0).toUpperCase() + memberRole.slice(1)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[13px]">Loading permissions…</span>
          </div>
        ) : !permissionData ? (
          <div className="text-center py-10 text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Failed to load permissions</div>
        ) : (
          <div className="space-y-4 mt-1">
            {hasManagePermissionsOverride && (
              <div className="flex items-start gap-3 px-3 py-3 rounded-xl" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)' }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-destructive)' }} />
                <div>
                  <p className="text-[13px] font-medium mb-0.5" style={{ color: 'var(--color-foreground)' }}>Security Warning</p>
                  <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Removing &quot;Manage Permissions&quot; from an admin may prevent them from managing other members. Ensure at least one other admin or owner retains this permission.</p>
                </div>
              </div>
            )}

            {Object.entries(permissionsByCategory).map(([category, permissions]) => (
              <div key={category}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-muted-foreground)' }}>{category}</p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
                  {permissions.map((permInfo, idx) => {
                    const roleDefault = permissionData.rolePermissions[permInfo.name];
                    const customOverride = pendingChanges[permInfo.name];
                    const effective = customOverride !== undefined ? customOverride : roleDefault;
                    const hasOverride = customOverride !== undefined;

                    return (
                      <div key={permInfo.name} className="flex items-center justify-between px-4 py-3 gap-4"
                        style={{ borderTop: idx > 0 ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none' }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Label htmlFor={`perm-${permInfo.name}`} className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--color-foreground)' }}>
                              {permInfo.label}
                            </Label>
                            {hasOverride && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)' }}>Custom</span>
                            )}
                          </div>
                          <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{permInfo.description}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>Role default:</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{
                              backgroundColor: roleDefault ? 'color-mix(in oklch, var(--color-success) 12%, transparent)' : 'color-mix(in oklch, var(--color-destructive) 10%, transparent)',
                              color: roleDefault ? 'var(--color-success)' : 'var(--color-destructive)'
                            }}>{roleDefault ? 'Allowed' : 'Denied'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <p className="text-[11px] font-medium" style={{ color: effective ? 'var(--color-success)' : 'var(--color-muted-foreground)' }}>{effective ? 'Allowed' : 'Denied'}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>{hasOverride ? 'Custom' : 'Default'}</p>
                          </div>
                          <Switch id={`perm-${permInfo.name}`} checked={effective} onCheckedChange={() => toggleCustomPermission(permInfo.name)} className="data-[state=checked]:bg-success" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-3 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          {hasCustomPermissions && (
            <Button onClick={handleReset} variant="outline" disabled={saving || loading} className="sm:mr-auto h-9 text-[13px]">
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Resetting…</> : 'Reset to Role Defaults'}
            </Button>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button onClick={() => onOpenChange(false)} variant="outline" disabled={saving} className="h-9 text-[13px]">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || loading || !hasChanges} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

