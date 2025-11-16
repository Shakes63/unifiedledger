'use client';

import { useState, useEffect } from 'react';
import { betterAuthClient } from '@/lib/better-auth-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield, Globe } from 'lucide-react';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Fetch available OAuth providers on mount
  useEffect(() => {
    fetch('/api/user/oauth/available', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.providers) {
          setAvailableProviders(data.providers.filter((p: any) => p.enabled));
        }
      })
      .catch(() => {
        // Silently fail - OAuth is optional
      });
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 2FA state
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifyingTwoFactor, setVerifyingTwoFactor] = useState(false);
  
  // OAuth state
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; name: string; enabled: boolean }>>([]);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Clear any previous errors

    try {
      // If we're in 2FA verification step, verify the code
      if (requiresTwoFactor) {
        await handleTwoFactorVerification();
        return;
      }

      // First, verify password (this will create a session if password is correct)
      const result = await betterAuthClient.signIn.email({
        email,
        password,
      });

      // Check if sign-in was successful
      if (!result || result.error) {
        throw new Error('Incorrect email or password');
      }

      // Check if user has 2FA enabled
      const twoFactorCheck = await fetch(
        `/api/user/two-factor/check-required?email=${encodeURIComponent(email)}`,
        { credentials: 'include' }
      );

      if (twoFactorCheck.ok) {
        const twoFactorData = await twoFactorCheck.json();
        if (twoFactorData.required) {
          // User has 2FA enabled - require verification before completing login
          // Sign out to invalidate the session that was just created
          await betterAuthClient.signOut();
          setRequiresTwoFactor(true);
          setLoading(false);
          return;
        }
      }

      // No 2FA required - complete login
      await completeLogin();
    } catch (error: any) {
      const errorMessage = error?.message || 'Incorrect email or password';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleTwoFactorVerification = async () => {
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError('Please enter a 6-digit verification code');
      setVerifyingTwoFactor(false);
      return;
    }

    setVerifyingTwoFactor(true);
    setError(null);

    try {
      // Verify 2FA code
      const verifyResponse = await fetch('/api/user/two-factor/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          token: twoFactorCode,
        }),
      });

      if (!verifyResponse.ok) {
        const data = await verifyResponse.json();
        throw new Error(data.error || 'Invalid verification code');
      }

      // 2FA verified - now complete the login by signing in again
      // Better Auth will create the session since password was already verified
      try {
        const result = await betterAuthClient.signIn.email({
          email,
          password,
        });

        if (!result) {
          throw new Error('Failed to complete sign-in');
        }
      } catch (signInError: any) {
        throw new Error('Failed to complete sign-in');
      }

      // Complete login
      await completeLogin();
    } catch (error: any) {
      const errorMessage = error?.message || 'Invalid verification code';
      setError(errorMessage);
      setTwoFactorCode('');
    } finally {
      setVerifyingTwoFactor(false);
    }
  };

  const completeLogin = async () => {
    // Update rememberMe field on session if checkbox was checked
    if (rememberMe) {
      try {
        await fetch('/api/session/remember-me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rememberMe: true }),
          credentials: 'include',
        });
      } catch (err) {
        // Don't block sign-in if this fails
      }
    }

    // Redirect to callback URL or dashboard
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

    // Use window.location for a hard redirect to ensure middleware runs
    window.location.href = callbackUrl;
  };

  const handleBackToPassword = () => {
    setRequiresTwoFactor(false);
    setTwoFactorCode('');
    setError(null);
  };

  const handleOAuthSignIn = async (providerId: string) => {
    try {
      setOauthLoading(providerId);
      setError(null);

      const callbackURL = searchParams.get('callbackUrl') || '/dashboard';
      const result = await betterAuthClient.signIn.social({
        provider: providerId,
        callbackURL,
      });

      // Better Auth's social sign-in returns a redirect URL
      // Handle both Data wrapper and direct result types
      const url = ('data' in result && result.data && typeof result.data === 'object' && 'url' in result.data)
        ? (result.data as { url: string }).url
        : ('url' in result && typeof result.url === 'string')
        ? result.url
        : null;

      if (url) {
        // Redirect to OAuth provider
        window.location.href = url;
      } else {
        throw new Error('Failed to get OAuth authorization URL');
      }
    } catch (error: any) {
      const errorMessage = error?.message || `Failed to sign in with ${providerId}`;
      setError(errorMessage);
      setOauthLoading(null);
    }
  };

  function getProviderName(providerId: string) {
    const provider = availableProviders.find((p) => p.id === providerId);
    return provider?.name || providerId.charAt(0).toUpperCase() + providerId.slice(1);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-foreground">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Sign in to your Unified Ledger account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
              <p className="text-sm text-[var(--color-error)] font-medium">
                {error}
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!requiresTwoFactor ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={loading}
                  />
                  <Label
                    htmlFor="rememberMe"
                    className="text-sm text-foreground cursor-pointer select-none"
                  >
                    Remember me on this device
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Skip automatic logout due to inactivity
                </p>

                <Button
                  type="submit"
                  className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-background font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 rounded-full bg-[var(--color-primary)]/10">
                    <Shield className="w-6 h-6 text-[var(--color-primary)]" />
                  </div>
                </div>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Two-Factor Authentication
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="twoFactorCode" className="text-foreground">
                    Verification Code
                  </Label>
                  <Input
                    id="twoFactorCode"
                    name="twoFactorCode"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoComplete="one-time-code"
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground text-center text-2xl font-mono tracking-widest"
                    disabled={verifyingTwoFactor}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    You can also use a backup code if you've lost access to your authenticator app
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBackToPassword}
                    className="flex-1 border-border"
                    disabled={verifyingTwoFactor}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-background font-medium"
                    disabled={verifyingTwoFactor || twoFactorCode.length !== 6}
                  >
                    {verifyingTwoFactor ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </div>
              </>
            )}
          </form>

          {/* OAuth Sign-In Buttons */}
          {availableProviders.length > 0 && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {availableProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthSignIn(provider.id)}
                    disabled={loading || oauthLoading === provider.id || verifyingTwoFactor}
                    className="w-full border-border hover:bg-elevated"
                  >
                    {oauthLoading === provider.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 mr-2" />
                        Sign in with {getProviderName(provider.id)}
                      </>
                    )}
                  </Button>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              href="/sign-up"
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
