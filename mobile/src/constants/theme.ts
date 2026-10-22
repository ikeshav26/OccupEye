import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#00A896',
    primaryLight: '#E6FFFA',
    secondary: '#1C1917',
    background: '#FAF7F2',
    surface: '#F5EFEB',
    card: '#FFFFFF',
    border: '#EAE2D5',
    divider: '#EFE8DE',
    text: '#1C1917',
    textSecondary: '#68625D',
    textMuted: '#9E968F',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    warning: '#F59E0B',
    warningLight: '#FFFBEB',
    success: '#10B981',
    successLight: '#ECFDF5',
  },
  dark: {
    primary: '#00A896',
    primaryLight: '#1E293B',
    secondary: '#F8FAFC',
    background: '#1A1816',
    surface: '#24211E',
    card: '#292522',
    border: '#3D3833',
    divider: '#332E29',
    text: '#FAF7F2',
    textSecondary: '#D6CEC5',
    textMuted: '#9E968F',
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
