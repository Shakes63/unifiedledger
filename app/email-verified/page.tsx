"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailVerifiedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const emailChanged = searchParams.get("email_changed") === "true";

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleContinue = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          {/* Success Icon */}
          <div className="mx-auto w-16 h-16 bg-[var(--color-success)]/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-[var(--color-success)]" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {emailChanged ? "Email Updated Successfully!" : "Email Verified!"}
          </h1>

          {/* Description */}
          <p className="text-muted-foreground mb-6">
            {emailChanged
              ? "Your email address has been successfully changed and verified. You can now use your new email to sign in."
              : "Thank you for verifying your email address. Your account is now fully activated."}
          </p>

          {/* Auto-redirect notice */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to dashboard in {countdown} seconds...</span>
          </div>

          {/* Continue button */}
          <Button
            onClick={handleContinue}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
