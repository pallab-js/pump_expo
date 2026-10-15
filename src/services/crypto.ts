import * as Crypto from 'expo-crypto';

/**
 * PIN hashing with a versioned format so we can strengthen the KDF over time
 * without breaking existing stored hashes.
 *
 * Formats:
 *   v1 (legacy): a bare 64-char hex string = SHA256(`${salt}:${pin}`).
 *   v2 (current): `v2$<iterations>$<hex>` where <hex> is an iterated
 *                 SHA-256 chain (a slow KDF) over (salt, pin).
 *
 * expo-crypto does not expose PBKDF2/HMAC, so v2 uses a long iterated SHA-256
 * chain. This is dramatically slower to brute-force than a single hash while
 * staying within the Expo Go sandbox (no native crypto module required).
 */

export const PIN_KDF_ITERATIONS = 15000;
const V2_PREFIX = 'v2$';

/** Generate a random hex salt. */
export async function generateSalt(bytes = 16): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

/** Legacy v1 hash (single SHA-256). Retained for verifying old records. */
async function hashPinV1(pin: string, salt: string): Promise<string> {
  return sha256(`${salt}:${pin}`);
}

/** Iterated SHA-256 KDF (v2). */
async function deriveV2(pin: string, salt: string, iterations: number): Promise<string> {
  let acc = `${salt}:${pin}`;
  for (let i = 0; i < iterations; i++) {
    // Fold the iteration index + salt back in each round.
    acc = await sha256(`${salt}:${i}:${acc}`);
  }
  return acc;
}

/**
 * Hash a PIN using the current (v2) KDF, returning a versioned string.
 * Deterministic for a given (pin, salt, iterations).
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const hex = await deriveV2(pin, salt, PIN_KDF_ITERATIONS);
  return `${V2_PREFIX}${PIN_KDF_ITERATIONS}$${hex}`;
}

/** Constant-time-ish string comparison (length-independent short-circuit avoided). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a PIN against a stored hash+salt. Supports both v1 (legacy bare hex)
 * and v2 (`v2$iterations$hex`) formats transparently.
 */
export async function verifyPin(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (expectedHash.startsWith(V2_PREFIX)) {
    const parts = expectedHash.split('$'); // ['v2', '<iters>', '<hex>']
    const iterations = Number(parts[1]) || PIN_KDF_ITERATIONS;
    const expected = parts[2] ?? '';
    const actual = await deriveV2(pin, salt, iterations);
    return safeEqual(actual, expected);
  }
  // v1 legacy
  const actual = await hashPinV1(pin, salt);
  return safeEqual(actual, expectedHash);
}

/** True if a stored hash uses the legacy v1 format and should be re-hashed. */
export function isLegacyHash(storedHash: string): boolean {
  return !storedHash.startsWith(V2_PREFIX);
}
