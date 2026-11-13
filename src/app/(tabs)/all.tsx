import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { startOfDay } from 'date-fns';

import { AddButton } from '../../components/AddButton';
import { EmptyState } from '../../components/EmptyState';
import { PermissionBanner } from '../../components/PermissionBanner';
import { TaskItem, type TaskEntry } from '../../components/TaskItem';
import { useTasks } from '../../context/TasksContext';
import { colors, spacing } from '../../theme';
import { currentOccurrence, dayLabel } from '../../utils/dates';

interface Section {
  title: string;
  data: TaskEntry[];
}

export default function AllTasksScreen() {
  const router = useRouter();
  const { tasks, toggleComplete } = useTasks();

  const sections = useMemo<Section[]>(() => {
    const now = new Date();
    const groups = new Map<number, TaskEntry[]>();
    for (const task of tasks) {
      const at = currentOccurrence(task, now);
      const key = startOfDay(at).getTime();
      const list = groups.get(key) ?? [];
      list.push({ task, at });
      groups.set(key, list);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([key, data]) => ({
        title: dayLabel(new Date(key)),
        data: data.sort((a, b) => a.at.getTime() - b.at.getTime()),
      }));
  }, [tasks]);

  return (
    <View style={styles.container}>
      <PermissionBanner />
      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.task.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.header}>{section.title}</Text>}
        renderItem={({ item }) => (
          <TaskItem
            entry={item}
            onToggle={(id) => void toggleComplete(id)}
            onPress={(id) => router.push(`/task/${id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="Задач пока нет" hint="Нажмите «+», чтобы создать задачу." />
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
