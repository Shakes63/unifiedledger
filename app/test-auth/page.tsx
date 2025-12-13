'use client';

import { useState } from 'react';
import { betterAuthClient } from '@/lib/better-auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function TestAuthPage() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Test User');
  const [loading, setLoading] = useState(false);
  type ApiResponse = (Record<string, unknown> & { success?: boolean }) | null;
  const [apiResponse, setApiResponse] = useState<ApiResponse>(null);
  type BetterAuthSession = {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      emailVerified: boolean | null;
    };
  };

  const { data: sessionRaw, isPending } = betterAuthClient.useSession();
  const session = sessionRaw as BetterAuthSession | null;

  const handleSignUp = async () => {
    setLoading(true);
    try {
      await betterAuthClient.signUp.email({
        email,
        password,
        name,
      });
      toast.success('Signed up successfully with Better Auth!');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Sign up failed');
      console.error('Sign up error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await betterAuthClient.signIn.email({
        email,
        password,
      });
      toast.success('Signed in successfully with Better Auth!');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Sign in failed');
      console.error('Sign in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await betterAuthClient.signOut();
      toast.success('Signed out successfully');
      setApiResponse(null); // Clear API response on sign out
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Sign out failed');
    } finally {
      setLoading(false);
    }
  };

  const testProtectedApi = async () => {
    setLoading(true);
    setApiResponse(null);
    try {
      const response = await fetch('/api/test-better-auth', { credentials: 'include' });
      const data = await response.json();

      if (response.ok) {
        setApiResponse(data);
        toast.success('API call successful!');
      } else {
        setApiResponse(data);
        toast.error(data.error || 'API call failed');
      }
    } catch (error: unknown) {
      toast.error('Failed to call API');
      setApiResponse({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Better Auth Test Page</h1>
          <p className="text-muted-foreground">
            Test Better Auth authentication alongside Clerk. This page uses <code className="px-2 py-1 bg-muted rounded text-sm">/api/better-auth/*</code> endpoints.
          </p>
        </div>

        {/* Status Card */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {session ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />
                  Authenticated with Better Auth
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                  Not Authenticated
                </>
              )}
            </CardTitle>
            <CardDescription>
              {session ? 'You are signed in with Better Auth' : 'Sign in or sign up to test Better Auth'}
            </CardDescription>
          </CardHeader>
          {session && (
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">User ID:</span>
                  <span className="text-sm font-mono text-foreground">{session.user.id}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <span className="text-sm text-foreground">{session.user.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="text-sm text-foreground">{session.user.email}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Email Verified:</span>
                  <span className="text-sm text-foreground">
                    {session.user.emailVerified ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              <Button
                onClick={handleSignOut}
                variant="destructive"
                className="w-full mt-4"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  'Sign Out'
                )}
              </Button>
            </CardContent>
          )}
        </Card>

        {/* API Test Card - Always visible */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Protected API Test</CardTitle>
            <CardDescription>
              Test authentication on a protected endpoint
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testProtectedApi}
              className="w-full bg-[var(--color-primary)]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing API...
                </>
              ) : (
                'Test Protected API Route'
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              {session
                ? 'Should succeed with your session ✓'
                : 'Should return 401 Unauthorized ✗'}
            </p>
          </CardContent>
        </Card>

        {/* API Response Card */}
        {apiResponse && (
          <Card className={`border-border ${apiResponse.success ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]' : 'bg-[var(--color-error)]/10 border-[var(--color-error)]'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {apiResponse.success ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />
                    Protected API Test - Success
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-[var(--color-error)]" />
                    Protected API Test - Failed
                  </>
                )}
              </CardTitle>
              <CardDescription>
                Response from /api/test-better-auth
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Auth Form */}
        {!session && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Test Authentication</CardTitle>
              <CardDescription>
                Create a test account or sign in with existing credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Test User"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="test@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="password123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSignUp}
                  className="flex-1 bg-[var(--color-primary)]"
                  disabled={loading || !email || !password || !name}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing up...
                    </>
                  ) : (
                    'Sign Up'
                  )}
                </Button>
                <Button
                  onClick={handleSignIn}
                  variant="outline"
                  className="flex-1 border-border"
                  disabled={loading || !email || !password}
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Data */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Raw Session Data</CardTitle>
            <CardDescription>
              Full session object from Better Auth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(session, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-border bg-[var(--color-elevated)]">
          <CardHeader>
            <CardTitle>Testing Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Better Auth is running on <code className="px-1 py-0.5 bg-muted rounded">/api/better-auth/*</code></p>
            <p>• Test protected endpoint at <code className="px-1 py-0.5 bg-muted rounded">/api/test-better-auth</code></p>
            <p>• Clerk is still active on <code className="px-1 py-0.5 bg-muted rounded">/dashboard</code> and other pages</p>
            <p>• Both auth systems use separate database tables</p>
            <p>• This page only tests Better Auth - Clerk functionality is unaffected</p>
            <p>• Session is stored in SQLite database (offline-capable)</p>
            <p>• Protected API routes verify authentication server-side</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
