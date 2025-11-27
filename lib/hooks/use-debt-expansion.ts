'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';

// Helper to get initial state from localStorage
function getInitialExpansionState(debtId: string, defaultExpanded: boolean): boolean {
  if (typeof window === 'undefined') return defaultExpanded;
  try {
    const saved = localStorage.getItem(`debt-${debtId}-expanded`);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch {
    // localStorage may not be available
  }
  return defaultExpanded;
}

// Subscribe to nothing - this is just to use useSyncExternalStore for isClient
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Custom hook for managing debt card expansion state with localStorage persistence
 * @param debtId - Unique identifier for the debt
 * @param defaultExpanded - Default expansion state (default: false)
 * @returns Object with isExpanded state, toggle function, and setIsExpanded setter
 */
export function useDebtExpansion(debtId: string, defaultExpanded = false) {
  // Initialize with localStorage value if available
  const [isExpanded, setIsExpanded] = useState(() => 
    getInitialExpansionState(debtId, defaultExpanded)
  );
  // Track if we're on the client using useSyncExternalStore for hydration safety
  const isClient = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  const previousDefaultExpandedRef = useRef(defaultExpanded);

  // Handle changes to defaultExpanded (from Expand All / Collapse All)
  // Using requestAnimationFrame to defer the setState
  useEffect(() => {
    if (previousDefaultExpandedRef.current !== defaultExpanded) {
      previousDefaultExpandedRef.current = defaultExpanded;
      requestAnimationFrame(() => {
        setIsExpanded(defaultExpanded);
      });
    }
  }, [defaultExpanded]);

  // Toggle function that saves to localStorage
  const toggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);

    // Save to localStorage
    try {
      localStorage.setItem(`debt-${debtId}-expanded`, newState.toString());
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  // Custom setter that also persists to localStorage
  const setExpandedWithPersist = (value: boolean) => {
    setIsExpanded(value);

    // Save to localStorage
    try {
      localStorage.setItem(`debt-${debtId}-expanded`, value.toString());
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  return {
    isExpanded: isClient ? isExpanded : defaultExpanded,
    toggle,
    setIsExpanded: setExpandedWithPersist,
  };
}
