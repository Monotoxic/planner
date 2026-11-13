import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { isSameDay, startOfDay } from 'date-fns';

import { AddButton } from '../../components/AddButton';
import { EmptyState } from '../../components/EmptyState';
import { PermissionBanner } from '../../components/PermissionBanner';
import { TaskItem, type TaskEntry } from '../../components/TaskItem';
import { useTasks } from '../../context/TasksContext';
import { colors, spacing } from '../../theme';
import { currentOccurrence } from '../../utils/dates';

interface Section {
  title: string;
  overdue: boolean;
  data: TaskEntry[];
}

function byTime(a: TaskEntry, b: TaskEntry): number {
  return a.at.getTime() - b.at.getTime();
}

export default function TodayScreen() {
  const router = useRouter();
  const { tasks, toggleComplete } = useTasks();

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const entries: TaskEntry[] = tasks.map((task) => ({ task, at: currentOccurrence(task, now) }));

    const overdue = entries.filter((e) => !e.task.completed && e.at < dayStart).sort(byTime);
    const today = entries
      .filter((e) => isSameDay(e.at, now))
      .sort((a, b) => Number(a.task.completed) - Number(b.task.completed) || byTime(a, b));

    const result: Section[] = [];
    if (overdue.length > 0) result.push({ title: 'Просрочено', overdue: true, data: overdue });
    if (today.length > 0) result.push({ title: 'Сегодня', overdue: false, data: today });
    return result;
  }, [tasks]);

  return (
    <View style={styles.container}>
      <PermissionBanner />
      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.task.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          sections.length > 1 ? <Text style={styles.header}>{section.title}</Text> : null
        }
        renderItem={({ item, section }) => (
          <TaskItem
            entry={item}
            overdue={section.overdue}
            onToggle={(id) => void toggleComplete(id)}
            onPress={(id) => router.push(`/task/${id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="На сегодня задач нет" hint="Нажмите «+», чтобы добавить первую задачу." />
        }
      />
      <AddButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 110 },
  header: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
