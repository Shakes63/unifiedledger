'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for managing debt card expansion state with localStorage persistence
 * @param debtId - Unique identifier for the debt
 * @param defaultExpanded - Default expansion state (default: false)
 * @returns Object with isExpanded state, toggle function, and setIsExpanded setter
 */
export function useDebtExpansion(debtId: string, defaultExpanded = false) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isClient, setIsClient] = useState(false);
  const isInitialMount = useRef(true);
  const previousDefaultExpanded = useRef(defaultExpanded);

  // Handle client-side hydration and localStorage on initial mount
  useEffect(() => {
    setIsClient(true);

    if (isInitialMount.current) {
      // Only check localStorage on initial mount
      try {
        const saved = localStorage.getItem(`debt-${debtId}-expanded`);
        if (saved !== null) {
          setIsExpanded(saved === 'true');
        }
      } catch (error) {
        console.error('Error reading from localStorage:', error);
      }
      isInitialMount.current = false;
    }
  }, [debtId]);

  // Handle changes to defaultExpanded (from Expand All / Collapse All)
  useEffect(() => {
    if (!isInitialMount.current && previousDefaultExpanded.current !== defaultExpanded) {
      setIsExpanded(defaultExpanded);
      previousDefaultExpanded.current = defaultExpanded;
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
