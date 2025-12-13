/**
 * Enhanced Fetch Utility
 *
 * Provides robust HTTP request handling with:
 * - Exponential backoff retry logic
 * - Network connectivity detection
 * - Timeout handling
 * - Detailed error categorization
 * - Request deduplication
 * - Abort controller support
 * - Automatic request queueing for offline requests
 *
 * Usage:
 * ```typescript
 * import { enhancedFetch, FetchError, FetchErrorType } from '@/lib/utils/enhanced-fetch';
 *
 * try {
 *   const response = await enhancedFetch('/api/data', {
 *     retries: 3,
 *     timeout: 10000,
 *     onRetry: (attempt) => console.log(`Retry attempt ${attempt}`)
 *   });
 *   const data = await response.json();
 * } catch (error) {
 *   if (error instanceof FetchError) {
 *     if (error.type === FetchErrorType.NETWORK) {
 *       // Handle offline - request automatically queued
 *     } else if (error.type === FetchErrorType.TIMEOUT) {
 *       // Handle timeout
 *     }
 *   }
 * }
 * ```
 */

/**
 * Types of fetch errors for categorization
 */
export enum FetchErrorType {
  /** Network connectivity issue (offline, DNS failure, etc.) */
  NETWORK = 'network',
  /** Request exceeded timeout duration */
  TIMEOUT = 'timeout',
  /** Server returned 5xx error */
  SERVER_ERROR = 'server_error',
  /** Client made invalid request (4xx error) */
  CLIENT_ERROR = 'client_error',
  /** Request was aborted */
  ABORT = 'abort',
  /** Unknown error occurred */
  UNKNOWN = 'unknown',
}

/**
 * Custom error class for fetch operations
 * Provides additional context about the failure
 */
export class FetchError extends Error {
  /** Type of error that occurred */
  type: FetchErrorType;
  /** HTTP response if available */
  response?: Response;
  /** HTTP status code if available */
  statusCode?: number;
  /** Original error that caused this */
  cause?: Error;
  /** Request URL */
  url: string;
  /** Number of retry attempts made */
  attempts: number;

  constructor(
    message: string,
    type: FetchErrorType,
    url: string,
    attempts: number = 0,
    options?: {
      response?: Response;
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'FetchError';
    this.type = type;
    this.url = url;
    this.attempts = attempts;
    this.response = options?.response;
    this.statusCode = options?.statusCode;
    this.cause = options?.cause;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FetchError);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.type) {
      case FetchErrorType.NETWORK:
        return 'Unable to connect. Please check your internet connection.';
      case FetchErrorType.TIMEOUT:
        return 'Request timed out. Please try again.';
      case FetchErrorType.SERVER_ERROR:
        return 'Server error occurred. Please try again later.';
      case FetchErrorType.CLIENT_ERROR:
        if (this.statusCode === 401) {
          return 'Authentication required. Please sign in.';
        }
        if (this.statusCode === 403) {
          return 'Access denied.';
        }
        if (this.statusCode === 404) {
          return 'Resource not found.';
        }
        return 'Invalid request. Please try again.';
      case FetchErrorType.ABORT:
        return 'Request was cancelled.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    // Don't retry client errors (except 429 rate limit)
    if (this.type === FetchErrorType.CLIENT_ERROR && this.statusCode !== 429) {
      return false;
    }

    // Don't retry aborted requests
    if (this.type === FetchErrorType.ABORT) {
      return false;
    }

    // Retry network, timeout, and server errors
    return true;
  }
}

/**
 * Options for enhanced fetch
 */
export interface EnhancedFetchOptions extends RequestInit {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Base delay between retries in ms (default: 1000, uses exponential backoff) */
  retryDelay?: number;
  /** Custom function to determine if request should be retried */
  retryOn?: (error: FetchError, response?: Response) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (attempt: number, error: FetchError) => void;
  /** Enable request deduplication (default: true) */
  deduplicate?: boolean;
  /** Custom abort signal (overrides internal timeout signal) */
  signal?: AbortSignal;
  /** Queue request if offline (default: true) */
  queueOnOffline?: boolean;
  /** Request priority for queue (default: 'normal') */
  queuePriority?: 'critical' | 'normal' | 'low';
  /** User ID for queue filtering (optional) */
  userId?: string;
}

