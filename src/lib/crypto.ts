import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.warn('WARNING: ENCRYPTION_KEY should be at least 32 characters for AES-256');
}

// Derive a 32-byte key from the provided key
const deriveKey = (key: string): Buffer => {
  return createHash('sha256').update(key).digest();
};

const key = deriveKey(ENCRYPTION_KEY);

const IV_LENGTH = 16; // AES block size

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): string {
  return 'bk_' + randomBytes(32).toString('hex');
}

export function generateRandomToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}
