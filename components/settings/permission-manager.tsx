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
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
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
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Manage Permissions</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {memberName} ({memberRole})
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
              <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">
                <p className="font-medium mb-1">Owners cannot have custom permissions</p>
                <p className="text-muted-foreground">
                  Owners always have all permissions and cannot be modified.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="border-border text-foreground"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Manage Permissions</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {memberName} ({memberRole.charAt(0).toUpperCase() + memberRole.slice(1)})
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading permissions...
          </div>
        ) : !permissionData ? (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load permissions
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Security Warning */}
            {hasManagePermissionsOverride && (
              <div className="flex items-start gap-3 p-4 bg-error/10 border border-error/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                  <p className="font-medium mb-1">Security Warning</p>
                  <p className="text-muted-foreground">
                    Removing &quot;Manage Permissions&quot; from an admin may prevent them from managing
                    other members. Ensure at least one other admin or owner retains this
                    permission.
                  </p>
                </div>
              </div>
            )}

            {/* Permission Groups */}
            {Object.entries(permissionsByCategory).map(([category, permissions]) => (
              <div key={category} className="space-y-3">
                <h4 className="font-semibold text-foreground text-sm uppercase tracking-wide">
                  {category}
                </h4>
                <Card className="bg-elevated border-border p-4 space-y-4">
                  {permissions.map((permInfo) => {
                    const roleDefault = permissionData.rolePermissions[permInfo.name];
                    const customOverride = pendingChanges[permInfo.name];
                    const effective =
                      customOverride !== undefined ? customOverride : roleDefault;
                    const hasOverride = customOverride !== undefined;

                    return (
                      <div
                        key={permInfo.name}
                        className="flex items-start justify-between gap-4 pb-4 last:pb-0 border-b border-border last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Label
                              htmlFor={`perm-${permInfo.name}`}
                              className="font-medium text-foreground cursor-pointer"
                            >
                              {permInfo.label}
                            </Label>
                            {hasOverride && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-warning/10 text-warning border-warning/30"
                              >
                                Custom
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {permInfo.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Role default:</span>
                            <Badge
                              variant="outline"
                              className={
                                roleDefault
                                  ? 'bg-success/10 text-success border-success/30'
                                  : 'bg-error/10 text-error border-error/30'
                              }
                            >
                              {roleDefault ? 'Allowed' : 'Denied'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-medium text-foreground mb-1">
                              {effective ? 'Allowed' : 'Denied'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {hasOverride ? 'Custom' : 'Default'}
                            </div>
                          </div>
                          <Switch
                            id={`perm-${permInfo.name}`}
                            checked={effective}
                            onCheckedChange={() => toggleCustomPermission(permInfo.name)}
                            className="data-[state=checked]:bg-success"
                          />
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasCustomPermissions && (
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={saving || loading}
              className="border-border text-muted-foreground hover:text-foreground sm:mr-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset to Role Defaults'
              )}
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              disabled={saving}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading || !hasChanges}
              className="bg-primary text-white hover:opacity-90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