/**
 * In-flight request cache for deduplication
 * Key: request signature (URL + method + body hash)
 * Value: Promise of the ongoing request
 */
const inflightRequests = new Map<string, Promise<Response>>();

/**
 * Generate a unique key for request deduplication
 */
function getRequestKey(url: string, options: EnhancedFetchOptions): string {
  const method = options.method || 'GET';
  const bodyHash = options.body
    ? typeof options.body === 'string'
      ? options.body.substring(0, 100) // Simple hash for dedup
      : '[binary]'
    : '';
  return `${method}:${url}:${bodyHash}`;
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true; // SSR context, assume online
  }
  return navigator.onLine;
}

/**
 * Categorize error based on type and status code
 */
function categorizeError(
  error: Error,
  response?: Response,
  isTimeout: boolean = false
): FetchErrorType {
  // Check for timeout
  if (isTimeout || error.name === 'TimeoutError') {
    return FetchErrorType.TIMEOUT;
  }

  // Check for abort
  if (error.name === 'AbortError') {
    return FetchErrorType.ABORT;
  }

  // Check for network errors
  if (
    error.message.includes('Failed to fetch') ||
    error.message.includes('Network request failed') ||
    error.message.includes('NetworkError') ||
    !isOnline()
  ) {
    return FetchErrorType.NETWORK;
  }

  // Categorize by HTTP status code
  if (response) {
    if (response.status >= 500) {
      return FetchErrorType.SERVER_ERROR;
    }
    if (response.status >= 400) {
      return FetchErrorType.CLIENT_ERROR;
    }
  }

  return FetchErrorType.UNKNOWN;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  // attempt 0: 1s, attempt 1: 2s, attempt 2: 4s
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add random jitter (±20%) to prevent thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);

  return Math.round(exponentialDelay + jitter);
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhanced fetch with retry logic and error handling
 *
 * @param url - The URL to fetch
 * @param options - Fetch options plus enhanced features
 * @returns Promise that resolves to Response
 * @throws FetchError with detailed error information
 */
