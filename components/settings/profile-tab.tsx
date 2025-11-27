'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';

interface ProfileData {
  name: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  id: string;
  image: string | null;
}

export function ProfileTab() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [updating, setUpdating] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Email verification state
  const [resendingVerification, setResendingVerification] = useState(false);

  // Pending email change state
  const [_resendingEmailChange, setResendingEmailChange] = useState(false);
  const [cancelingEmailChange, setCancelingEmailChange] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch profile');

      const data = await response.json();
      setProfile(data.profile);
      setName(data.profile.name || '');
      setDisplayName(data.profile.displayName || '');
      setBio(data.profile.bio || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      const response = await fetch('/api/user/resend-verification', { credentials: 'include', method: 'POST', });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send verification email');
      }

      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      console.error('Error resending verification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setResendingVerification(false);
    }
  };

  const _handleResendEmailChange = async () => {
    if (!profile?.pendingEmail) return;

    setResendingEmailChange(true);
    try {
      // Resend by initiating the email change again with the pending email
      const response = await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: profile.pendingEmail,
          password: emailPassword, // User will need to re-enter password
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend verification email');
      }

      toast.success('Verification email resent! Check your inbox.');
    } catch (error) {
      console.error('Error resending email change verification:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resend email. Please try changing your email again.');
    } finally {
      setResendingEmailChange(false);
    }
  };

  const handleCancelEmailChange = async () => {
    setCancelingEmailChange(true);
    try {
      const response = await fetch('/api/user/cancel-email-change', { credentials: 'include', method: 'POST', });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel email change');
      }

      // Refresh profile to get updated state
      await fetchProfile();
      toast.success('Email change canceled');
    } catch (error) {
      console.error('Error canceling email change:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel email change');
    } finally {
      setCancelingEmailChange(false);
    }
  };

  const handleUpdateProfile = async () => {
    setUpdating(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.profile);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !emailPassword) {
      toast.error('Please provide both email and password');
      return;
    }

    setUpdatingEmail(true);
    try {
      const response = await fetch('/api/user/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: newEmail.trim(),
          password: emailPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update email');
      }

      toast.success('Email updated successfully');
      setNewEmail('');
      setEmailPassword('');
      await fetchProfile();
    } catch (error) {
      console.error('Error updating email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Avatar Upload */}
      {profile && (
        <div>
          <AvatarUpload
            userId={profile.id}
            userName={profile.name}
            avatarUrl={profile.image}
            onAvatarUpdate={(newUrl) => {
              setProfile({ ...profile, image: newUrl });
            }}
          />
        </div>
      )}

      {/* Email Verification Banner */}
      {profile && !profile.emailVerified && (
        <div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                Verify your email address
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Please verify your email to access all features and ensure account security.
                Check your inbox for the verification email.
              </p>
              <Button
                onClick={handleResendVerification}
                disabled={resendingVerification}
                size="sm"
                variant="outline"
                className="border-[var(--color-warning)] text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
              >
                {resendingVerification && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Resend Verification Email
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Email Change Banner */}
      {profile?.pendingEmail && (
        <div className="rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)]/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">
                Email Change Pending Verification
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                A verification email has been sent to <strong className="text-foreground">{profile.pendingEmail}</strong>.
                Click the link in the email to complete the change.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancelEmailChange}
                  disabled={cancelingEmailChange}
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {cancelingEmailChange && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Cancel Change
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Information */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Profile Information</h2>
          <p className="text-sm text-muted-foreground">
            Update your account profile information
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-foreground">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <Label htmlFor="displayName" className="text-foreground">Display Name (Optional)</Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="How you'd like to be called"
            />
          </div>

          <div>
            <Label htmlFor="bio" className="text-foreground">Bio (Optional)</Label>
            <Input
              id="bio"
              name="bio"
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="Tell us about yourself"
            />
          </div>

          <Button
            onClick={handleUpdateProfile}
            disabled={updating}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
          >
            {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update Profile
          </Button>
        </div>
      </div>

      {/* Email Section */}
      <div className="border-t border-border pt-8 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Email Address</h2>
          <p className="text-sm text-muted-foreground">
            Current email: <span className="text-foreground font-medium">{profile?.email}</span>
            {profile?.emailVerified && (
              <span className="ml-2 text-[var(--color-success)]">(Verified)</span>
            )}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUpdateEmail();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="newEmail" className="text-foreground">New Email</Label>
            <Input
              id="newEmail"
              name="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="Enter new email address"
              required
            />
          </div>

          <div>
            <Label htmlFor="emailPassword" className="text-foreground">Current Password</Label>
            <Input
              id="emailPassword"
              name="emailPassword"
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="Confirm with your password"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Password required to change email for security
            </p>
          </div>

          <Button
            type="submit"
            disabled={updatingEmail || !newEmail || !emailPassword}
            variant="outline"
            className="border-border"
          >
            {updatingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update Email
          </Button>
        </form>
      </div>

      {/* Password Section */}
      <div className="border-t border-border pt-8 space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Change Password</h2>
          <p className="text-sm text-muted-foreground">
            Update your password to keep your account secure
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="currentPassword" className="text-foreground">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="Enter current password"
              required
            />
          </div>

          <div>
            <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="Enter new password (min 8 characters)"
              required
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-background border-border text-foreground"
              placeholder="Confirm new password"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={updatingPassword || !currentPassword || !newPassword || !confirmPassword}
            variant="outline"
            className="border-border"
          >
            {updatingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Change Password
          </Button>
        </form>
      </div>
    </div>
  );
}
