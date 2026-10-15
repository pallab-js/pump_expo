import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Thin wrapper around expo-local-authentication so the UI depends on a small,
 * mockable surface rather than the native module directly.
 */

/** Whether the device has biometric hardware AND the user has enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/** Human-readable label for the primary enrolled biometric type. */
export async function biometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    return 'Biometrics';
  } catch {
    return 'Biometrics';
  }
}

/**
 * Prompt for biometric authentication. Returns true only on a successful match.
 * Falls back silently (returns false) on error/cancel so callers can route the
 * user to the PIN pad.
 */
export async function authenticateBiometric(prompt = 'Unlock FuelPump Manager'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      // Keep PIN as the explicit app fallback; don't offer device passcode here.
      disableDeviceFallback: true,
      cancelLabel: 'Use PIN',
    });
    return result.success === true;
  } catch {
    return false;
  }
}
