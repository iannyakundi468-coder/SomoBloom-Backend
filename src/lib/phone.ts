/**
 * Kenyan & International Phone Number Utilities for SomoBloom
 * Standardizes Kenyan mobile numbers to international E.164 (+254XXXXXXXXX)
 */

export function normalizePhoneNumber(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned) return null;

  // 1. E.164 format with Kenyan prefix (+2547... or +2541...)
  if (/^\+254[17]\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // 2. 254 without leading + (2547... or 2541...)
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // 3. Local Kenyan 10-digit format (07... or 01...)
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`;
  }

  // 4. 9-digit format omitting leading 0 (7... or 1...)
  if (/^[17]\d{8}$/.test(cleaned)) {
    return `+254${cleaned}`;
  }

  // 5. Standard international format (+ followed by 8-15 digits)
  if (/^\+\d{8,15}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

export function isPhoneNumber(input: string | null | undefined): boolean {
  return normalizePhoneNumber(input) !== null;
}
