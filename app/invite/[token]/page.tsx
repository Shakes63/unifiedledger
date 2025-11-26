'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { betterAuthClient } from '@/lib/better-auth-client';
import { Loader2, CheckCircle2, XCircle, LogIn } from 'lucide-react';

interface InvitationData {
  id: string;
  householdId: string;
  householdName: string | null;
  invitedEmail: string;
  invitedBy: string;
  invitedByName: string | null;
  role: string;
  expiresAt: string;
  status: string;
  createdAt: string;
}

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, isPending } = betterAuthClient.useSession();
  const token = params.token as string;
  const isSignedIn = !!session;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/invitations/${token}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load invitation');
        }

        const data = await response.json();
        setInvitation(data);

        // Check if already accepted or expired
        if (data.status === 'accepted') {
          setError('This invitation has already been accepted');
        } else if (data.status === 'expired' || data.status === 'declined') {
          setError(`This invitation has been ${data.status}`);
        }

        // Check onboarding status if user is signed in
        if (isSignedIn) {
          try {
            const onboardingResponse = await fetch('/api/user/onboarding/status', {
              credentials: 'include',
            });
            if (onboardingResponse.ok) {
              const onboardingData = await onboardingResponse.json();
              setOnboardingCompleted(onboardingData.onboardingCompleted ?? false);
            } else {
              setOnboardingCompleted(false);
            }
          } catch (err) {
            console.error('Failed to check onboarding status:', err);
            setOnboardingCompleted(false);
          }
        }
      } catch (err) {
        console.error('Error fetching invitation:', err);
        setError(err instanceof Error ? err.message : 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token, isSignedIn]);

  const handleAccept = async () => {
    if (!isSignedIn) {
      // Store token before redirecting so it's available after sign-in
      if (typeof window !== 'undefined') {
        localStorage.setItem('unified-ledger:invitation-token', token);
        if (invitation?.householdId) {
          localStorage.setItem('unified-ledger:invitation-household-id', invitation.householdId);
        }
      }
      // Redirect to sign in, then come back
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}&invitation_token=${token}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data = await response.json();
      
      // Check if user is new (hasn't completed onboarding)
      // If onboardingCompleted is null, check it now
      let isNewUser = false;
      if (onboardingCompleted === null) {
        try {
          const onboardingResponse = await fetch('/api/user/onboarding/status', {
            credentials: 'include',
          });
          if (onboardingResponse.ok) {
            const onboardingData = await onboardingResponse.json();
            isNewUser = !(onboardingData.onboardingCompleted ?? false);
          } else {
            isNewUser = true; // Assume new user if check fails
          }
        } catch (err) {
          console.error('Failed to check onboarding status:', err);
          isNewUser = true; // Assume new user if check fails
        }
      } else {
        isNewUser = !onboardingCompleted;
      }

      if (isNewUser) {
        // Store invitation context for onboarding
        if (typeof window !== 'undefined') {
          localStorage.setItem('unified-ledger:invitation-token', token);
          localStorage.setItem('unified-ledger:invitation-household-id', data.householdId);
        }
        // Redirect to onboarding with invitation flag
        router.push('/dashboard?onboarding=true&invited=true');
      } else {
        // Existing user - just redirect to dashboard (household will be switched automatically)
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setAccepting(true);
    setError(null);

    try {
      const response = await fetch('/api/invitations/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decline invitation');
      }

      setDeclined(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAccepting(false);
    }
  };

  if (declined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border p-8">
          <div className="text-center space-y-4">
            <XCircle className="w-16 h-16 text-[var(--color-error)] mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Invitation Declined</h1>
            <p className="text-muted-foreground">
              You've declined the household invitation. Redirecting...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isInvalid = invitation && (invitation.status === 'accepted' || invitation.status === 'expired' || invitation.status === 'declined');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              You've Been Invited!
            </h1>
            <p className="text-muted-foreground">
              Join a household to share finances with family or friends
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg text-[var(--color-error)] text-sm">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
            </div>
          ) : invitation ? (
            <>
              {/* Invitation details */}
              <div className="space-y-3 bg-elevated rounded-lg p-4 border border-border">
                {invitation.householdName && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Household
                    </p>
                    <p className="text-foreground font-semibold text-lg">
                      {invitation.householdName}
                    </p>
                  </div>
                )}
                {invitation.invitedByName && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Invited By
                    </p>
                    <p className="text-foreground font-medium">
                      {invitation.invitedByName}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Role in Household
                  </p>
                  <p className="text-foreground font-medium capitalize">
                    {invitation.role || 'Member'}
                  </p>
                </div>
                {invitation.expiresAt && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Expires
                    </p>
                    <p className="text-foreground">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isInvalid && (
                <div className="space-y-3">
                  {!isSignedIn ? (
                    <Button
                      onClick={handleAccept}
                      disabled={accepting}
                      className="w-full bg-[var(--color-primary)] hover:opacity-90 text-background font-medium py-6 text-base"
                    >
                      {accepting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 mr-2" />
                          Sign in and Accept
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleAccept}
                      disabled={accepting}
                      className="w-full bg-[var(--color-primary)] hover:opacity-90 text-background font-medium py-6 text-base"
                    >
                      {accepting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Accepting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Accept Invitation
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    onClick={handleDecline}
                    disabled={accepting}
                    variant="outline"
                    className="w-full border-border text-muted-foreground hover:text-foreground hover:bg-elevated py-6 text-base"
                  >
                    {accepting ? 'Processing...' : 'Decline'}
                  </Button>
                </div>
              )}

              {/* Footer */}
              {!isInvalid && (
                <p className="text-center text-sm text-muted-foreground">
                  This invitation link is personal and expires in 30 days.
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Unable to load invitation details.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
