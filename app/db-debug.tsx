import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { getDatabase, latestSchemaVersion } from '@/db';

interface FuelRow {
  id: number;
  code: string;
  name: string;
  unit: string;
}

export default function DbDebugScreen() {
  const [tables, setTables] = useState<string[]>([]);
  const [fuels, setFuels] = useState<FuelRow[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDatabase();
        const t = await db.getAllAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );
        const f = await db.getAllAsync<FuelRow>(
          'SELECT id, code, name, unit FROM fuel_type ORDER BY id'
        );
        const v = await db.getFirstAsync<{ v: number }>(
          'SELECT MAX(version) AS v FROM schema_version'
        );
        setTables(t.map((r) => r.name));
        setFuels(f);
        setVersion(v?.v ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Initializing database…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>DB error: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Database Debug</Text>
      <Text style={styles.muted}>
        Schema version {version} / target {latestSchemaVersion()}
      </Text>

      <Text style={styles.h2}>Tables ({tables.length})</Text>
      {tables.map((t) => (
        <Text key={t} style={styles.row}>
          • {t}
        </Text>
      ))}

      <Text style={styles.h2}>Seeded fuel types ({fuels.length})</Text>
      {fuels.map((f) => (
        <Text key={f.id} style={styles.row}>
          {f.code} — {f.name} ({f.unit})
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 4 },
  row: { fontSize: 14, color: '#333' },
  muted: { fontSize: 13, color: '#777' },
  error: { fontSize: 14, color: '#c0392b', textAlign: 'center' },
});
