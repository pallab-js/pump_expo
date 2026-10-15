import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Theme, profiles, backup.</Text>

      <Link href="/db-debug" asChild>
        <Pressable style={styles.link}>
          <Text style={styles.linkText}>Open Database Debug →</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666' },
  link: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#1E6FB8', borderRadius: 10 },
  linkText: { color: '#fff', fontWeight: '600' },
});
