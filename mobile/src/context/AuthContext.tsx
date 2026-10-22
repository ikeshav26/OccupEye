import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginApi, verifyAuthApi, AUTH_TOKEN_KEY } from '../services/api';
import { registerForPushNotifications, unregisterPushNotifications } from '../services/notifications';
import { disconnectSocket } from '../services/socket';

const USER_DATA_KEY = 'occueye_user_data';

export interface User {
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateUser: (user: User, token?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  updateUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSavedAuth();
  }, []);

  const checkSavedAuth = async () => {
    try {
      const savedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      const savedUser = await AsyncStorage.getItem(USER_DATA_KEY);

      if (savedToken) {
        setToken(savedToken);
        registerForPushNotifications().catch(() => {});
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            setUser({ username: 'admin', role: 'admin' });
          }
        } else {
          setUser({ username: 'admin', role: 'admin' });
        }

        verifyAuthApi()
          .then((res) => {
            if (res.success && res.user) {
              setUser(res.user);
              AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(res.user));
            }
          })
          .catch(() => {});
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const res = await loginApi(username, password);
      if (res.success && res.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, res.token);
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(res.user));
        setToken(res.token);
        setUser(res.user);
        registerForPushNotifications().catch(() => {});
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed' };
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Connection to server failed. Check your network.';
      return { success: false, message: errorMsg };
    }
  };

  const logout = async () => {
    try {
      await unregisterPushNotifications().catch(() => {});
      disconnectSocket();
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      await AsyncStorage.removeItem(USER_DATA_KEY);
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = async (newUser: User, newToken?: string) => {
    setUser(newUser);
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(newUser));
    if (newToken) {
      setToken(newToken);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        isLoading,
        login,
        logout,
        updateUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
