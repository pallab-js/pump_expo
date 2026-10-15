/* Jest setup — global test configuration/mocks. */

// Back expo-sqlite with an in-process better-sqlite3 engine for unit tests,
// so migrations and repositories run real SQL without native modules.
// The implementation lives in <rootDir>/__mocks__/expo-sqlite.js (jest's
// manual-mock convention for node_modules packages).
jest.mock('expo-sqlite');
