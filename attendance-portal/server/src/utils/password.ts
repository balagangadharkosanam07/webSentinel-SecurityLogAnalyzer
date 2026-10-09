import crypto from 'crypto';

/**
 * Standard Scrypt cryptographic password hashing with constant-time verification
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, originalHash] = combinedHash.split(':');
    if (!salt || !originalHash) return false;

    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    const keyBuffer = Buffer.from(derivedKey, 'hex');
    const originalBuffer = Buffer.from(originalHash, 'hex');

    if (keyBuffer.length !== originalBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, originalBuffer);
  } catch {
    return false;
  }
}
