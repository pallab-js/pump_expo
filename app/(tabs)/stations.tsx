import { View, Text, StyleSheet } from 'react-native';

export default function StationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stations</Text>
      <Text style={styles.subtitle}>Manage your outlets here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 8 },
});
