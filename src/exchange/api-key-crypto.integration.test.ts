import { describe, expect, it } from "bun:test";
import { decrypt, encrypt } from "./api-key-crypto";

describe("api-key-crypto", () => {
  // Generate a valid 64-char hex key for testing
  const validKey = "a".repeat(64);
  const invalidKey = "invalid";
  const invalidKeyTooShort = "0".repeat(32);
  const plaintext = "my-secret-api-key-12345";

  describe("encrypt", () => {
    it("should encrypt plaintext with a valid key", () => {
      const encrypted = encrypt(plaintext, validKey);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      // Format should be iv:authTag:ciphertext (3 parts)
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);
    });

    it("should produce different ciphertexts for same plaintext (due to random IV)", () => {
      const encrypted1 = encrypt(plaintext, validKey);
      const encrypted2 = encrypt(plaintext, validKey);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should throw error with invalid key (non-hex)", () => {
      expect(() => {
        encrypt(plaintext, invalidKey);
      }).toThrow();
    });

    it("should throw error with invalid key (wrong length)", () => {
      expect(() => {
        encrypt(plaintext, invalidKeyTooShort);
      }).toThrow();
    });

    it("should encrypt empty string", () => {
      const encrypted = encrypt("", validKey);
      expect(encrypted).toBeDefined();
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);
    });
  });

  describe("decrypt", () => {
    it("should decrypt encrypted plaintext correctly", () => {
      const encrypted = encrypt(plaintext, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(plaintext);
    });

    it("should decrypt empty string", () => {
      const encrypted = encrypt("", validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe("");
    });

    it("should throw error with invalid key", () => {
      const encrypted = encrypt(plaintext, validKey);
      expect(() => {
        decrypt(encrypted, invalidKeyTooShort);
      }).toThrow();
    });

    it("should throw error with tampered ciphertext", () => {
      const encrypted = encrypt(plaintext, validKey);
      const parts = encrypted.split(":");
      // Tamper with ciphertext (last part)
      const tampered = [parts[0], parts[1], "deadbeef"].join(":");
      expect(() => {
        decrypt(tampered, validKey);
      }).toThrow();
    });

    it("should throw error with invalid format (missing parts)", () => {
      const malformed = "onlyoneppart";
      expect(() => {
        decrypt(malformed, validKey);
      }).toThrow();
    });

    it("should throw error with wrong key", () => {
      const encrypted = encrypt(plaintext, validKey);
      const wrongKey = "b".repeat(64);
      expect(() => {
        decrypt(encrypted, wrongKey);
      }).toThrow();
    });

    it("should decrypt different payloads differently", () => {
      const payload1 = "secret1";
      const payload2 = "secret2";
      const enc1 = encrypt(payload1, validKey);
      const enc2 = encrypt(payload2, validKey);
      const dec1 = decrypt(enc1, validKey);
      const dec2 = decrypt(enc2, validKey);
      expect(dec1).not.toBe(dec2);
      expect(dec1).toBe(payload1);
      expect(dec2).toBe(payload2);
    });

    it("should handle special characters in plaintext", () => {
      const special = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
      const encrypted = encrypt(special, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(special);
    });

    it("should handle Unicode characters in plaintext", () => {
      const unicode = "你好世界 🔐 مرحبا";
      const encrypted = encrypt(unicode, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(unicode);
    });

    it("should handle very long plaintext", () => {
      const long = "x".repeat(10000);
      const encrypted = encrypt(long, validKey);
      const decrypted = decrypt(encrypted, validKey);
      expect(decrypted).toBe(long);
    });
  });

  describe("round-trip consistency", () => {
    it("should maintain consistency over multiple cycles", () => {
      const testPayloads = ["test1", "test2", "test3"];
      for (const payload of testPayloads) {
        const enc1 = encrypt(payload, validKey);
        const dec1 = decrypt(enc1, validKey);
        const enc2 = encrypt(dec1, validKey);
        const dec2 = decrypt(enc2, validKey);
        expect(dec2).toBe(payload);
      }
    });
  });
});
