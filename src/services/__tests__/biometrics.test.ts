import * as LA from 'expo-local-authentication';
import {
  isBiometricAvailable,
  biometricLabel,
  authenticateBiometric,
} from '@/services/biometrics';

const mock = LA as unknown as { __setState: (s: Record<string, unknown>) => void };

describe('biometrics service', () => {
  beforeEach(() => {
    // Reset to the default enrolled Face ID device.
    mock.__setState({
      hasHardware: true,
      isEnrolled: true,
      supported: [LA.AuthenticationType.FACIAL_RECOGNITION],
      nextResult: { success: true },
    });
  });

  it('reports available when hardware present and enrolled', async () => {
    expect(await isBiometricAvailable()).toBe(true);
  });

  it('reports unavailable without hardware', async () => {
    mock.__setState({ hasHardware: false });
    expect(await isBiometricAvailable()).toBe(false);
  });

  it('reports unavailable when not enrolled', async () => {
    mock.__setState({ isEnrolled: false });
    expect(await isBiometricAvailable()).toBe(false);
  });

  it('labels Face ID and Touch ID', async () => {
    mock.__setState({ supported: [LA.AuthenticationType.FACIAL_RECOGNITION] });
    expect(await biometricLabel()).toBe('Face ID');
    mock.__setState({ supported: [LA.AuthenticationType.FINGERPRINT] });
    expect(await biometricLabel()).toBe('Touch ID');
  });

  it('returns true on a successful auth and false on failure', async () => {
    mock.__setState({ nextResult: { success: true } });
    expect(await authenticateBiometric()).toBe(true);
    mock.__setState({ nextResult: { success: false, error: 'user_cancel' } });
    expect(await authenticateBiometric()).toBe(false);
  });
});
