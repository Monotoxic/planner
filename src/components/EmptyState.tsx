import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme';

interface Props {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🗓️</Text>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emoji: { fontSize: 44, marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
});
