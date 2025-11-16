'use client';

import { useState } from 'react';
import { betterAuthClient } from '@/lib/better-auth-client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstSetup = searchParams.get('firstSetup') === 'true';
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Create the account
      await betterAuthClient.signUp.email({
        name,
        email,
        password,
      });

      // Automatically sign in after account creation
      const signInResult = await betterAuthClient.signIn.email({
        email,
        password,
      });

      if (!signInResult || signInResult.error) {
        throw new Error('Account created but sign-in failed. Please sign in manually.');
      }

      // If this is first setup, mark user as owner
      if (isFirstSetup) {
        try {
          const markOwnerResponse = await fetch('/api/auth/mark-owner', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (markOwnerResponse.ok) {
            const data = await markOwnerResponse.json();
            if (data.isOwner) {
              toast.success('Account created successfully! You are now the application owner.');
            } else {
              toast.success('Account created successfully!');
            }
          }
        } catch (error) {
          console.error('Failed to mark owner:', error);
          toast.success('Account created successfully!');
        }
      } else {
        toast.success('Account created successfully!');
      }

      // Use window.location for a hard redirect to ensure middleware runs
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Sign up error:', error);

      // Handle specific error cases
      if (error?.message?.includes('already exists')) {
        toast.error('An account with this email already exists');
      } else {
        toast.error('Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-foreground">
            {isFirstSetup ? 'Create Owner Account' : 'Create Account'}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {isFirstSetup
              ? "You're creating the first account. You'll be the application owner with access to admin settings."
              : 'Get started with Unified Ledger'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Full Name
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                disabled={loading}
              />
            </div>

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
                autoComplete="new-password"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-background font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/sign-in"
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
