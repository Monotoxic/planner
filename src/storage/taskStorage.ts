import AsyncStorage from '@react-native-async-storage/async-storage';

import { isFollowUpMinutes, type RepeatType, type Task } from '../types/task';

const STORAGE_KEY = 'planner.tasks.v1';
const REPEATS: RepeatType[] = ['none', 'daily', 'weekly', 'monthly'];

/**
 * Проверяет запись из хранилища и достраивает новые поля.
 * Задачи, сохранённые старой версией приложения (без звука и повторов), остаются рабочими.
 */
function normalizeTask(value: unknown): Task | null {
  if (typeof value !== 'object' || value === null) return null;
  const t = value as Record<string, unknown>;

  if (
    typeof t.id !== 'string' ||
    typeof t.title !== 'string' ||
    typeof t.dueAt !== 'string' ||
    Number.isNaN(new Date(t.dueAt).getTime()) ||
    typeof t.repeat !== 'string' ||
    !REPEATS.includes(t.repeat as RepeatType) ||
    typeof t.completed !== 'boolean' ||
    typeof t.createdAt !== 'string' ||
    typeof t.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: t.id,
    title: t.title,
    notes: typeof t.notes === 'string' ? t.notes : undefined,
    dueAt: t.dueAt,
    repeat: t.repeat as RepeatType,
    notificationId: typeof t.notificationId === 'string' ? t.notificationId : undefined,
    followUpMinutes: isFollowUpMinutes(t.followUpMinutes) ? t.followUpMinutes : 0,
    followUpIds: Array.isArray(t.followUpIds)
      ? t.followUpIds.filter((x): x is string => typeof x === 'string')
      : [],
    sound: typeof t.sound === 'boolean' ? t.sound : true,
    completed: t.completed,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export async function loadTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTask).filter((t): t is Task => t !== null);
  } catch (error) {
    console.warn('Не удалось прочитать задачи из хранилища', error);
    return [];
  }
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.warn('Не удалось сохранить задачи', error);
  }
}
