/**
 * Household-Aware Fetch Hook
 *
 * Provides fetch utilities that automatically include household context
 * in all API requests. This ensures proper data isolation by household.
 *
 * Usage:
 * ```typescript
 * import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
 *
 * function MyComponent() {
 *   const { fetchWithHousehold, postWithHousehold } = useHouseholdFetch();
 *
 *   const loadData = async () => {
 *     const response = await fetchWithHousehold('/api/transactions');
 *     const data = await response.json();
 *   };
 *
 *   const createItem = async (item) => {
 *     const response = await postWithHousehold('/api/transactions', item);
 *     const result = await response.json();
 *   };
 * }
 * ```
 */

'use client';

import { useHousehold } from '@/contexts/household-context';

export function useHouseholdFetch() {
  const { selectedHouseholdId } = useHousehold();

  /**
   * GET request with household context
   * Automatically adds x-household-id header
   *
   * @param url - The API endpoint URL
   * @param options - Optional fetch options
   * @returns Promise<Response>
   * @throws Error if no household is selected
   */
  const fetchWithHousehold = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
    });
  };

  /**
   * POST request with household context
   * Automatically adds household ID to both header and body
   *
   * @param url - The API endpoint URL
   * @param data - The data to send in the request body
   * @param options - Optional fetch options
   * @returns Promise<Response>
   * @throws Error if no household is selected
   */
  const postWithHousehold = async (
    url: string,
    data: any,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      method: 'POST',
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
      body: JSON.stringify({
        ...data,
        householdId: selectedHouseholdId,
      }),
    });
  };

  /**
   * PUT request with household context
   * Automatically adds household ID to both header and body
   *
   * @param url - The API endpoint URL
   * @param data - The data to send in the request body
   * @param options - Optional fetch options
   * @returns Promise<Response>
   * @throws Error if no household is selected
   */
  const putWithHousehold = async (
    url: string,
    data: any,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      method: 'PUT',
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
      body: JSON.stringify({
        ...data,
        householdId: selectedHouseholdId,
      }),
    });
  };

  /**
   * DELETE request with household context
   * Automatically adds x-household-id header
   *
   * @param url - The API endpoint URL
   * @param options - Optional fetch options
   * @returns Promise<Response>
   * @throws Error if no household is selected
   */
  const deleteWithHousehold = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      method: 'DELETE',
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
    });
  };

  /**
   * PATCH request with household context
   * Automatically adds household ID to both header and body
   *
   * @param url - The API endpoint URL
   * @param data - The data to send in the request body
   * @param options - Optional fetch options
   * @returns Promise<Response>
   * @throws Error if no household is selected
   */
  const patchWithHousehold = async (
    url: string,
    data: any,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (!selectedHouseholdId) {
      throw new Error('No household selected');
    }

    return fetch(url, {
      method: 'PATCH',
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        'x-household-id': selectedHouseholdId,
      },
      body: JSON.stringify({
        ...data,
        householdId: selectedHouseholdId,
      }),
    });
  };

  return {
    fetchWithHousehold,
    postWithHousehold,
    putWithHousehold,
    deleteWithHousehold,
    patchWithHousehold,
    selectedHouseholdId,
  };
}
