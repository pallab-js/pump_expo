/** Test mock for expo-local-authentication. Defaults simulate an enrolled Face ID device. */

const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

let _hasHardware = true;
let _isEnrolled = true;
let _supported = [AuthenticationType.FACIAL_RECOGNITION];
let _nextResult = { success: true };

// Test helpers (not part of the real module) to drive scenarios.
function __setState({ hasHardware, isEnrolled, supported, nextResult } = {}) {
  if (hasHardware !== undefined) _hasHardware = hasHardware;
  if (isEnrolled !== undefined) _isEnrolled = isEnrolled;
  if (supported !== undefined) _supported = supported;
  if (nextResult !== undefined) _nextResult = nextResult;
}

async function hasHardwareAsync() {
  return _hasHardware;
}
async function isEnrolledAsync() {
  return _isEnrolled;
}
async function supportedAuthenticationTypesAsync() {
  return _supported;
}
async function authenticateAsync() {
  return _nextResult;
}

module.exports = {
  AuthenticationType,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
  authenticateAsync,
  __setState,
};
