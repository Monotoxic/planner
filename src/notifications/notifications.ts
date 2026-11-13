/* eslint-disable import/namespace -- линтер не видит enum-ы expo-notifications, хотя они экспортируются (tsc это проверяет) */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { MAX_FOLLOW_UPS, type Task } from '../types/task';
import { currentOccurrence } from '../utils/dates';

/** Android-канал со звуком и вибрацией. */
export const CHANNEL_SOUND = 'reminders';
/** Android-канал без звука (звук на Android задаётся каналом, а не отдельным уведомлением). */
export const CHANNEL_SILENT = 'reminders-silent';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface ScheduleResult {
  notificationId?: string;
  followUpIds: string[];
}

let configured = false;

function channelFor(task: Task): string {
  return task.sound ? CHANNEL_SOUND : CHANNEL_SILENT;
}

/** Обработчик показа уведомлений при открытом приложении и каналы Android. Вызывать один раз при старте. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      // Для задач «без звука» не играем звук и при открытом приложении.
      shouldPlaySound: notification.request.content.data?.silent !== true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    try {
      // Каналы должны существовать до запроса разрешения (Android 13+).
      await Notifications.setNotificationChannelAsync(CHANNEL_SOUND, {
        name: 'Напоминания',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, {
        name: 'Напоминания без звука',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    } catch (error) {
      console.warn('Не удалось создать каналы уведомлений', error);
    }
  }
}

function toPermissionState(settings: Notifications.NotificationPermissionsStatus): PermissionState {
  const allowed =
    settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (allowed) return 'granted';
  if (settings.status === Notifications.PermissionStatus.UNDETERMINED) return 'undetermined';
  return 'denied';
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    return toPermissionState(await Notifications.getPermissionsAsync());
  } catch (error) {
    console.warn('Не удалось проверить разрешение на уведомления', error);
    return 'denied';
  }
}

export async function requestPermission(): Promise<PermissionState> {
  try {
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return toPermissionState(result);
  } catch (error) {
    console.warn('Не удалось запросить разрешение на уведомления', error);
    return 'denied';
  }
}

function buildMainTrigger(task: Task): Notifications.SchedulableNotificationTriggerInput | null {
  const due = new Date(task.dueAt);
  const hour = due.getHours();
  const minute = due.getMinutes();
  const channelId = channelFor(task);

  switch (task.repeat) {
    case 'none':
      // Прошедшее время планировать нельзя.
      if (due.getTime() <= Date.now() + 1000) return null;
      return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due, channelId };
    case 'daily':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId };
    case 'weekly':
      // В expo-notifications воскресенье = 1.
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: due.getDay() + 1,
        hour,
        minute,
        channelId,
      };
    case 'monthly':
      return {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: Math.min(due.getDate(), 28),
        hour,
        minute,
        channelId,
      };
  }
}

/**
 * Повторные напоминания: сетка «время задачи + k × интервал».
 * ОС умеет только заранее запланированные уведомления, поэтому планируем ближайшие
 * MAX_FOLLOW_UPS штук. Когда задачу выполняют, все они отменяются; когда приложение
 * открывают, окно сдвигается вперёд (см. refreshFollowUps в TasksContext).
 */
export async function scheduleFollowUps(task: Task, now: Date = new Date()): Promise<string[]> {
  if (task.completed || task.followUpMinutes <= 0) return [];

  const stepMs = task.followUpMinutes * 60_000;
  const base = currentOccurrence(task, now).getTime();
  // Первый слот сетки, который ещё впереди (но не раньше, чем через секунду).
  const earliest = now.getTime() + 1000;
  const firstIndex = Math.max(1, Math.floor((earliest - base) / stepMs) + 1);

  const ids: string[] = [];
  for (let k = firstIndex; k < firstIndex + MAX_FOLLOW_UPS; k++) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body: task.notes?.trim() ? `Не выполнено: ${task.notes.trim()}` : 'Задача ещё не выполнена',
        sound: task.sound ? 'default' : false,
        data: { taskId: task.id, silent: !task.sound, followUp: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(base + k * stepMs),
        channelId: channelFor(task),
      },
    });
    ids.push(id);
  }
  return ids;
}

/** Планирует основное напоминание и повторные. */
export async function scheduleTask(task: Task): Promise<ScheduleResult> {
  if (task.completed) return { followUpIds: [] };

  let notificationId: string | undefined;
  const trigger = buildMainTrigger(task);
  if (trigger) {
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body: task.notes?.trim() || 'Пора выполнить задачу',
        sound: task.sound ? 'default' : false,
        data: { taskId: task.id, silent: !task.sound },
        // Android: уведомление нельзя смахнуть, пока задача не выполнена.
        sticky: Platform.OS === 'android',
      },
      trigger,
    });
  }

  const followUpIds = await scheduleFollowUps(task);
  return { notificationId, followUpIds };
}

async function cancelOne(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.warn('Не удалось отменить уведомление', error);
  }
  try {
    await Notifications.dismissNotificationAsync(id);
  } catch {
    // Уведомление могло быть не показано, это нормально.
  }
}

/** Отменяет только повторные напоминания (и убирает показанные из шторки). */
export async function cancelFollowUps(ids: string[]): Promise<void> {
  for (const id of ids) {
    await cancelOne(id);
  }
}

/** Отменяет все уведомления задачи: основное и повторные. */
export async function cancelTaskNotifications(task: Pick<Task, 'notificationId' | 'followUpIds'>): Promise<void> {
  if (task.notificationId) await cancelOne(task.notificationId);
  await cancelFollowUps(task.followUpIds);
}
