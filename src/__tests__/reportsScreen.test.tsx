import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReportsScreen from '../../app/(tabs)/reports';
import { getDatabase } from '@/db';
import { createProfile } from '@/repositories/profileRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { seedDemoData } from '@/services/seed';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => cb(),
  useRouter: () => ({ push: jest.fn() }),
}));

function wrap(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );
}

describe('ReportsScreen', () => {
  it('renders with seeded data (payment rows present) without crashing', async () => {
    const db = await getDatabase();
    await seedDemoData(db);
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });
    const prof = { id, name: 'Owner', role: 'owner' as const, pin_hash: '', pin_salt: '', created_at: '', failed_attempts: 0, locked_until: null, biometric_enabled: 0 };
    useSessionStore.getState().unlock(prof);

    const r = wrap(<ReportsScreen />);
    // Summary label renders once data loads; payment-method rows map through line().
    await waitFor(() => expect(r.getByText('Summary')).toBeTruthy());
    expect(r.getByText('By payment method')).toBeTruthy();
  });
});
