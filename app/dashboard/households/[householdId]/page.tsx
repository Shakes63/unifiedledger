'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Household management has been consolidated into Settings > Household tab
 * This page redirects to the new location
 */
export default function HouseholdRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?tab=household');
  }, [router]);

  return null;
}
