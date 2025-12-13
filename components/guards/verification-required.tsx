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
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isVerified) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="rounded-lg border border-(--color-warning) bg-(--color-warning)/10 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-(--color-warning)/20 p-2">
            <AlertCircle className="w-6 h-6 text-(--color-warning)" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-2">
              Email Verification Required
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This feature requires a verified email address. Please verify your
              email to continue.
            </p>
            <Button
              onClick={handleResendVerification}
              size="sm"
              className="bg-(--color-warning) hover:bg-(--color-warning)/90 text-white"
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
