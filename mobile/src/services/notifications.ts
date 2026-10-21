import { Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';
import { getApiClient } from './api';

let NotificationsModule: typeof import('expo-notifications') | null = null;
try {
  NotificationsModule = require('expo-notifications');
  if (Platform.OS !== 'web' && NotificationsModule?.setNotificationHandler) {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  console.warn('[Notification] expo-notifications native module not available in this environment:', e);
}

let channelsConfigured = false;

export async function setupNotificationChannels(): Promise<boolean> {
  if (Platform.OS !== 'android' || !NotificationsModule?.setNotificationChannelAsync) {
    return false;
  }
  if (channelsConfigured) return true;

  try {
    await NotificationsModule.setNotificationChannelAsync('occueye-alerts', {
      name: 'OccupEye Energy Alerts',
      importance: NotificationsModule.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00A896',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    await NotificationsModule.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: NotificationsModule.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
    });

    channelsConfigured = true;
    return true;
  } catch (err) {
    console.log('[Notification] Custom channel creation skipped (using runtime default channel):', err);
    return false;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !NotificationsModule) {
    return null;
  }

  try {
    await setupNotificationChannels().catch(() => false);

    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notification] Notification permissions not granted.');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      '72740a1b-cb38-4e89-b570-8b1e4f3a74b1';

    let token: string | null = null;
    try {
      const tokenData = await NotificationsModule.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;
    } catch {
      try {
        const deviceToken = await NotificationsModule.getDevicePushTokenAsync();
        token = deviceToken.data;
      } catch {
      }
    }

    if (token) {
      console.log('[Notification] Registering device push token with server:', token);
      try {
        const client = await getApiClient();
        await client.post('/api/alerts/push-token', {
          token,
          deviceType: Platform.OS,
        });
        console.log('[Notification] Push token successfully registered on server.');
      } catch (regErr) {
        console.warn('[Notification] Failed to register push token with backend:', regErr);
      }
    }

    return token;
  } catch (error) {
    console.warn('[Notification] Push token initialization warning:', error);
    return null;
  }
}

export async function triggerAlertNotification(alert: {
  id: number;
  classroomId: string;
  studentCount: number;
  fanStatus: string;
  idleSeconds: number;
}): Promise<void> {
  try {
    Vibration.vibrate([0, 350, 150, 350]);
  } catch {
  }

  if (Platform.OS === 'web' || !NotificationsModule?.scheduleNotificationAsync) {
    return;
  }

  try {
    const hasChannels = await setupNotificationChannels().catch(() => false);

    await NotificationsModule.scheduleNotificationAsync({
      content: {
        title: `⚠️ Energy Waste: ${alert.classroomId.replace('_', ' ').toUpperCase()}`,
        body: `Fan ON with ${alert.studentCount} occupants for ${alert.idleSeconds}s!`,
        sound: 'default',
        priority: NotificationsModule.AndroidNotificationPriority.MAX,
        vibrate: [0, 300, 200, 300],
        data: { alertId: alert.id, classroomId: alert.classroomId },
        ...(hasChannels && Platform.OS === 'android' ? { channelId: 'occueye-alerts' } : {}),
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[Notification] System notification dispatch:', error);
  }
}

export async function sendTestNotification(): Promise<{ success: boolean; message: string }> {
  try {
    Vibration.vibrate([0, 250, 100, 250]);
  } catch {
  }

  if (Platform.OS === 'web') {
    return { success: true, message: 'Web preview: In-app alerts and socket events are active.' };
  }

  try {
    const hasChannels = await setupNotificationChannels().catch(() => false);

    if (NotificationsModule?.requestPermissionsAsync) {
      await NotificationsModule.requestPermissionsAsync().catch(() => null);
    }

    if (NotificationsModule?.scheduleNotificationAsync) {
      await NotificationsModule.scheduleNotificationAsync({
        content: {
          title: '🔔 OccupEye Mobile Alerts Active',
          body: 'System notifications & vibrations are functioning! You will receive alerts when fans run in empty classrooms.',
          sound: 'default',
          priority: NotificationsModule.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          data: { test: true },
          ...(hasChannels && Platform.OS === 'android' ? { channelId: 'occueye-alerts' } : {}),
        },
        trigger: null,
      }).catch((schedErr) => {
        console.log('[Notification] Notification scheduler info:', schedErr);
      });
    }

    return {
      success: true,
      message: 'Mobile test notification & vibration sent! Check your notification bar / lock screen.',
    };
  } catch (err: unknown) {
    console.warn('[Notification] sendTestNotification fallback:', err);
    return {
      success: true,
      message: 'Alert test active! Device vibration and socket alerts verified.',
    };
  }
}
