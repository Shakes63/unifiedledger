/**
 * Toast utilities with contextual help links
 * 
 * These functions wrap sonner's toast to add "Learn More" action buttons
 * that link to relevant help sections.
 */

import { toast, ExternalToast } from 'sonner';
import { getHelpUrl, HelpSection } from './help-sections';

interface ToastWithHelpOptions extends Omit<ExternalToast, 'action'> {
  /** The help section to link to */
  helpSection: HelpSection | string;
  /** Optional description text */
  description?: string;
  /** Toast duration in ms (default: 5000) */
  duration?: number;
  /** Label for the help link button (default: "Learn More") */
  actionLabel?: string;
}

/**
 * Show a warning toast with a "Learn More" link to relevant help
 */
export function toastWarningWithHelp(
  message: string,
  options: ToastWithHelpOptions
): string | number {
  const { helpSection, actionLabel = 'Learn More', ...restOptions } = options;

  return toast.warning(message, {
    duration: 5000,
    ...restOptions,
    action: {
      label: actionLabel,
      onClick: () => {
        window.location.href = getHelpUrl(helpSection);
      },
    },
  });
}

/**
 * Show an error toast with a "Learn More" link to relevant help
 */
export function toastErrorWithHelp(
  message: string,
  options: ToastWithHelpOptions
): string | number {
  const { helpSection, actionLabel = 'Learn More', ...restOptions } = options;

  return toast.error(message, {
    duration: 6000,
    ...restOptions,
    action: {
      label: actionLabel,
      onClick: () => {
        window.location.href = getHelpUrl(helpSection);
      },
    },
  });
}

/**
 * Show an info toast with a "Learn More" link to relevant help
 */
export function toastInfoWithHelp(
  message: string,
  options: ToastWithHelpOptions
): string | number {
  const { helpSection, actionLabel = 'Learn More', ...restOptions } = options;

  return toast.info(message, {
    duration: 5000,
    ...restOptions,
    action: {
      label: actionLabel,
      onClick: () => {
        window.location.href = getHelpUrl(helpSection);
      },
    },
  });
}

/**
 * Show a success toast with a "Learn More" link to relevant help
 * (less common, but available for setup completion messages)
 */
export function toastSuccessWithHelp(
  message: string,
  options: ToastWithHelpOptions
): string | number {
  const { helpSection, actionLabel = 'Learn More', ...restOptions } = options;

  return toast.success(message, {
    duration: 4000,
    ...restOptions,
    action: {
      label: actionLabel,
      onClick: () => {
        window.location.href = getHelpUrl(helpSection);
      },
    },
  });
}






