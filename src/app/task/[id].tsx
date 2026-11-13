import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { addMinutes } from 'date-fns';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DateTimeField } from '../../components/DateTimeField';
import { PermissionBanner } from '../../components/PermissionBanner';
import { useTasks } from '../../context/TasksContext';
import { colors, radius, spacing } from '../../theme';
import {
  FOLLOW_UP_OPTIONS,
  REPEAT_OPTIONS,
  followUpWindowLabel,
  type FollowUpMinutes,
  type RepeatType,
  type Task,
} from '../../types/task';
import {
  clampMonthlyDay,
  currentOccurrence,
  defaultDueDate,
  roundToMinute,
} from '../../utils/dates';

export default function TaskFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tasks, ready } = useTasks();

  const isNew = id === 'new';
  const existing = isNew ? undefined : tasks.find((t) => t.id === id);

  if (!isNew && !existing) {
    return (
      <View style={styles.center}>
        {ready ? (
          <>
            <Text style={styles.notFound}>Задача не найдена. Возможно, её уже удалили.</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <Text style={styles.primaryButtonText}>Закрыть</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return <TaskForm existing={existing} />;
}

function TaskForm({ existing }: { existing?: Task }) {
  const router = useRouter();
  const { addTask, updateTask, deleteTask } = useTasks();
  const isNew = !existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [due, setDue] = useState<Date>(() => (existing ? currentOccurrence(existing) : defaultDueDate()));
  const [repeat, setRepeat] = useState<RepeatType>(existing?.repeat ?? 'none');
  const [followUp, setFollowUp] = useState<FollowUpMinutes>(existing?.followUpMinutes ?? 0);
  const [sound, setSound] = useState(existing?.sound ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const closeForm = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const monthlyClamped = repeat === 'monthly' && due.getDate() > 28;

  const performSave = async (dueAt: Date) => {
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueAt: dueAt.toISOString(),
        repeat,
        followUpMinutes: followUp,
        sound,
      };
      if (existing) await updateTask(existing.id, input);
      else await addTask(input);
      closeForm();
    } catch (e) {
      console.warn('Ошибка сохранения', e);
      Alert.alert('Не удалось сохранить задачу', 'Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!title.trim()) {
      setError('Введите название задачи');
      return;
    }
    setError(null);

    let dueAt = roundToMinute(due);
    if (repeat === 'monthly') dueAt = clampMonthlyDay(dueAt);

    if (repeat === 'none' && dueAt.getTime() <= Date.now()) {
      Alert.alert(
        'Время уже прошло',
        'Напоминание в это время не сработает. Сохранить задачу?',
        [
          { text: 'Изменить время', style: 'cancel' },
          { text: 'Сохранить', onPress: () => void performSave(dueAt) },
        ],
      );
      return;
    }
    await performSave(dueAt);
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Удалить задачу?', 'Напоминание тоже будет отменено.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteTask(existing.id);
            closeForm();
          })();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isNew ? 'Новая задача' : 'Редактирование' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PermissionBanner />

        <Text style={styles.label}>Название</Text>
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (error) setError(null);
          }}
          placeholder="Например, позвонить в банк"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          maxLength={120}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Заметка</Text>
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Необязательно"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Дата и время</Text>
        <DateTimeField value={due} onChange={setDue} />
        <Pressable onPress={() => setDue(addMinutes(new Date(), 3))} hitSlop={8}>
          <Text style={styles.link}>Поставить на 3 минуты вперёд (для проверки)</Text>
        </Pressable>

        <Text style={styles.label}>Повтор</Text>
        <View style={styles.chips}>
          {REPEAT_OPTIONS.map((option) => {
            const selected = option.value === repeat;
            return (
              <Pressable
                key={option.value}
                onPress={() => setRepeat(option.value)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {monthlyClamped ? (
          <Text style={styles.hint}>
            Для ежемесячного повтора напоминание сработает 28-го числа, чтобы не пропасть в коротких
            месяцах.
          </Text>
        ) : null}

        <Text style={styles.label}>Повторять напоминание, пока не выполнено</Text>
        <View style={styles.chips}>
          {FOLLOW_UP_OPTIONS.map((option) => {
            const selected = option.value === followUp;
            return (
              <Pressable
                key={option.value}
                onPress={() => setFollowUp(option.value)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {followUp > 0 ? (
          <Text style={styles.hint}>
            После срабатывания придёт до 12 повторных напоминаний ({followUpWindowLabel(followUp)}).
            Они прекращаются, как только вы отметите задачу выполненной. Чтобы напоминания
            продолжились дальше, откройте приложение.
          </Text>
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Звук уведомлений</Text>
          <Switch
            value={sound}
            onValueChange={setSound}
            trackColor={{ true: colors.primary }}
            accessibilityLabel="Звук уведомлений"
          />
        </View>

        <Pressable
          style={[styles.primaryButton, saving && styles.disabled]}
          onPress={() => void onSave()}
          disabled={saving}
          accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Сохранить</Text>
        </Pressable>

        {existing ? (
          <Pressable style={styles.deleteButton} onPress={onDelete} accessibilityRole="button">
            <Text style={styles.deleteText}>Удалить</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  notFound: { fontSize: 16, color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger, borderWidth: 1 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  notes: { minHeight: 90 },
  link: { color: colors.primary, fontSize: 14, marginTop: spacing.sm },
  hint: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
  switchLabel: { fontSize: 16, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 15, color: colors.text },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  deleteButton: { alignItems: 'center', paddingVertical: 14, marginTop: spacing.sm },
  deleteText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
