/** Test mock for expo-crypto backed by Node's crypto. */
const nodeCrypto = require('crypto');

const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
  SHA1: 'SHA-1',
  SHA512: 'SHA-512',
};

async function digestStringAsync(_algorithm, data) {
  return nodeCrypto.createHash('sha256').update(data).digest('hex');
}

async function getRandomBytesAsync(byteCount) {
  return new Uint8Array(nodeCrypto.randomBytes(byteCount));
}

function getRandomBytes(byteCount) {
  return new Uint8Array(nodeCrypto.randomBytes(byteCount));
}

module.exports = {
  CryptoDigestAlgorithm,
  digestStringAsync,
  getRandomBytesAsync,
  getRandomBytes,
};
