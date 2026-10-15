import * as Crypto from 'expo-crypto';

/** Generate a random hex salt. */
export async function generateSalt(bytes = 16): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash a PIN with a salt using SHA-256. Deterministic for a given (pin, salt). */
export async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
}

/** Verify a PIN against a stored hash+salt. */
export async function verifyPin(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await hashPin(pin, salt);
  return actual === expectedHash;
}
