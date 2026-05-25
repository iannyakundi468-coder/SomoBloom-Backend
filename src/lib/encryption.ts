const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getEncryptionKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  // We use PBKDF2 to derive a proper 256-bit AES key from the secret string
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENCODER.encode('SomoBloom-Static-Salt-For-Encryption'), // Static salt since it's an app-wide secret
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(text: string, secret: string): Promise<string> {
  const key = await getEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  
  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ENCODER.encode(text)
  );
  
  const cipherBase64 = arrayBufferToBase64(cipherBuffer);
  const ivBase64 = arrayBufferToBase64(iv.buffer);
  
  return `${ivBase64}:${cipherBase64}`;
}

export async function decryptData(encryptedString: string, secret: string): Promise<string> {
  const parts = encryptedString.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted format');
  
  const ivBase64 = parts[0];
  const cipherBase64 = parts[1];
  
  const ivArrayBuffer = base64ToArrayBuffer(ivBase64);
  const cipherArrayBuffer = base64ToArrayBuffer(cipherBase64);
  
  const key = await getEncryptionKey(secret);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivArrayBuffer),
    },
    key,
    cipherArrayBuffer
  );
  
  return DECODER.decode(decryptedBuffer);
}

export async function hashIdentifier(text: string, secret: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    ENCODER.encode(text.toLowerCase().trim()) // Normalize for consistent hashing
  );
  
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
