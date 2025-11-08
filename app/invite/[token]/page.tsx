'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@clerk/nextjs';
import { Loader2, CheckCircle2, XCircle, LogIn } from 'lucide-react';
import Link from 'next/link';

interface InvitationData {
  householdId: string;
  invitedEmail: string;
  role: string;
  expiresAt: string;
  status: string;
}

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams();
  const { userId, isSignedIn } = useAuth();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) return;

      try {
        // Try to get invitation details (optional endpoint for validation)
        // For now, we'll just validate by trying to accept
        setLoading(false);
      } catch (err) {
        console.error('Error fetching invitation:', err);
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!isSignedIn) {
      // Redirect to sign in, then come back
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      const data = await response.json();
      // Redirect to the household
      router.push(`/dashboard/households/${data.householdId}`);
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1a1a1a] border-[#2a2a2a] p-8">
          <div className="text-center space-y-4">
            <XCircle className="w-16 h-16 text-[#f87171] mx-auto" />
            <h1 className="text-2xl font-bold text-white">Invitation Declined</h1>
            <p className="text-[#9ca3af]">
              You've declined the household invitation. Redirecting...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1a1a1a] border-[#2a2a2a] p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-[#10b981] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">
              You've Been Invited!
            </h1>
            <p className="text-[#9ca3af]">
              Join a household to share finances with family or friends
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-[#f87171]/10 border border-[#f87171]/30 rounded-lg text-[#f87171] text-sm">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#60a5fa] animate-spin" />
            </div>
          ) : (
            <>
              {/* Invitation details */}
              <div className="space-y-3 bg-[#242424] rounded-lg p-4">
                <div>
                  <p className="text-xs text-[#6b7280] uppercase tracking-wide mb-1">
                    Role in Household
                  </p>
                  <p className="text-white font-medium capitalize">
                    {invitation?.role || 'Member'}
                  </p>
                </div>
                {invitation?.expiresAt && (
                  <div>
                    <p className="text-xs text-[#6b7280] uppercase tracking-wide mb-1">
                      Expires
                    </p>
                    <p className="text-white">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {!isSignedIn ? (
                  <Button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-medium py-6 text-base"
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
                    className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-medium py-6 text-base"
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
                  className="w-full border-[#2a2a2a] text-[#9ca3af] hover:text-white hover:bg-[#242424] py-6 text-base"
                >
                  {accepting ? 'Processing...' : 'Decline'}
                </Button>
              </div>

              {/* Footer */}
              <p className="text-center text-sm text-[#6b7280]">
                This invitation link is personal and expires in 30 days.
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
