/**
 * ID generation utility for main process (CJS-compatible).
 * Replaces nanoid which is ESM-only and cannot be required() in Electron main.
 */
import { randomBytes } from 'crypto';

export function nanoid(size: number = 21): string {
  const bytes = randomBytes(size);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  for (let i = 0; i < size; i++) {
    id += alphabet[bytes[i] & 63];
  }
  return id;
}
