import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SERVER_URL_KEY = 'occueye_server_url';
const PRODUCTION_FALLBACK_URL = 'https://occupeye.onrender.com';

const rawUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  PRODUCTION_FALLBACK_URL;

export const API_URL = rawUrl.trim().replace(/\/+$/, '');
export const DEFAULT_SERVER_URL = API_URL;

export async function getServerUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
    return saved || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

export async function setServerUrl(url: string): Promise<void> {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    await AsyncStorage.setItem(SERVER_URL_KEY, cleanUrl);
  } catch (error) {
    console.error('Failed to save server URL:', error);
  }
}
