import React, { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  hideToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const insetsBottom = insets.bottom ?? 20;

  const [toast, setToast] = useState<ToastOptions | null>(null);

  const translateY = useRef(new Animated.Value(50)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 50,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [translateY, scale, opacity]);

  const showToast = useCallback(
    ({ type = 'info', title, message, duration = 3200 }: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({ type, title, message });

      translateY.setValue(50);
      scale.setValue(0.95);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 5,
          speed: 18,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          bounciness: 4,
          speed: 18,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [translateY, scale, opacity, hideToast]
  );

  const getToastConfig = (type: ToastType = 'info') => {
    switch (type) {
      case 'success':
        return {
          icon: 'check' as const,
          iconColor: '#059669',
          iconBg: '#ECFDF5',
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          iconColor: '#DC2626',
          iconBg: '#FEF2F2',
        };
      case 'info':
      default:
        return {
          icon: 'info' as const,
          iconColor: '#00A896',
          iconBg: '#F0FDFA',
        };
    }
  };

  const config = getToastConfig(toast?.type);

  const bottomPosition = (Platform.OS === 'ios' ? 84 : 68) + Math.max(insetsBottom, 12);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}

      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              bottom: bottomPosition,
              transform: [{ translateY }, { scale }],
              opacity,
            },
          ]}
          pointerEvents="box-none">
          <TouchableOpacity
            style={styles.toastCard}
            activeOpacity={0.92}
            onPress={hideToast}>
            <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
              <Feather name={config.icon} size={15} color={config.iconColor} />
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.titleText} numberOfLines={1}>
                {toast.title}
              </Text>
              {toast.message && (
                <Text style={styles.messageText} numberOfLines={2}>
                  {toast.message}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={hideToast}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}>
              <Feather name="x" size={13} color="#9E968F" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 99999,
    alignItems: 'center',
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EAE2D5',
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  titleText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C1917',
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#68625D',
    marginTop: 1,
    lineHeight: 16,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F5EFEB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE2D5',
  },
});
