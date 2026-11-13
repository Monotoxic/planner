export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

/** Как часто напоминать повторно, пока задача не выполнена (в минутах). 0 = не повторять. */
export type FollowUpMinutes = 0 | 5 | 10 | 15 | 30 | 60;

/** Сколько повторных напоминаний планируется наперёд (лимит ОС: на iOS всего 64 уведомления). */
export const MAX_FOLLOW_UPS = 12;

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** Момент срабатывания, ISO-строка (UTC). В интерфейсе показывается в местном времени. */
  dueAt: string;
  repeat: RepeatType;
  /** Основное напоминание. */
  notificationId?: string;
  /** Повторное напоминание каждые N минут, пока задача не выполнена. 0 = выключено. */
  followUpMinutes: FollowUpMinutes;
  /** Запланированные повторные напоминания. */
  followUpIds: string[];
  /** Звук уведомлений для этой задачи. */
  sound: boolean;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** То, что вводит пользователь в форме. */
export interface TaskInput {
  title: string;
  notes?: string;
  dueAt: string;
  repeat: RepeatType;
  followUpMinutes: FollowUpMinutes;
  sound: boolean;
}

export const FOLLOW_UP_OPTIONS: { value: FollowUpMinutes; label: string }[] = [
  { value: 0, label: 'Не повторять' },
  { value: 5, label: 'Каждые 5 мин' },
  { value: 10, label: 'Каждые 10 мин' },
  { value: 15, label: 'Каждые 15 мин' },
  { value: 30, label: 'Каждые 30 мин' },
  { value: 60, label: 'Каждый час' },
];

export function isFollowUpMinutes(value: unknown): value is FollowUpMinutes {
  return FOLLOW_UP_OPTIONS.some((o) => o.value === value);
}

/** Короткая подпись для списка задач: «каждые 10 мин». */
export function followUpShortLabel(minutes: FollowUpMinutes): string {
  return minutes === 60 ? 'каждый час' : `каждые ${minutes} мин`;
}

/** На какое время хватит повторных напоминаний: «около 2 ч». */
export function followUpWindowLabel(minutes: FollowUpMinutes): string {
  return `около ${(minutes * MAX_FOLLOW_UPS) / 60} ч`;
}

export const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
  { value: 'monthly', label: 'Ежемесячно' },
];

export function repeatLabel(repeat: RepeatType): string {
  return REPEAT_OPTIONS.find((o) => o.value === repeat)?.label ?? '';
}
