import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM constants
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128-bit authentication tag

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt (e.g. an API key or secret)
 * @param key - 32-byte encryption key (hex or raw string — must be exactly 32 chars/bytes)
 * @returns Colon-delimited hex string: `iv:authTag:ciphertext`
 */
export function encrypt(plaintext: string, key: string): string {
  const iv = randomBytes(IV_LENGTH)
  const keyBuffer = Buffer.from(key, 'utf8')

  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypts a previously encrypted string using AES-256-GCM.
 *
 * @param encrypted - Colon-delimited hex string produced by `encrypt`
 * @param key - 32-byte encryption key — must match the key used during encryption
 * @returns The original plaintext string
 * @throws If the format is invalid or authentication fails (tampered ciphertext)
 */
export function decrypt(encrypted: string, key: string): string {
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format: expected iv:authTag:ciphertext')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string]

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const keyBuffer = Buffer.from(key, 'utf8')

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