export async function enhancedFetch(
  url: string,
  options: EnhancedFetchOptions = {}
): Promise<Response> {
  const {
    timeout = 10000,
    retries = 3,
    retryDelay = 1000,
    retryOn,
    onRetry,
    deduplicate = true,
    signal: customSignal,
    ...rest
  } = options;
  // Note: 'rest' contains remaining fetch options for future extensibility
  void rest;

  // Check for in-flight duplicate requests
  if (deduplicate) {
    const requestKey = getRequestKey(url, options);
    const existingRequest = inflightRequests.get(requestKey);

    if (existingRequest) {
      // Return existing promise (request deduplication)
      return existingRequest;
    }
  }

  /**
   * Internal function to perform single fetch attempt
   */
  async function attemptFetch(attemptNumber: number, fetchOptions: EnhancedFetchOptions): Promise<Response> {
    let timeoutId: NodeJS.Timeout | null = null;
    let abortController: AbortController | null = null;
    let isTimeout = false;

    try {
      // Create abort controller for timeout (if no custom signal provided)
      if (!customSignal) {
        abortController = new AbortController();

        // Set timeout
        timeoutId = setTimeout(() => {
          isTimeout = true;
          abortController?.abort();
        }, timeout);
      }

      // Perform fetch with timeout signal
      const response = await fetch(url, {
        ...fetchOptions,
        signal: customSignal || abortController?.signal,
      } as RequestInit);

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Check if response is ok (200-299)
      if (!response.ok) {
        const errorType = categorizeError(new Error(`HTTP ${response.status}`), response);

        // Create error with response details
        const error = new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          errorType,
          url,
          attemptNumber,
          {
            response,
            statusCode: response.status,
          }
        );

        // Check if we should retry
        const shouldRetry = retryOn
          ? retryOn(error, response)
          : error.isRetryable() && attemptNumber < retries;

        if (shouldRetry) {
          // Call retry callback
          if (onRetry) {
            onRetry(attemptNumber + 1, error);
          }

          // Wait before retrying
          const delay = getRetryDelay(attemptNumber, retryDelay);
          await sleep(delay);

          // Retry
          return attemptFetch(attemptNumber + 1, fetchOptions);
        }

        // No more retries, throw error
        throw error;
      }

      // Success!
      return response;
    } catch (error) {
      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Categorize error
      const errorType = categorizeError(error as Error, undefined, isTimeout);

      // Create FetchError
      const fetchError = new FetchError(
        error instanceof Error ? error.message : 'Unknown error',
        errorType,
        url,
        attemptNumber,
        {
          cause: error instanceof Error ? error : undefined,
        }
      );

      // Check if we should retry
      const shouldRetry = retryOn
        ? retryOn(fetchError)
        : fetchError.isRetryable() && attemptNumber < retries;

      if (shouldRetry) {
        // Call retry callback
        if (onRetry) {
          onRetry(attemptNumber + 1, fetchError);
        }

        // Wait before retrying
        const delay = getRetryDelay(attemptNumber, retryDelay);
        await sleep(delay);

        // Retry
        return attemptFetch(attemptNumber + 1, fetchOptions);
      }

      // No more retries
      // If network error and queueOnOffline is enabled, queue the request
      if (
        fetchError.type === FetchErrorType.NETWORK &&
        fetchOptions.queueOnOffline !== false &&
        !isOnline()
      ) {
        try {
          // Dynamically import request queue to avoid circular dependencies
          const { requestQueue } = await import('./request-queue');
          
          await requestQueue.queue({
            url,
            method: fetchOptions.method || 'GET',
            body: typeof fetchOptions.body === 'string' 
              ? fetchOptions.body 
              : fetchOptions.body ? JSON.stringify(fetchOptions.body) : null,
            headers: fetchOptions.headers as Record<string, string> | undefined,
            priority: fetchOptions.queuePriority || 'normal',
            userId: fetchOptions.userId,
            maxRetries: retries,
          });

          console.log(`Request queued for offline retry: ${url}`);
        } catch (queueError) {
          console.error('Failed to queue request:', queueError);
          // Continue to throw original error even if queueing fails
        }
      }

      // Throw error
      throw fetchError;
    }
  }

  // Create promise for this request
  const requestPromise = attemptFetch(0, options);

  // Store in-flight request for deduplication
  if (deduplicate) {
    const requestKey = getRequestKey(url, options);
    inflightRequests.set(requestKey, requestPromise);

    // Clean up after request completes (success or failure)
    requestPromise.finally(() => {
      inflightRequests.delete(requestKey);
    });
  }

  return requestPromise;
}

/**
 * Helper function to perform enhanced JSON fetch
 * Automatically parses JSON response and handles errors
 *
 * @param url - The URL to fetch
 * @param options - Enhanced fetch options
 * @returns Promise that resolves to parsed JSON data
 */
export async function enhancedFetchJSON<T = unknown>(
  url: string,
  options: EnhancedFetchOptions = {}
): Promise<T> {
  const response = await enhancedFetch(url, options);

  // Parse JSON
  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    throw new FetchError(
      'Failed to parse JSON response',
      FetchErrorType.UNKNOWN,
      url,
      0,
      {
        response,
        cause: error instanceof Error ? error : undefined,
      }
    );
  }
}

/**
 * Clear all in-flight requests
 * Useful for testing or when resetting application state
 */
export function clearInflightRequests(): void {
  inflightRequests.clear();
}

/**
 * Get number of in-flight requests
 * Useful for debugging or showing loading indicators
 */
export function getInflightRequestCount(): number {
  return inflightRequests.size;
}
