const ENCODER = new TextEncoder();

/**
 * Hashes a password using PBKDF2 with SHA-256
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const saltArray = Array.from(salt);
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  
  const saltHex = parts[0];
  const hashHex = parts[1];
  
  const saltMatch = saltHex.match(/.{1,2}/g);
  if (!saltMatch) return false;
  
  const salt = new Uint8Array(saltMatch.map(byte => parseInt(byte, 16)));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const calculatedHashArray = Array.from(new Uint8Array(hashBuffer));
  const calculatedHashHex = calculatedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return calculatedHashHex === hashHex;
}

export type JwtPayload = {
  sub: string; // User ID
  schoolId: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  exp: number; // Expiration timestamp
};
