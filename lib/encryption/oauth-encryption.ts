import crypto from 'crypto';

/**
 * OAuth Secret Encryption Module
 * 
 * Encrypts and decrypts OAuth client secrets using AES-256-GCM encryption.
 * Uses environment variable OAUTH_ENCRYPTION_KEY or falls back to BETTER_AUTH_SECRET.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
// Note: AES-256 requires 32-byte key (256 bits)

/**
 * Get the encryption key from environment variables or generate one
 * Priority: OAUTH_ENCRYPTION_KEY > BETTER_AUTH_SECRET > Generated key (with warning)
 */
function getEncryptionKey(): Buffer {
  // Try OAUTH_ENCRYPTION_KEY first
  if (process.env.OAUTH_ENCRYPTION_KEY) {
    const key = process.env.OAUTH_ENCRYPTION_KEY;
    // Ensure key is exactly 32 bytes (256 bits) for AES-256
    if (key.length >= 32) {
      return Buffer.from(key.slice(0, 32), 'utf8');
    }
    // If shorter, pad with zeros (not ideal but better than nothing)
    const padded = Buffer.alloc(32);
    Buffer.from(key, 'utf8').copy(padded);
    return padded;
  }

  // Fallback to BETTER_AUTH_SECRET
  if (process.env.BETTER_AUTH_SECRET) {
    const secret = process.env.BETTER_AUTH_SECRET;
    // Ensure secret is exactly 32 bytes
    if (secret.length >= 32) {
      return Buffer.from(secret.slice(0, 32), 'utf8');
    }
    // If shorter, pad with zeros
    const padded = Buffer.alloc(32);
    Buffer.from(secret, 'utf8').copy(padded);
    return padded;
  }

  // Last resort: generate a key (not recommended for production)
  console.warn(
    '[OAuth Encryption] WARNING: No encryption key found in environment variables. ' +
    'Generated a temporary key. This key will change on server restart. ' +
    'Set OAUTH_ENCRYPTION_KEY or BETTER_AUTH_SECRET for persistent encryption.'
  );
  
  // Generate a random key (this will be different on each server restart)
  // This is not ideal but prevents errors
  return crypto.randomBytes(32);
}

/**
 * Encrypt an OAuth client secret
 * 
 * @param secret - The plaintext client secret to encrypt
 * @returns Base64-encoded string containing: iv:authTag:encryptedData
 * 
 * Format: base64(iv:authTag:encryptedData)
 */
export function encryptOAuthSecret(secret: string): string {
  if (!secret || secret.trim().length === 0) {
    throw new Error('Secret cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the secret
    let encrypted = cipher.update(secret, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted data
    // Format: iv:authTag:encryptedData (all base64 encoded)
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64'),
    ]);

    // Return as base64 string
    return combined.toString('base64');
  } catch (error) {
    console.error('[OAuth Encryption] Error encrypting secret:', error);
    throw new Error('Failed to encrypt OAuth secret');
  }
}

/**
 * Decrypt an OAuth client secret
 * 
 * @param encryptedSecret - The base64-encoded encrypted secret
 * @returns The decrypted plaintext secret
 * 
 * Format: base64(iv:authTag:encryptedData)
 */
export function decryptOAuthSecret(encryptedSecret: string): string {
  if (!encryptedSecret || encryptedSecret.trim().length === 0) {
    throw new Error('Encrypted secret cannot be empty');
  }

  try {
    const key = getEncryptionKey();
    
    // Decode from base64
    const combined = Buffer.from(encryptedSecret, 'base64');

    // Extract IV, auth tag, and encrypted data
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted secret format');
    }

    const iv = combined.slice(0, IV_LENGTH);
    const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[OAuth Encryption] Error decrypting secret:', error);
    
    // Check if it's an authentication tag error (wrong key)
    if (error instanceof Error && error.message.includes('Unsupported state')) {
      throw new Error('Failed to decrypt OAuth secret: Invalid encryption key or corrupted data');
    }
    
    throw new Error('Failed to decrypt OAuth secret');
  }
}

/**
 * Generate a new encryption key (for manual key generation)
 * 
 * @returns A random 32-byte key as a hex string
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

