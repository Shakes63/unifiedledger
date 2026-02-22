/**
 * Force a full-page navigation so server middleware/session checks run.
 */
export function hardRedirect(pathOrUrl: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.location.href = pathOrUrl;
}

