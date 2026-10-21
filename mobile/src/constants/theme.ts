import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#2563EB',
    primaryLight: '#EFF6FF',
    secondary: '#0F172A',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    success: '#10B981',
    successLight: '#ECFDF5',
  },
  dark: {
    primary: '#3B82F6',
    primaryLight: '#1E293B',
    secondary: '#F8FAFC',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    success: '#10B981',
    successLight: '#ECFDF5',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
