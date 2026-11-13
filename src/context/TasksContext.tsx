import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  cancelFollowUps,
  cancelTaskNotifications,
  configureNotifications,
  getPermissionState,
  requestPermission,
  scheduleFollowUps,
  scheduleTask,
  type PermissionState,
} from '../notifications/notifications';
import { loadTasks, saveTasks } from '../storage/taskStorage';
import type { Task, TaskInput } from '../types/task';
import { nextOccurrenceAfterCompletion } from '../utils/dates';

// ---------- reducer ----------

interface State {
  tasks: Task[];
  ready: boolean;
}

interface IdPatch {
  id: string;
  notificationId?: string;
  followUpIds: string[];
}

type Action =
  | { type: 'LOADED'; tasks: Task[] }
  | { type: 'UPSERT'; task: Task }
  | { type: 'PATCH_IDS'; patches: IdPatch[]; keepNotificationId?: boolean }
  | { type: 'REMOVE'; id: string };

const initialState: State = { tasks: [], ready: false };

function upsert(list: Task[], task: Task): Task[] {
  const index = list.findIndex((t) => t.id === task.id);
  if (index === -1) return [...list, task];
  const copy = list.slice();
  copy[index] = task;
  return copy;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOADED':
      return { tasks: action.tasks, ready: true };
    case 'UPSERT':
      return { ...state, tasks: upsert(state.tasks, action.task) };
    case 'PATCH_IDS':
      // Меняем только id уведомлений: правки пользователя, сделанные за это время, не затираются.
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          const patch = action.patches.find((p) => p.id === task.id);
          if (!patch) return task;
          return {
            ...task,
            notificationId: action.keepNotificationId ? task.notificationId : patch.notificationId,
            followUpIds: patch.followUpIds,
          };
        }),
      };
    case 'REMOVE':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
  }
}

// ---------- context ----------

