import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { followUpShortLabel, repeatLabel, type Task } from '../types/task';
import { formatTime } from '../utils/dates';

export interface TaskEntry {
  task: Task;
  /** Когда задача сработает (для повторяющихся: ближайшее срабатывание). */
  at: Date;
}

interface Props {
  entry: TaskEntry;
  overdue?: boolean;
  onToggle: (id: string) => void;
  onPress: (id: string) => void;
}

export function TaskItem({ entry, overdue = false, onToggle, onPress }: Props) {
  const { task, at } = entry;
  const done = task.completed;

  return (
    <Pressable
      onPress={() => onPress(task.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Задача: ${task.title}`}>
      <Pressable
        onPress={() => onToggle(task.id)}
        hitSlop={12}
        style={[styles.checkbox, done && styles.checkboxDone]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel="Отметить выполненной">
        {done ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={[styles.meta, overdue && !done && styles.metaOverdue]} numberOfLines={1}>
          {formatTime(at)}
          {task.repeat !== 'none' ? `  ·  ${repeatLabel(task.repeat)}` : ''}
          {task.followUpMinutes > 0 ? `  ·  🔔 ${followUpShortLabel(task.followUpMinutes)}` : ''}
          {!task.sound ? '  ·  🔕' : ''}
          {task.notes ? `  ·  ${task.notes}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxDone: { backgroundColor: colors.primary },
  check: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  body: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  titleDone: { textDecorationLine: 'line-through', color: colors.muted },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  metaOverdue: { color: colors.danger },
});
