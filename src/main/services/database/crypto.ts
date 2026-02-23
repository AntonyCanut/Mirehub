import { safeStorage } from 'electron'

/**
 * Encrypt a password using Electron's safeStorage API.
 * Falls back to Base64 encoding if native encryption is unavailable.
 */
export function encryptPassword(password: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(password)
    return 'ENC:' + encrypted.toString('base64')
  }
  return 'B64:' + Buffer.from(password).toString('base64')
}

/**
 * Decrypt a password previously encrypted with encryptPassword.
 * Handles both ENC: (native) and B64: (fallback) prefixes.
 * Returns the string as-is if it has no known prefix (legacy/plain text).
 */
export function decryptPassword(stored: string): string {
  if (stored.startsWith('ENC:')) {
    const buffer = Buffer.from(stored.slice(4), 'base64')
    return safeStorage.decryptString(buffer)
  }
  if (stored.startsWith('B64:')) {
    return Buffer.from(stored.slice(4), 'base64').toString('utf-8')
  }
  return stored
}
