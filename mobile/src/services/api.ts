import axios, { type AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServerUrl } from './config';

export const AUTH_TOKEN_KEY = 'occueye_auth_token';

let apiInstance: AxiosInstance | null = null;

export async function getApiClient(): Promise<AxiosInstance> {
  const baseURL = await getServerUrl();

  if (!apiInstance || apiInstance.defaults.baseURL !== baseURL) {
    apiInstance = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    apiInstance.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  return apiInstance;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    username: string;
    role: string;
  };
}

export async function loginApi(username: string, password: string): Promise<LoginResponse> {
  const client = await getApiClient();
  const response = await client.post<LoginResponse>('/api/auth/login', {
    username,
    password,
  });
  return response.data;
}

export async function verifyAuthApi(): Promise<{ success: boolean; user: { username: string; role: string } }> {
  const client = await getApiClient();
  const response = await client.get('/api/auth/me');
  return response.data;
}

export async function changePasswordApi(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const client = await getApiClient();
  const response = await client.patch<{ success: boolean; message: string }>(
    '/api/auth/change-password',
    { currentPassword, newPassword }
  );
  return response.data;
}

export async function updateUsernameApi(
  newUsername: string
): Promise<{ success: boolean; message: string; token: string; user: { username: string; role: string } }> {
  const client = await getApiClient();
  const response = await client.patch<{
    success: boolean;
    message: string;
    token: string;
    user: { username: string; role: string };
  }>('/api/auth/update-username', { newUsername });
  return response.data;
}

export interface AlertItem {
  id: number;
  classroomId: string;
  studentCount: number;
  fanStatus: string;
  idleSeconds: number;
  snapshotUrl: string | null;
  cloudinaryPublicId: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export async function getAlertsApi(resolved?: boolean): Promise<{ success: boolean; count: number; alerts: AlertItem[] }> {
  const client = await getApiClient();
  const params = resolved !== undefined ? { resolved: String(resolved) } : {};
  const response = await client.get('/api/alerts', { params });
  return response.data;
}

export async function resolveAlertApi(id: number): Promise<{ success: boolean; alert: AlertItem }> {
  const client = await getApiClient();
  const response = await client.patch(`/api/alerts/${id}/resolve`);
  return response.data;
}
