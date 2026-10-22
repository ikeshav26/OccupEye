import { Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApiClient, AUTH_TOKEN_KEY } from './api';

let NotificationsModule: typeof import('expo-notifications') | null = null;
try {
  NotificationsModule = require('expo-notifications');
  if (Platform.OS !== 'web' && NotificationsModule?.setNotificationHandler) {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
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

export const ALERT_CHANNEL_ID = 'occueye-alerts-v2';
let channelsConfigured = false;

export async function setupNotificationChannels(): Promise<boolean> {
  if (Platform.OS !== 'android' || !NotificationsModule?.setNotificationChannelAsync) {
    return false;
  }
  if (channelsConfigured) return true;

  try {
    await NotificationsModule.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
      name: 'OccupEye Energy Alerts',
      description: 'Audible alerts with vibration when energy is wasted in empty rooms',
      importance: NotificationsModule.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#00A896',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      showBadge: true,
      lockscreenVisibility: NotificationsModule.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
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
    console.log('[Notification] Custom channel creation note:', err);
    return false;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !NotificationsModule) {
    return null;
  }

  try {
    const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!authToken) {
      console.log('[Notification] User is not logged in. Skipping push token registration.');
      return null;
    }

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

export async function unregisterPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !NotificationsModule) {
    return;
  }

  try {
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
      } catch {}
    }

    if (token) {
      console.log('[Notification] Unregistering device push token on logout:', token);
      const client = await getApiClient();
      await client.delete('/api/alerts/push-token', {
        data: { token },
      });
      console.log('[Notification] Push token unregistered successfully from server.');
    }
  } catch (err) {
    console.warn('[Notification] Failed to unregister push token:', err);
  }
}

export async function triggerAlertNotification(alert: {
  id: number;
  classroomId: string;
  studentCount: number;
  fanStatus: string;
  idleSeconds: number;
}): Promise<void> {
  // Only present notification if the user is currently logged in with a valid auth token
  const authToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!authToken) {
    return;
  }

  try {
    Vibration.vibrate([0, 500, 200, 500]);
  } catch {
  }

  if (Platform.OS === 'web' || !NotificationsModule?.scheduleNotificationAsync) {
    return;
  }

  try {
    await setupNotificationChannels().catch(() => false);

    try {
      const { status } = await NotificationsModule.getPermissionsAsync();
      if (status !== 'granted') {
        await NotificationsModule.requestPermissionsAsync();
      }
    } catch {}

    await NotificationsModule.scheduleNotificationAsync({
      content: {
        title: `⚠️ Energy Waste: ${alert.classroomId.replace('_', ' ').toUpperCase()}`,
        body: `Fan ON with ${alert.studentCount} occupants for ${alert.idleSeconds}s!`,
        sound: 'default',
        priority: NotificationsModule.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 200, 500],
        data: { alertId: alert.id, classroomId: alert.classroomId },
      },
      trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL_ID } : null,
    });
  } catch (error) {
    console.warn('[Notification] System notification dispatch:', error);
  }
}
