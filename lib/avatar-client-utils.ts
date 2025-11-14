// Client-safe avatar utilities (no Node.js dependencies)

// Allowed image file types for avatar upload
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Allowed file extensions
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Maximum file size: 5MB
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Deterministic color palette for initials avatars
const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f43f5e', // rose
];

/**
 * Extract initials from a name (up to 2 characters)
 * Examples:
 * - "John Doe" -> "JD"
 * - "Jane" -> "JA"
 * - "Mary Jane Watson" -> "MW"
 */
export function getInitials(name: string): string {
  if (!name || name.trim().length === 0) {
    return '??';
  }

  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return trimmed.substring(0, 2).toUpperCase();
  }

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  // Take first letter of first word and first letter of last word
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Generate a deterministic background color for an avatar based on userId
 * This ensures the same user always gets the same color
 */
export function getAvatarColor(userId: string): string {
  if (!userId) {
    return AVATAR_COLORS[0];
  }

  // Simple hash function to convert userId to a number
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to select a color
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Validate an image file for avatar upload
 * Checks file type and size
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}
