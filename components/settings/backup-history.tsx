'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Download, Trash2, FileText, AlertCircle, History } from 'lucide-react';
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

function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>{label}</span>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function statusBadge(status: Backup['status']) {
  if (status === 'completed') return (
    <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)' }}>Completed</Badge>
  );
  if (status === 'pending') return (
    <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)' }}>Pending</Badge>
  );
  return (
    <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 15%, transparent)', color: 'var(--color-destructive)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}>Failed</Badge>
  );
}

export function BackupHistory() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBackups = useCallback(async () => {
    if (!selectedHouseholdId) { setLoading(false); return; }
    try {
      setLoading(true);
      const res = await fetch('/api/user/backups?limit=50', { headers: { 'x-household-id': selectedHouseholdId }, credentials: 'include' });
      if (res.ok) { const d = await res.json(); setBackups(d.backups); }
      else { const d = await res.json(); toast.error(d.error?.includes('Household') ? 'Please select a household' : 'Failed to load backup history'); }
    } catch (e) { console.error('Failed to fetch backups:', e); toast.error('Failed to load backup history'); }
    finally { setLoading(false); }
  }, [selectedHouseholdId]);

  useEffect(() => { if (selectedHouseholdId) fetchBackups(); }, [selectedHouseholdId, fetchBackups]);

  async function downloadBackup(backup: Backup) {
    try {
      const res = await fetch(`/api/user/backups/${backup.id}/download`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to download backup');
      const cd = res.headers.get('Content-Disposition');
      let filename = backup.filename;
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m) filename = m[1]; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success('Backup downloaded');
    } catch (e) { console.error('Failed to download backup:', e); toast.error('Failed to download backup'); }
  }

  async function deleteBackup() {
    if (!backupToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/user/backups/${backupToDelete.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Backup deleted'); setDeleteDialogOpen(false); setBackupToDelete(null); fetchBackups(); }
      else { const d = await res.json(); toast.error(d.error || 'Failed to delete backup'); }
    } catch (e) { console.error('Failed to delete backup:', e); toast.error('Failed to delete backup'); }
    finally { setDeleting(false); }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(ds: string) {
    try { return new Date(ds).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch { return 'Invalid date'; }
  }

  if (!selectedHouseholdId) {
    return (
      <div className="rounded-xl px-4 py-6 text-center text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}>
        Please select a household to view backup history.
      </div>
    );
  }

  if (loading) {
    return (
      <Section icon={History} label="Backup History">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)', animationDelay: `${i * 60}ms` }} />)}
        </div>
      </Section>
    );
  }

  if (backups.length === 0) {
    return (
      <Section icon={History} label="Backup History">
        <div className="flex flex-col items-center py-8 text-center gap-2">
          <FileText className="w-8 h-8" style={{ color: 'var(--color-muted-foreground)', opacity: 0.5 }} />
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>No Backups Yet</p>
          <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Backups will appear here once created.</p>
        </div>
      </Section>
    );
  }

  return (
    <>
      <Section icon={History} label="Backup History">
        <div className="divide-y rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {backups.map(backup => (
            <div key={backup.id} className="flex items-center gap-3 px-3 py-2.5 group" style={{ backgroundColor: 'var(--color-elevated)' }}>
              <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{backup.filename}</span>
                  {statusBadge(backup.status)}
                </div>
                <div className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                  <span>{formatFileSize(backup.fileSize)}</span>
                  <span>·</span>
                  <span className="uppercase">{backup.format}</span>
                  <span>·</span>
                  <span>{formatDate(backup.createdAt)}</span>
                </div>
                {backup.status === 'failed' && backup.errorMessage && (
                  <div className="flex items-center gap-1 mt-0.5 text-[11px]" style={{ color: 'var(--color-destructive)' }}>
                    <AlertCircle className="w-3 h-3" />
                    {backup.errorMessage}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {backup.status === 'completed' && (
                  <Button variant="ghost" size="sm" onClick={() => downloadBackup(backup)} className="h-7 w-7 p-0">
                    <Download className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setBackupToDelete(backup); setDeleteDialogOpen(true); }} className="h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--color-destructive)' }} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Delete Backup?</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {backupToDelete && (
            <div className="py-2 space-y-0.5">
              <p className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{backupToDelete.filename}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Created: {formatDate(backupToDelete.createdAt)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDeleteDialogOpen(false); setBackupToDelete(null); }} disabled={deleting} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={deleteBackup} disabled={deleting} className="text-[12px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
