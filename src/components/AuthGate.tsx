import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getDatabase } from '@/db';
import type { Profile } from '@/db/types';
import {
  countProfiles,
  listProfiles,
  createProfile,
  checkProfilePin,
  getProfile,
} from '@/repositories/profileRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Button, Input, Card } from '@/components';
import { PinPad } from '@/components/PinPad';
import { isBiometricAvailable, biometricLabel, authenticateBiometric } from '@/services/biometrics';

type Phase = 'loading' | 'setup' | 'pick' | 'pin';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const unlock = useSessionStore((s) => s.unlock);

  const [phase, setPhase] = useState<Phase>('loading');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);

  // setup form
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioLabel, setBioLabel] = useState<string | null>(null);

  const refresh = async () => {
    const db = await getDatabase();
    const count = await countProfiles(db);
    if (count === 0) {
      setPhase('setup');
    } else {
      setProfiles(await listProfiles(db));
      setPhase('pick');
    }
  };

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  if (profile) return <>{children}</>;

  const onCreateOwner = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Enter a name (min 2 chars).');
    if (pin.length < 4) return setError('PIN must be at least 4 digits.');
    if (pin !== confirmPin) return setError('PINs do not match.');
    setBusy(true);
    try {
      const db = await getDatabase();
      const id = await createProfile(db, { name: name.trim(), role: 'owner', pin });
      const created = await getProfile(db, id);
      if (created) unlock(created);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onVerifyPin = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const db = await getDatabase();
      const res = await checkProfilePin(db, selected.id, pin);
      if (res.ok) {
        unlock(selected);
      } else if (res.locked) {
        setError(`Too many attempts. Try again in ${res.retryAfter}s.`);
        setPin('');
      } else {
        setError(`Incorrect PIN. ${res.attemptsLeft} attempt(s) left.`);
        setPin('');
      }
    } finally {
      setBusy(false);
    }
  };

  const containerStyle = [styles.container, { backgroundColor: t.colors.background }];

  // Attempt biometric unlock for a profile; returns true if it unlocked.
  const tryBiometric = async (p: Profile): Promise<boolean> => {
    if (!p.biometric_enabled) return false;
    if (!(await isBiometricAvailable())) return false;
    const ok = await authenticateBiometric(`Unlock as ${p.name}`);
    if (ok) {
      unlock(p);
      return true;
    }
    return false;
  };

  // Move to the PIN phase for a profile, auto-prompting biometrics first.
  const selectProfile = async (p: Profile) => {
    setSelected(p);
    setPin('');
    setError(null);
    setPhase('pin');
    if (p.biometric_enabled && (await isBiometricAvailable())) {
      setBioLabel(await biometricLabel());
      await tryBiometric(p);
    } else {
      setBioLabel(null);
    }
  };

  if (phase === 'loading') {
    return (
      <View style={containerStyle}>
        <ActivityIndicator color={t.colors.primary} />
      </View>
    );
  }

  if (phase === 'setup') {
    return (
      <View style={containerStyle}>
        <Text style={styles.logo}>⛽</Text>
        <Text style={[styles.h1, { color: t.colors.text }]}>Welcome</Text>
        <Text style={[styles.muted, { color: t.colors.textMuted }]}>
          Create the Owner profile to get started.
        </Text>
        <Card style={styles.card}>
          <Input label="Your name" value={name} onChangeText={setName} placeholder="e.g. Owner" />
          <View style={styles.gap} />
          <Input
            label="Set PIN (6 digits recommended)"
            value={pin}
            onChangeText={(v) => setPin(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
          />
          <View style={styles.gap} />
          <Input
            label="Confirm PIN"
            value={confirmPin}
            onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            error={error}
          />
          <View style={styles.gap} />
          <Button title="Create & Continue" onPress={onCreateOwner} loading={busy} />
        </Card>
      </View>
    );
  }

  if (phase === 'pin' && selected) {
    return (
      <View style={containerStyle}>
        <Text style={styles.logo}>🔒</Text>
        <Text style={[styles.h1, { color: t.colors.text }]}>{selected.name}</Text>
        <Text style={[styles.muted, { color: t.colors.textMuted }]}>Enter your PIN</Text>
        <View style={styles.gap} />
        <PinPad value={pin} onChange={setPin} maxLength={pin.length > 4 ? pin.length : 4} />
        {error ? <Text style={[styles.err, { color: t.colors.danger }]}>{error}</Text> : null}
        {bioLabel ? (
          <View style={styles.bioRow}>
            <Button
              title={`Unlock with ${bioLabel}`}
              variant="ghost"
              onPress={() => tryBiometric(selected)}
            />
          </View>
        ) : null}
        <View style={styles.pinActions}>
          <Button
            title="Back"
            variant="ghost"
            onPress={() => {
              setSelected(null);
              setPin('');
              setError(null);
              setBioLabel(null);
              setPhase('pick');
            }}
          />
          <Button title="Unlock" onPress={onVerifyPin} loading={busy} />
        </View>
      </View>
    );
  }

  // pick
  return (
    <View style={containerStyle}>
      <Text style={styles.logo}>⛽</Text>
      <Text style={[styles.h1, { color: t.colors.text }]}>Who's using the app?</Text>
      <View style={styles.gap} />
      <View style={styles.profileList}>
        {profiles.map((p) => (
          <Card key={p.id} style={styles.profileCard}>
            <Button
              title={`${p.name}  ·  ${p.role === 'owner' ? 'Owner' : 'Staff'}`}
              variant="secondary"
              onPress={() => selectProfile(p)}
            />
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  logo: { fontSize: 48 },
  h1: { fontSize: 24, fontWeight: '700' },
  muted: { fontSize: 14, textAlign: 'center' },
  card: { width: '100%', maxWidth: 420, marginTop: 16 },
  gap: { height: 12 },
  err: { marginTop: 12, fontWeight: '600' },
  pinActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  bioRow: { marginTop: 16 },
  profileList: { width: '100%', maxWidth: 420, gap: 10 },
  profileCard: { padding: 8 },
});
