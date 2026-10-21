import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, isPhoneNumber } from './phone';

describe('Phone Number Utilities (Kenyan & International)', () => {
  it('normalizes local 10-digit Kenyan numbers starting with 07', () => {
    expect(normalizePhoneNumber('0712345678')).toBe('+254712345678');
    expect(normalizePhoneNumber('0722 123 456')).toBe('+254722123456');
    expect(normalizePhoneNumber('0799-888-777')).toBe('+254799888777');
  });

  it('normalizes local 10-digit Kenyan numbers starting with 01 (Safaricom/Airtel new blocks)', () => {
    expect(normalizePhoneNumber('0110123456')).toBe('+254110123456');
    expect(normalizePhoneNumber('0100 555 444')).toBe('+254100555444');
  });

  it('normalizes 254 format without leading plus', () => {
    expect(normalizePhoneNumber('254712345678')).toBe('+254712345678');
    expect(normalizePhoneNumber('254112345678')).toBe('+254112345678');
  });

  it('normalizes E.164 +254 numbers', () => {
    expect(normalizePhoneNumber('+254712345678')).toBe('+254712345678');
    expect(normalizePhoneNumber('+254 712 345 678')).toBe('+254712345678');
  });

  it('normalizes 9-digit format omitting leading 0', () => {
    expect(normalizePhoneNumber('712345678')).toBe('+254712345678');
    expect(normalizePhoneNumber('112345678')).toBe('+254112345678');
  });

  it('normalizes other valid international numbers with plus', () => {
    expect(normalizePhoneNumber('+14155552671')).toBe('+14155552671');
    expect(normalizePhoneNumber('+44 7911 123456')).toBe('+447911123456');
  });

  it('rejects non-phone inputs like emails and words', () => {
    expect(normalizePhoneNumber('user@somobloom.com')).toBeNull();
    expect(normalizePhoneNumber('admin')).toBeNull();
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber('1234')).toBeNull();
  });

  it('correctly reports isPhoneNumber', () => {
    expect(isPhoneNumber('0712345678')).toBe(true);
    expect(isPhoneNumber('+254712345678')).toBe(true);
    expect(isPhoneNumber('user@somobloom.com')).toBe(false);
  });
});
