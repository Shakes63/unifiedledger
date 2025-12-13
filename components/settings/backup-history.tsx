'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Trash2, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';

interface Backup {
  id: string;
  filename: string;
  fileSize: number;
  format: 'json' | 'csv';
  status: 'pending' | 'completed' | 'failed';
  errorMessage: string | null;
  createdAt: string;
}

export function BackupHistory() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBackups = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/user/backups?limit=50', {
        headers: {
          'x-household-id': selectedHouseholdId,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups);
      } else {
        const errorData = await response.json();
        if (errorData.error?.includes('Household')) {
          toast.error('Please select a household');
        } else {
          toast.error('Failed to load backup history');
        }
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
      toast.error('Failed to load backup history');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId]);

  useEffect(() => {
    if (selectedHouseholdId) {
      fetchBackups();
    }
  }, [selectedHouseholdId, fetchBackups]);

  async function downloadBackup(backup: Backup) {
    try {
      const response = await fetch(`/api/user/backups/${backup.id}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download backup');
      }

      // Get filename from Content-Disposition header or use backup filename
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = backup.filename;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Backup downloaded successfully');
    } catch (error) {
      console.error('Failed to download backup:', error);
      toast.error('Failed to download backup');
    }
  }

  async function deleteBackup() {
    if (!backupToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/user/backups/${backupToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Backup deleted successfully');
        setDeleteDialogOpen(false);
        setBackupToDelete(null);
        fetchBackups(); // Refresh list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete backup');
      }
    } catch (error) {
      console.error('Failed to delete backup:', error);
      toast.error('Failed to delete backup');
    } finally {
      setDeleting(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  }

  function getStatusBadge(status: Backup['status']) {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-success text-white">Completed</Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-warning text-white">Pending</Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-error text-white">Failed</Badge>
        );
    }
  }

  if (!selectedHouseholdId) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Please select a household to view backup history</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading backup history...
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Backups Yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Your first backup will appear here once automatic backups are enabled and run, or when
          you create a manual backup.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backups.map((backup) => (
        <Card key={backup.id} className="p-4 bg-elevated border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground truncate">{backup.filename}</span>
                {getStatusBadge(backup.status)}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{formatFileSize(backup.fileSize)}</span>
                <span>•</span>
                <span className="uppercase">{backup.format}</span>
                <span>•</span>
                <span>{formatDate(backup.createdAt)}</span>
              </div>
              {backup.status === 'failed' && backup.errorMessage && (
                <div className="mt-2 flex items-start gap-2 text-sm text-error">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{backup.errorMessage}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {backup.status === 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadBackup(backup)}
                  className="border-border"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBackupToDelete(backup);
                  setDeleteDialogOpen(true);
                }}
                className="border-border text-error hover:bg-error/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Backup</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this backup? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {backupToDelete && (
            <div className="py-4">
              <div className="text-sm text-foreground">
                <strong>File:</strong> {backupToDelete.filename}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Created: {formatDate(backupToDelete.createdAt)}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setBackupToDelete(null);
              }}
              className="border-border"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteBackup}
              className="bg-error hover:bg-error/90"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

