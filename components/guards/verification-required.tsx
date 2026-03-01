"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VerificationRequiredProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function VerificationRequired({
  children,
  fallback,
}: VerificationRequiredProps) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkVerification();
  }, []);

  const checkVerification = async () => {
    try {
      const response = await fetch("/api/user/profile", { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setIsVerified(data.emailVerified ?? false);
      }
    } catch (error) {
      console.error("Error checking verification:", error);
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const response = await fetch("/api/user/resend-verification", { credentials: 'include', method: "POST", });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send verification email");
      }

      toast.success("Verification email sent! Check your inbox.");
    } catch (error) {
      console.error("Error resending verification:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send email"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div style={{ color: 'var(--color-muted-foreground)' }}>Loading...</div>
      </div>
    );
  }

  if (!isVerified) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-warning)', backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)' }}>
        <div className="flex items-start gap-4">
          <div className="rounded-full p-2" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-warning)' }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
              Email Verification Required
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
              This feature requires a verified email address. Please verify your
              email to continue.
            </p>
            <Button
              onClick={handleResendVerification}
              size="sm"
              style={{ backgroundColor: 'var(--color-warning)', color: 'white' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-warning) 90%, transparent)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-warning)'; }}
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Verification Email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
