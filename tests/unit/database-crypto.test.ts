import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted ensures variables are available when vi.mock factory runs (hoisted)
const mockSafeStorage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn(),
}))

vi.mock('electron', () => ({
  safeStorage: mockSafeStorage,
}))

import { encryptPassword, decryptPassword } from '../../src/main/services/database/crypto'

describe('Database Crypto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('encryptPassword', () => {
    it('utilise safeStorage quand le chiffrement est disponible', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      const fakeEncrypted = Buffer.from('encrypted-data')
      mockSafeStorage.encryptString.mockReturnValue(fakeEncrypted)

      const result = encryptPassword('mon-mot-de-passe')

      expect(mockSafeStorage.isEncryptionAvailable).toHaveBeenCalled()
      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('mon-mot-de-passe')
      expect(result).toBe('ENC:' + fakeEncrypted.toString('base64'))
    })

    it('utilise le fallback base64 quand safeStorage est indisponible', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const result = encryptPassword('mon-mot-de-passe')

      expect(mockSafeStorage.encryptString).not.toHaveBeenCalled()
      const expectedBase64 = Buffer.from('mon-mot-de-passe').toString('base64')
      expect(result).toBe('B64:' + expectedBase64)
    })

    it('chiffre un mot de passe vide avec safeStorage', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      const fakeEncrypted = Buffer.from('encrypted-empty')
      mockSafeStorage.encryptString.mockReturnValue(fakeEncrypted)

      const result = encryptPassword('')

      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('')
      expect(result).toBe('ENC:' + fakeEncrypted.toString('base64'))
    })

    it('encode un mot de passe vide en base64 quand safeStorage est indisponible', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const result = encryptPassword('')

      const expectedBase64 = Buffer.from('').toString('base64')
      expect(result).toBe('B64:' + expectedBase64)
    })

    it('gere les caracteres speciaux dans le mot de passe', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const specialPassword = 'p@$$w0rd!#%^&*()'
      const result = encryptPassword(specialPassword)

      const expectedBase64 = Buffer.from(specialPassword).toString('base64')
      expect(result).toBe('B64:' + expectedBase64)
    })

    it('gere les caracteres unicode dans le mot de passe', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const unicodePassword = 'motdepasse-accentue-ete-cafe'
      const result = encryptPassword(unicodePassword)

      const expectedBase64 = Buffer.from(unicodePassword).toString('base64')
      expect(result).toBe('B64:' + expectedBase64)
    })
  })

  describe('decryptPassword', () => {
    it('dechiffre un mot de passe avec le prefixe ENC:', () => {
      const originalPassword = 'mon-mot-de-passe'
      const encryptedBuffer = Buffer.from('encrypted-data')
      const storedValue = 'ENC:' + encryptedBuffer.toString('base64')

      mockSafeStorage.decryptString.mockReturnValue(originalPassword)

      const result = decryptPassword(storedValue)

      expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(encryptedBuffer)
      expect(result).toBe(originalPassword)
    })

    it('decode un mot de passe avec le prefixe B64:', () => {
      const originalPassword = 'mon-mot-de-passe'
      const storedValue = 'B64:' + Buffer.from(originalPassword).toString('base64')

      const result = decryptPassword(storedValue)

      expect(mockSafeStorage.decryptString).not.toHaveBeenCalled()
      expect(result).toBe(originalPassword)
    })

    it('retourne la chaine telle quelle sans prefixe connu (legacy/texte brut)', () => {
      const plainPassword = 'ancien-mot-de-passe-en-clair'

      const result = decryptPassword(plainPassword)

      expect(mockSafeStorage.decryptString).not.toHaveBeenCalled()
      expect(result).toBe(plainPassword)
    })

    it('gere une chaine vide sans prefixe', () => {
      const result = decryptPassword('')

      expect(result).toBe('')
    })

    it('gere un mot de passe vide encode en B64', () => {
      const storedValue = 'B64:' + Buffer.from('').toString('base64')

      const result = decryptPassword(storedValue)

      expect(result).toBe('')
    })

    it('gere un mot de passe vide chiffre avec ENC:', () => {
      const encryptedBuffer = Buffer.from('encrypted-empty')
      const storedValue = 'ENC:' + encryptedBuffer.toString('base64')
      mockSafeStorage.decryptString.mockReturnValue('')

      const result = decryptPassword(storedValue)

      expect(result).toBe('')
    })
  })

  describe('aller-retour chiffrement/dechiffrement', () => {
    it('round-trip avec base64 quand safeStorage est indisponible', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const original = 'mot-de-passe-secret-123!'
      const encrypted = encryptPassword(original)
      const decrypted = decryptPassword(encrypted)

      expect(decrypted).toBe(original)
    })

    it('round-trip avec safeStorage quand le chiffrement est disponible', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)

      const original = 'mot-de-passe-secret-123!'
      const fakeEncryptedBuffer = Buffer.from('fake-encrypted-bytes')
      mockSafeStorage.encryptString.mockReturnValue(fakeEncryptedBuffer)
      mockSafeStorage.decryptString.mockReturnValue(original)

      const encrypted = encryptPassword(original)
      const decrypted = decryptPassword(encrypted)

      expect(decrypted).toBe(original)
      // Verify the buffer passed to decryptString matches what encryptString produced
      expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(fakeEncryptedBuffer)
    })

    it('round-trip base64 avec caracteres speciaux', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const passwords = [
        'simple',
        '',
        'avec espaces multiples',
        'special!@#$%^&*()',
        'tres-long-mot-de-passe-'.repeat(20),
        'unicode-\u00e9\u00e8\u00ea\u00eb\u00e0\u00e2',
      ]

      for (const pwd of passwords) {
        const encrypted = encryptPassword(pwd)
        const decrypted = decryptPassword(encrypted)
        expect(decrypted).toBe(pwd)
      }
    })
  })

  describe('gestion des prefixes', () => {
    it('le prefixe ENC: est ajoute par encryptPassword avec safeStorage', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
      mockSafeStorage.encryptString.mockReturnValue(Buffer.from('data'))

      const result = encryptPassword('test')

      expect(result.startsWith('ENC:')).toBe(true)
    })

    it('le prefixe B64: est ajoute par encryptPassword sans safeStorage', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

      const result = encryptPassword('test')

      expect(result.startsWith('B64:')).toBe(true)
    })

    it('decryptPassword distingue correctement ENC: de B64:', () => {
      // B64: path
      const b64Stored = 'B64:' + Buffer.from('test-b64').toString('base64')
      expect(decryptPassword(b64Stored)).toBe('test-b64')
      expect(mockSafeStorage.decryptString).not.toHaveBeenCalled()

      // ENC: path
      const encBuffer = Buffer.from('enc-data')
      const encStored = 'ENC:' + encBuffer.toString('base64')
      mockSafeStorage.decryptString.mockReturnValue('test-enc')
      expect(decryptPassword(encStored)).toBe('test-enc')
      expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(encBuffer)
    })

    it('ne confond pas un texte commencant par ENC sans deux-points', () => {
      const result = decryptPassword('ENCRYPTED-value')

      expect(result).toBe('ENCRYPTED-value')
      expect(mockSafeStorage.decryptString).not.toHaveBeenCalled()
    })

    it('ne confond pas un texte commencant par B64 sans deux-points', () => {
      const result = decryptPassword('B64value')

      expect(result).toBe('B64value')
    })
  })
})
