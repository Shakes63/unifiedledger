import { useState, useCallback } from 'react';

export function useNavigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return {
    mobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };
}
