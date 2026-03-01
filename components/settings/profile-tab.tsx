'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Mail, Lock, User, CheckCircle2, X } from 'lucide-react';

interface ProfileData {
  name: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  emailVerified: boolean;
  resendIntegrationEnabled?: boolean;
  pendingEmail: string | null;
  id: string;
  image: string | null;
  avatarUrl: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  footer,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
    >
      {/* section header bar */}
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{
          borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)',
          backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)',
          borderLeft: `3px solid ${accent}`,
        }}
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
          {label}
        </span>
      </div>

      {/* section body */}
      <div className="px-4 py-4 space-y-4">{children}</div>

      {/* optional footer row with action buttons */}
      {footer && (
        <div
          className="px-4 py-3 flex items-center justify-end gap-2"
          style={{
            borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
            backgroundColor: 'color-mix(in oklch, var(--color-elevated) 35%, transparent)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  helper,
  id,
  children,
}: {
  label: string;
  helper?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {id ? (
        <Label htmlFor={id} className="text-[11px] font-medium uppercase tracking-wide block" style={{ color: 'var(--color-muted-foreground)' }}>
          {label}
        </Label>
      ) : (
        <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
          {label}
        </p>
      )}
      {children}
      {helper && (
        <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>{helper}</p>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileTab() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [updating, setUpdating] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [resendingVerification, setResendingVerification] = useState(false);
  const [_resendingEmailChange, setResendingEmailChange] = useState(false);
  const [cancelingEmailChange, setCancelingEmailChange] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setProfile(data.profile);
      setName(data.profile.name || '');
      setDisplayName(data.profile.displayName || '');
      setBio(data.profile.bio || '');
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      const res = await fetch('/api/user/resend-verification', { credentials: 'include', method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Verification email sent! Check your inbox.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send email');
    } finally {
      setResendingVerification(false);
    }
  };

  const _handleResendEmailChange = async () => {
    if (!profile?.pendingEmail) return;
    setResendingEmailChange(true);
    try {
      const res = await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: profile.pendingEmail, password: emailPassword }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Verification email resent!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed. Please try changing your email again.');
    } finally {
      setResendingEmailChange(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setCancelingEmailChange(true);
    try {
      const res = await fetch('/api/user/cancel-email-change', { credentials: 'include', method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      await fetchProfile();
      toast.success('Email change canceled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancelingEmailChange(false);
    }
  };

  const handleUpdateProfile = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), displayName: displayName.trim() || null, bio: bio.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      const d = await res.json();
      setProfile(d.profile);
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !emailPassword) { toast.error('Please provide email and password'); return; }
    setUpdatingEmail(true);
    try {
      const res = await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim(), password: emailPassword }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Verification email sent to new address');
      setNewEmail('');
      setEmailPassword('');
      await fetchProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update email');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { toast.error('Fill in all password fields'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setUpdatingPassword(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Avatar skeleton */}
        <div
          className="rounded-xl p-5 flex items-center gap-4"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          <div className="w-16 h-16 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          <div className="space-y-2">
            <div className="w-28 h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="w-20 h-3 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', height: 160, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Avatar ─────────────────────────────────────────────────────────── */}
      {profile && (
        <div
          className="rounded-xl p-5"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          <AvatarUpload
            userId={profile.id}
            userName={profile.name}
            avatarUrl={profile.avatarUrl}
            onAvatarUpdate={newUrl => setProfile({ ...profile, avatarUrl: newUrl })}
          />
        </div>
      )}

      {/* ── Email verification banner ──────────────────────────────────────── */}
      {profile?.resendIntegrationEnabled && !profile.emailVerified && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{
            border: '1px solid color-mix(in oklch, var(--color-warning) 40%, transparent)',
            backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)',
            borderLeft: '3px solid var(--color-warning)',
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--color-foreground)' }}>
              Verify your email address
            </p>
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Check your inbox for the verification link to unlock all features.
            </p>
          </div>
          <Button
            onClick={handleResendVerification}
            disabled={resendingVerification}
            size="sm"
            className="shrink-0 text-[12px] h-7 px-2.5"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-warning) 15%, transparent)',
              color: 'var(--color-warning)',
              border: '1px solid color-mix(in oklch, var(--color-warning) 35%, transparent)',
            }}
          >
            {resendingVerification ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resend'}
          </Button>
        </div>
      )}

      {/* ── Pending email change banner ────────────────────────────────────── */}
      {profile?.pendingEmail && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{
            border: '1px solid color-mix(in oklch, var(--color-primary) 35%, transparent)',
            backgroundColor: 'color-mix(in oklch, var(--color-primary) 7%, transparent)',
            borderLeft: '3px solid var(--color-primary)',
          }}
        >
          <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--color-foreground)' }}>
              Email change pending verification
            </p>
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              A link was sent to <strong style={{ color: 'var(--color-foreground)' }}>{profile.pendingEmail}</strong>. Click it to confirm.
            </p>
          </div>
          <Button
            onClick={handleCancelEmailChange}
            disabled={cancelingEmailChange}
            size="sm"
            variant="ghost"
            className="shrink-0 text-[12px] h-7 px-2.5"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {cancelingEmailChange ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          </Button>
        </div>
      )}

      {/* ── Profile Information ────────────────────────────────────────────── */}
      <Section
        icon={User}
        label="Profile Information"
        footer={
          <Button
            onClick={handleUpdateProfile}
            disabled={updating}
            size="sm"
            className="text-[12px] h-8 px-4 font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            {updating
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
              : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Changes</>
            }
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" id="profile-name">
            <Input
              id="profile-name"
              name="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="h-9 text-[13px]"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
            />
          </Field>
          <Field label="Display Name" helper="How you appear to other members." id="profile-displayName">
            <Input
              id="profile-displayName"
              name="displayName"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Optional nickname"
              className="h-9 text-[13px]"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
            />
          </Field>
        </div>
        <Field label="Bio" id="profile-bio">
          <Input
            id="profile-bio"
            name="bio"
            type="text"
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell us a little about yourself"
            className="h-9 text-[13px]"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          />
        </Field>
      </Section>

      {/* ── Email Address ──────────────────────────────────────────────────── */}
      <Section
        icon={Mail}
        label="Email Address"
        accent="var(--color-primary)"
        footer={
          <Button
            onClick={handleUpdateEmail}
            disabled={updatingEmail || !newEmail || !emailPassword}
            size="sm"
            variant="outline"
            className="text-[12px] h-8 px-4 font-medium"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          >
            {updatingEmail
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Updating…</>
              : 'Update Email'
            }
          </Button>
        }
      >
        {/* Current email display */}
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
          style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}
        >
          <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
          <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--color-foreground)' }}>
            {profile?.email}
          </span>
          {profile?.emailVerified ? (
            <span
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 12%, transparent)', color: 'var(--color-success)' }}
            >
              <CheckCircle2 className="w-2.5 h-2.5" /> Verified
            </span>
          ) : (
            <span
              className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 12%, transparent)', color: 'var(--color-warning)' }}
            >
              Unverified
            </span>
          )}
        </div>

        <form
          onSubmit={e => { e.preventDefault(); handleUpdateEmail(); }}
          className="space-y-4"
        >
          <Field label="New Email" id="newEmail">
            <Input
              id="newEmail"
              name="newEmail"
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              className="h-9 text-[13px]"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              required
            />
          </Field>
          <Field label="Current Password" helper="Required to confirm the email change." id="emailPassword">
            <Input
              id="emailPassword"
              name="emailPassword"
              type="password"
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              placeholder="Your current password"
              className="h-9 text-[13px]"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              required
            />
          </Field>
        </form>
      </Section>

      {/* ── Change Password ────────────────────────────────────────────────── */}
      <Section
        icon={Lock}
        label="Change Password"
        accent="color-mix(in oklch, var(--color-primary) 80%, var(--color-muted-foreground))"
        footer={
          <Button
            onClick={handleChangePassword}
            disabled={updatingPassword || !currentPassword || !newPassword || !confirmPassword}
            size="sm"
            variant="outline"
            className="text-[12px] h-8 px-4 font-medium"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          >
            {updatingPassword
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Changing…</>
              : <><Lock className="w-3.5 h-3.5 mr-1.5" /> Change Password</>
            }
          </Button>
        }
      >
        <form
          onSubmit={e => { e.preventDefault(); handleChangePassword(); }}
          className="space-y-4"
        >
          <Field label="Current Password" id="currentPassword">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="h-9 text-[13px]"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              required
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New Password" id="newPassword">
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="h-9 text-[13px]"
                style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                required
              />
            </Field>
            <Field label="Confirm New Password" id="confirmPassword">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="h-9 text-[13px]"
                style={{
                  backgroundColor: 'var(--color-elevated)',
                  border: confirmPassword && confirmPassword !== newPassword
                    ? '1px solid var(--color-destructive)'
                    : '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
                required
              />
            </Field>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-destructive)' }}>
              <AlertCircle className="w-3 h-3" /> Passwords don&apos;t match
            </p>
          )}
        </form>
      </Section>
    </div>
  );
}
