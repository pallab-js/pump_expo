import * as Crypto from 'expo-crypto';
import { generateSalt, hashPin, verifyPin, isLegacyHash, PIN_KDF_ITERATIONS } from '@/services/crypto';

describe('crypto PIN hashing', () => {
  it('produces a versioned v2 hash that verifies', async () => {
    const salt = await generateSalt();
    const hash = await hashPin('1234', salt);
    expect(hash.startsWith('v2$')).toBe(true);
    expect(hash).toContain(`$${PIN_KDF_ITERATIONS}$`);
    expect(await verifyPin('1234', salt, hash)).toBe(true);
    expect(await verifyPin('0000', salt, hash)).toBe(false);
  });

  it('does not store the PIN in cleartext', async () => {
    const salt = await generateSalt();
    const hash = await hashPin('987654', salt);
    expect(hash).not.toContain('987654');
  });

  it('verifies a legacy v1 (bare SHA-256) hash for backward compatibility', async () => {
    const salt = await generateSalt();
    // Reproduce the old v1 format: SHA256(`${salt}:${pin}`), stored as bare hex.
    const legacy = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:4321`
    );
    expect(isLegacyHash(legacy)).toBe(true);
    expect(await verifyPin('4321', salt, legacy)).toBe(true);
    expect(await verifyPin('9999', salt, legacy)).toBe(false);
  });

  it('flags v2 hashes as non-legacy', async () => {
    const salt = await generateSalt();
    const hash = await hashPin('1234', salt);
    expect(isLegacyHash(hash)).toBe(false);
  });

  it('uses a unique salt per hash call', async () => {
    const s1 = await generateSalt();
    const s2 = await generateSalt();
    expect(s1).not.toEqual(s2);
  });
});
