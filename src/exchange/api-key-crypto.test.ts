import { describe, test, expect } from 'bun:test'
import { encrypt, decrypt } from './api-key-crypto'

describe('api-key-crypto', () => {
  // 64 hex chars = 32 bytes, required for AES-256
  const encryptionKey = 'a'.repeat(64)

  test('encrypt and decrypt roundtrip returns original plaintext', () => {
    const plaintext = 'my-secret-api-key-12345'
    const encrypted = encrypt(plaintext, encryptionKey)
    const decrypted = decrypt(encrypted, encryptionKey)
    expect(decrypted).toBe(plaintext)
  })

  test('different plaintexts produce different ciphertexts', () => {
    const plain1 = 'secret1'
    const plain2 = 'secret2'
    const enc1 = encrypt(plain1, encryptionKey)
    const enc2 = encrypt(plain2, encryptionKey)
    // Both should decrypt to their originals
    expect(decrypt(enc1, encryptionKey)).toBe(plain1)
    expect(decrypt(enc2, encryptionKey)).toBe(plain2)
    // Ciphertexts should differ (due to random IV)
    expect(enc1).not.toBe(enc2)
  })

  test('tampered ciphertext throws error on decrypt', () => {
    const plaintext = 'test-key'
    const encrypted = encrypt(plaintext, encryptionKey)
    const [iv, authTag, ciphertext] = encrypted.split(':')

    // Tamper with ciphertext hex string
    const tampered = [
      iv,
      authTag,
      // Flip a bit in the ciphertext
      (() => {
        const buf = Buffer.from(ciphertext, 'hex')
        buf[0] = buf[0]! ^ 1
        return buf.toString('hex')
      })(),
    ].join(':')

    expect(() => decrypt(tampered, encryptionKey)).toThrow()
  })

  test('invalid format throws error', () => {
    expect(() => decrypt('invalid', encryptionKey)).toThrow('Invalid encrypted format')
    expect(() => decrypt('a:b', encryptionKey)).toThrow('Invalid encrypted format')
  })

  test('invalid key (not 64 hex chars) throws error', () => {
    expect(() => encrypt('test', 'tooshort')).toThrow('64 hex characters')
    expect(() => encrypt('test', 'z'.repeat(64))).toThrow('64 hex characters') // z is not hex
    expect(() => encrypt('test', 'a'.repeat(32))).toThrow('64 hex characters') // too short
  })

  test('wrong key throws error on decrypt', () => {
    const plaintext = 'secret'
    const encrypted = encrypt(plaintext, encryptionKey)
    const wrongKey = 'b'.repeat(64)
    expect(() => decrypt(encrypted, wrongKey)).toThrow()
  })

  test('empty plaintext can be encrypted and decrypted', () => {
    const plaintext = ''
    const encrypted = encrypt(plaintext, encryptionKey)
    const decrypted = decrypt(encrypted, encryptionKey)
    expect(decrypted).toBe('')
  })

  test('long plaintext works correctly', () => {
    const plaintext = 'x'.repeat(10000)
    const encrypted = encrypt(plaintext, encryptionKey)
    const decrypted = decrypt(encrypted, encryptionKey)
    expect(decrypted).toBe(plaintext)
  })

  test('special characters in plaintext are preserved', () => {
    const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
    const encrypted = encrypt(plaintext, encryptionKey)
    const decrypted = decrypt(encrypted, encryptionKey)
    expect(decrypted).toBe(plaintext)
  })

  test('unicode characters in plaintext are preserved', () => {
    const plaintext = '你好世界 مرحبا بالعالم שלום עולם'
    const encrypted = encrypt(plaintext, encryptionKey)
    const decrypted = decrypt(encrypted, encryptionKey)
    expect(decrypted).toBe(plaintext)
  })

  test('encrypted format has colon-delimited structure', () => {
    const plaintext = 'test'
    const encrypted = encrypt(plaintext, encryptionKey)
    const parts = encrypted.split(':')
    expect(parts.length).toBe(3)
    // IV should be 24 hex chars (12 bytes)
    expect(parts[0].length).toBe(24)
    // Auth tag should be 32 hex chars (16 bytes)
    expect(parts[1].length).toBe(32)
    // Ciphertext should have length > 0
    expect(parts[2].length).toBeGreaterThan(0)
  })
})
