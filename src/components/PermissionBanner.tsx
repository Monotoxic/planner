import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTasks } from '../context/TasksContext';
import { colors, radius, spacing } from '../theme';

/** Показывается, если уведомления выключены: приложение работает, но напоминания не придут. */
export function PermissionBanner() {
  const { ready, permission } = useTasks();
  if (!ready || permission === 'granted') return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Уведомления выключены, поэтому напоминания не будут приходить. Включите их в настройках
        телефона.
      </Text>
      <Pressable onPress={() => void Linking.openSettings()} hitSlop={8}>
        <Text style={styles.link}>Открыть настройки</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningBg,
    borderRadius: radius,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  text: { color: colors.warningText, fontSize: 14, lineHeight: 20 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
});
