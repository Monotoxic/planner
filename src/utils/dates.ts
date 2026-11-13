import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isToday,
  isTomorrow,
  set,
  startOfDay,
  startOfMinute,
} from 'date-fns';
import { ru } from 'date-fns/locale';

import type { RepeatType, Task } from '../types/task';

export function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

export function formatDate(date: Date): string {
  return format(date, 'd MMMM yyyy', { locale: ru });
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «Сегодня», «Завтра» или «Пятница, 14 ноября». */
export function dayLabel(date: Date): string {
  if (isToday(date)) return 'Сегодня';
  if (isTomorrow(date)) return 'Завтра';
  return capitalize(format(date, 'EEEE, d MMMM', { locale: ru }));
}

/** Дата берётся из первого аргумента, время из второго. Секунды обнуляются. */
export function combineDateAndTime(datePart: Date, timePart: Date): Date {
  return set(datePart, {
    hours: timePart.getHours(),
    minutes: timePart.getMinutes(),
    seconds: 0,
    milliseconds: 0,
  });
}

/** Значение по умолчанию для новой задачи: начало следующего часа. */
export function defaultDueDate(): Date {
  const now = new Date();
  return set(now, {
    hours: now.getHours() + 1,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
}

export function roundToMinute(date: Date): Date {
  return startOfMinute(date);
}

/**
 * Для ежемесячного повтора день ограничиваем 28-м числом:
 * так уведомление не пропадёт в коротких месяцах.
 */
export function clampMonthlyDay(date: Date): Date {
  return date.getDate() > 28 ? set(date, { date: 28 }) : date;
}

function step(date: Date, repeat: RepeatType): Date {
  switch (repeat) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addWeeks(date, 1);
    case 'monthly':
      return addMonths(date, 1);
    default:
      return date;
  }
}

/**
 * Ближайшее срабатывание задачи, начиная с начала сегодняшнего дня.
 * Для обычных задач это просто dueAt. Повторяющиеся задачи «едут» вперёд сами.
 */
export function currentOccurrence(task: Task, now: Date = new Date()): Date {
  let date = new Date(task.dueAt);
  if (task.repeat === 'none') return date;
  const dayStart = startOfDay(now);
  while (date < dayStart) {
    date = step(date, task.repeat);
  }
  return date;
}

/** Когда задача должна сработать после того, как её отметили выполненной. */
export function nextOccurrenceAfterCompletion(task: Task, now: Date = new Date()): Date {
  return step(currentOccurrence(task, now), task.repeat);
}
