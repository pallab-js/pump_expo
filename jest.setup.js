/* Jest setup — global test configuration/mocks. */

// Back expo-sqlite with an in-process better-sqlite3 engine for unit tests,
// so migrations and repositories run real SQL without native modules.
// The implementation lives in <rootDir>/__mocks__/expo-sqlite.js (jest's
// manual-mock convention for node_modules packages).
jest.mock('expo-sqlite');

// Back expo-crypto with Node's crypto for deterministic PIN hashing in tests.
jest.mock('expo-crypto');

// Mock the native biometric module (simulated enrolled device by default).
jest.mock('expo-local-authentication');
