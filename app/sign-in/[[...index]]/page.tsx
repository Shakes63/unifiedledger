'use client';

import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('[Sign In] Attempting sign-in with email:', email);

      const result = await betterAuthClient.signIn.email({
        email,
        password,
      });

      console.log('[Sign In] Sign-in result:', result);

      // Check if sign-in was successful
      if (!result || result.error) {
        throw new Error(result?.error?.message || 'Sign-in failed');
      }

      // Update rememberMe field on session if checkbox was checked
      if (rememberMe) {
        try {
          await fetch('/api/session/remember-me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rememberMe: true }),
            credentials: 'include',
          });
        } catch (error) {
          console.error('Failed to set remember me:', error);
          // Don't block sign-in if this fails
        }
      }

      toast.success('Signed in successfully!');

      // Redirect to callback URL or dashboard
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
      console.log('[Sign In] Redirecting to:', callbackUrl);

      // Use window.location for a hard redirect to ensure middleware runs
      window.location.href = callbackUrl;
    } catch (error: any) {
      console.error('[Sign In] Error:', error);
      toast.error(error?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

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
          <form onSubmit={handleSubmit} className="space-y-4">
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
          </form>

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
