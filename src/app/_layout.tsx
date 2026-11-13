import * as Notifications from 'expo-notifications';
import { Stack, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';

import { TasksProvider, useTasks } from '../context/TasksContext';
import { colors } from '../theme';

/** Открывает задачу по нажатию на уведомление (и при запуске приложения из уведомления). */
function NotificationRouter() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { ready, tasks } = useTasks();
  const response = Notifications.useLastNotificationResponse();
  const handledKey = useRef<string | null>(null);

  useEffect(() => {
    if (!response || !ready || !navigationState?.key) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const { request, date } = response.notification;
    const key = `${request.identifier}:${date}`;
    if (handledKey.current === key) return;
    handledKey.current = key;

    const taskId = request.content.data?.taskId;
    if (typeof taskId === 'string' && tasks.some((t) => t.id === taskId)) {
      router.push(`/task/${taskId}`);
    } else {
      // Задача уже удалена: просто открываем главный экран.
      router.replace('/');
    }
    Notifications.clearLastNotificationResponse();
  }, [response, ready, navigationState?.key, tasks, router]);

  return null;
}

export default function RootLayout() {
  return (
    <TasksProvider>
      <StatusBar style="dark" />
      <NotificationRouter />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ presentation: 'modal', title: 'Задача' }} />
      </Stack>
    </TasksProvider>
  );
}
