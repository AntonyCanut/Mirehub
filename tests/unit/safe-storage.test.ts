import { describe, it, expect, vi } from 'vitest'

// Mock safeStorage to test the contract without a running Electron app
const mockIsEncryptionAvailable = vi.fn(() => true)
const mockEncryptString = vi.fn((text: string) => Buffer.from(`encrypted:${text}`))
const mockDecryptString = vi.fn((buffer: Buffer) => {
  const str = buffer.toString()
  return str.startsWith('encrypted:') ? str.slice('encrypted:'.length) : str
})

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mockIsEncryptionAvailable(),
    encryptString: (text: string) => mockEncryptString(text),
    decryptString: (buffer: Buffer) => mockDecryptString(buffer),
  },
}))

describe('safeStorage Contract (pre-upgrade baseline)', () => {
  it('isEncryptionAvailable retourne un boolean', async () => {
    const { safeStorage } = await import('electron')
    const result = safeStorage.isEncryptionAvailable()
    expect(typeof result).toBe('boolean')
    expect(result).toBe(true)
  })

  it('encryptString retourne un Buffer', async () => {
    const { safeStorage } = await import('electron')
    const result = safeStorage.encryptString('secret-api-key')
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('decryptString retourne la chaine originale', async () => {
    const { safeStorage } = await import('electron')
    const encrypted = safeStorage.encryptString('my-secret')
    const decrypted = safeStorage.decryptString(encrypted)
    expect(decrypted).toBe('my-secret')
  })

  it('le round-trip encrypt/decrypt preserve les donnees', async () => {
    const { safeStorage } = await import('electron')
    const testCases = [
      'simple-password',
      'with spaces and special chars!@#$%',
      '',
      'unicode-test-日本語',
    ]

    for (const original of testCases) {
      const encrypted = safeStorage.encryptString(original)
      const decrypted = safeStorage.decryptString(encrypted)
      expect(decrypted).toBe(original)
    }
  })

  it('isEncryptionAvailable gere le cas non disponible', async () => {
    mockIsEncryptionAvailable.mockReturnValueOnce(false)
    const { safeStorage } = await import('electron')
    expect(safeStorage.isEncryptionAvailable()).toBe(false)
  })
})