interface TasksContextValue {
  tasks: Task[];
  ready: boolean;
  permission: PermissionState;
  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  // Синхронная копия состояния для асинхронных операций: обновляется в тот же момент, что и dispatch.
  const stateRef = useRef<State>(initialState);
  const permissionRef = useRef<PermissionState>('undetermined');
  // Очередь: операции с уведомлениями выполняются строго по одной, чтобы не плодить дубли.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const commit = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action);
    rawDispatch(action);
  }, []);

  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(() => job());
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  /** Планирует уведомления, если есть разрешение. Ошибки не пробрасываем: приложение не должно падать. */
  const applySchedule = useCallback(async (task: Task): Promise<Task> => {
    if (permissionRef.current !== 'granted') {
      return { ...task, notificationId: undefined, followUpIds: [] };
    }
    try {
      const result = await scheduleTask(task);
      return { ...task, notificationId: result.notificationId, followUpIds: result.followUpIds };
    } catch (error) {
      console.warn('Не удалось запланировать уведомление', error);
      return { ...task, notificationId: undefined, followUpIds: [] };
    }
  }, []);

  /** Пересоздать уведомления всех активных задач (разрешение выдали позже). */
  const rescheduleAll = useCallback(
    () =>
      enqueue(async () => {
        const patches: IdPatch[] = [];
        for (const task of stateRef.current.tasks) {
          if (task.completed) continue;
          await cancelTaskNotifications(task);
          const scheduled = await applySchedule(task);
          patches.push({
            id: task.id,
            notificationId: scheduled.notificationId,
            followUpIds: scheduled.followUpIds,
          });
        }
        if (patches.length > 0) commit({ type: 'PATCH_IDS', patches });
      }),
    [enqueue, applySchedule, commit],
  );

  /** Сдвигает окно повторных напоминаний вперёд: «пока не выполнено» продолжается, пока приложение открывают. */
  const refreshFollowUps = useCallback(
    () =>
      enqueue(async () => {
        if (permissionRef.current !== 'granted') return;
        const patches: IdPatch[] = [];
        for (const task of stateRef.current.tasks) {
          if (task.completed || task.followUpMinutes <= 0) continue;
          await cancelFollowUps(task.followUpIds);
          let followUpIds: string[] = [];
          try {
            followUpIds = await scheduleFollowUps(task);
          } catch (error) {
            console.warn('Не удалось запланировать повторные напоминания', error);
          }
          // Пока планировали, задачу могли удалить или выполнить: тогда новые уведомления не нужны.
          const current = stateRef.current.tasks.find((t) => t.id === task.id);
          if (!current || current.completed) {
            await cancelFollowUps(followUpIds);
            continue;
          }
          patches.push({ id: task.id, followUpIds });
        }
        if (patches.length > 0) commit({ type: 'PATCH_IDS', patches, keepNotificationId: true });
      }),
    [enqueue, commit],
  );

  // Запуск: загрузка задач, каналы Android, запрос разрешения.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadTasks();
      await configureNotifications();
      let current = await getPermissionState();
      if (current === 'undetermined') {
        current = await requestPermission();
      }
      if (cancelled) return;
      permissionRef.current = current;
      setPermission(current);
      commit({ type: 'LOADED', tasks: loaded });
      if (current === 'granted') {
        void refreshFollowUps();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commit, refreshFollowUps]);

  // Сохранение после каждого изменения.
  useEffect(() => {
    if (state.ready) {
      void saveTasks(state.tasks);
    }
  }, [state.tasks, state.ready]);

  // Возврат в приложение: перепроверяем разрешение и продлеваем повторные напоминания.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active' || !stateRef.current.ready) return;
      void (async () => {
        const next = await getPermissionState();
        const previous = permissionRef.current;
        permissionRef.current = next;
        setPermission(next);
        if (next !== 'granted') return;
        if (previous !== 'granted') await rescheduleAll();
        else await refreshFollowUps();
      })();
    });
    return () => subscription.remove();
  }, [rescheduleAll, refreshFollowUps]);

  const addTask = useCallback(
    (input: TaskInput) =>
      enqueue(async () => {
        const now = new Date().toISOString();
        const base: Task = {
          id: createId(),
          title: input.title.trim(),
          notes: input.notes?.trim() || undefined,
          dueAt: input.dueAt,
          repeat: input.repeat,
          followUpMinutes: input.followUpMinutes,
          followUpIds: [],
          sound: input.sound,
          completed: false,
          createdAt: now,
          updatedAt: now,
        };
        commit({ type: 'UPSERT', task: await applySchedule(base) });
      }),
    [enqueue, applySchedule, commit],
  );

  const updateTask = useCallback(
    (id: string, input: TaskInput) =>
      enqueue(async () => {
        const existing = stateRef.current.tasks.find((t) => t.id === id);
        if (!existing) return;
        // Все старые уведомления отменяем, новые планируем заново.
        await cancelTaskNotifications(existing);
        const scheduleChanged = input.dueAt !== existing.dueAt || input.repeat !== existing.repeat;
        const updated: Task = {
          ...existing,
          title: input.title.trim(),
          notes: input.notes?.trim() || undefined,
          dueAt: input.dueAt,
          repeat: input.repeat,
          followUpMinutes: input.followUpMinutes,
          sound: input.sound,
          completed: scheduleChanged ? false : existing.completed,
          notificationId: undefined,
          followUpIds: [],
          updatedAt: new Date().toISOString(),
        };
        commit({ type: 'UPSERT', task: await applySchedule(updated) });
      }),
    [enqueue, applySchedule, commit],
  );

  const deleteTask = useCallback(
    (id: string) =>
      enqueue(async () => {
        const existing = stateRef.current.tasks.find((t) => t.id === id);
        if (existing) await cancelTaskNotifications(existing);
        commit({ type: 'REMOVE', id });
      }),
    [enqueue, commit],
  );

  const toggleComplete = useCallback(
    (id: string) =>
      enqueue(async () => {
        const task = stateRef.current.tasks.find((t) => t.id === id);
        if (!task) return;
        // Выполнено: основное и все повторные напоминания отменяются.
        await cancelTaskNotifications(task);
        const updatedAt = new Date().toISOString();

        if (task.repeat !== 'none') {
          // Повторяющаяся задача: засчитываем текущее выполнение и переносим на следующее.
          const next: Task = {
            ...task,
            dueAt: nextOccurrenceAfterCompletion(task).toISOString(),
            completed: false,
            notificationId: undefined,
            followUpIds: [],
            updatedAt,
          };
          commit({ type: 'UPSERT', task: await applySchedule(next) });
          return;
        }

        const toggled: Task = {
          ...task,
          completed: !task.completed,
          notificationId: undefined,
          followUpIds: [],
          updatedAt,
        };
        commit({
          type: 'UPSERT',
          task: toggled.completed ? toggled : await applySchedule(toggled),
        });
      }),
    [enqueue, applySchedule, commit],
  );

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks: state.tasks,
      ready: state.ready,
      permission,
      addTask,
      updateTask,
      deleteTask,
      toggleComplete,
    }),
    [state.tasks, state.ready, permission, addTask, updateTask, deleteTask, toggleComplete],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error('useTasks нужно вызывать внутри TasksProvider');
  }
  return ctx;
}
