/**
 * GeoIP Location Service
 *
 * Provides IP geolocation lookup functionality for user sessions.
 * Uses ip-api.com free tier (45 requests/minute).
 *
 * Privacy Considerations:
 * - Only stores city, region, country (no coordinates or detailed data)
 * - Location is for user security awareness only (seeing login locations)
 * - Users can view and revoke sessions at any time
 * - Location is not used for tracking or analytics
 */

interface GeoIPResult {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
}

interface CachedResult {
  data: GeoIPResult;
  expiresAt: number;
}

interface IPAPIResponse {
  status: string;
  city?: string;
  regionName?: string;
  country?: string;
  countryCode?: string;
}

// In-memory cache with 24-hour TTL
const locationCache = new Map<string, CachedResult>();

// Cache TTL: 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Request timeout: 5 seconds
const REQUEST_TIMEOUT = 5000;

/**
 * Lookup location information for an IP address
 * @param ip IP address to lookup
 * @returns Location information or null values if lookup fails
 */
export async function lookupLocation(ip: string): Promise<GeoIPResult> {
  // Handle special cases first
  if (isLocalhost(ip)) {
    return {
      city: 'Local Device',
      region: null,
      country: null,
      countryCode: null,
    };
  }

  if (isPrivateIP(ip)) {
    return {
      city: 'Private Network',
      region: null,
      country: null,
      countryCode: null,
    };
  }

  // Check cache
  const cached = locationCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Lookup from ip-api.com
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,country,countryCode`,
      {
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`GeoIP lookup failed for ${ip}: HTTP ${response.status}`);
      return nullResult();
    }

    const data = (await response.json()) as IPAPIResponse;

    if (data.status !== 'success') {
      console.warn(`GeoIP lookup failed for ${ip}: ${data.status}`);
      return nullResult();
    }

    const result: GeoIPResult = {
      city: data.city || null,
      region: data.regionName || null,
      country: data.country || null,
      countryCode: data.countryCode || null,
    };

    // Cache for 24 hours
    locationCache.set(ip, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn(`GeoIP lookup timed out for ${ip}`);
      } else {
        console.error(`GeoIP lookup error for ${ip}:`, error.message);
      }
    }
    return nullResult();
  }
}

/**
 * Format location for display
 * @param location Location data
 * @returns Formatted location string (e.g., "San Francisco, California, United States")
 */
export function formatLocation(location: {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode?: string | null;
}): string {
  const parts: string[] = [];

  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) parts.push(location.country);

  if (parts.length === 0) return 'Unknown';

  return parts.join(', ');
}

/**
 * Get country flag emoji from country code
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Flag emoji or empty string
 */
export function getCountryFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '';

  try {
    // Convert country code to flag emoji
    // A = 0x41, regional indicator A = 0x1F1E6
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));

    return String.fromCodePoint(...codePoints);
  } catch {
    return '';
  }
}

/**
 * Clear the location cache (useful for testing)
 */
export function clearLocationCache(): void {
  locationCache.clear();
}

/**
 * Get cache size (useful for monitoring)
 */
export function getCacheSize(): number {
  return locationCache.size;
}

// Helper functions

function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

function isPrivateIP(ip: string): boolean {
  // Handle IPv6 localhost
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);

  if (isNaN(first) || isNaN(second)) return false;

  // 10.0.0.0 - 10.255.255.255
  if (first === 10) return true;

  // 172.16.0.0 - 172.31.255.255
  if (first === 172 && second >= 16 && second <= 31) return true;

  // 192.168.0.0 - 192.168.255.255
  if (first === 192 && second === 168) return true;

  return false;
}

function nullResult(): GeoIPResult {
  return {
    city: null,
    region: null,
    country: null,
    countryCode: null,
  };
}
