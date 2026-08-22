import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'dark' | 'light';

/** Set by App from the saved settings; 'system' follows the OS appearance. */
export const ThemeModeContext = createContext<ThemeMode>('system');

export const darkTheme = {
  bg: '#0B0E13',
  /** Soft center glow for the backdrop vignette. */
  bgGlow: '#141926',
  text: '#E8EAF0',
  dim: 'rgba(232, 234, 240, 0.8)',
  faint: 'rgba(232, 234, 240, 0.65)',
  hairline: 'rgba(232,234,240,0.08)',
  sand: '#E2B26A',
  sandDeep: '#C98F45',
  sandBright: '#F0C98A',
  glassStroke: 'rgba(235,240,250,0.32)',
  glassFillTop: 'rgba(255,255,255,0.10)',
  glassFillBottom: 'rgba(255,255,255,0.03)',
  highlight: 'rgba(255,255,255,0.16)',
  cap: '#232933',
  capEdge: '#2E3542',
  pressed: 'rgba(255,255,255,0.04)',
  selectedTint: 'rgba(226,178,106,0.06)',
};

export type Theme = typeof darkTheme;

export const lightTheme: Theme = {
  bg: '#F5F2EB',
  bgGlow: '#FCFAF5',
  text: '#23262C',
  dim: 'rgba(35, 38, 44, 0.8)',
  faint: 'rgba(35, 38, 44, 0.6)',
  hairline: 'rgba(35,38,44,0.10)',
  sand: '#D29A48',
  sandDeep: '#B37E31',
  sandBright: '#E7B76B',
  glassStroke: 'rgba(40,45,55,0.35)',
  glassFillTop: 'rgba(30,35,45,0.06)',
  glassFillBottom: 'rgba(30,35,45,0.02)',
  highlight: 'rgba(255,255,255,0.55)',
  cap: '#4A4438',
  capEdge: '#5C5546',
  pressed: 'rgba(0,0,0,0.04)',
  selectedTint: 'rgba(178,126,49,0.08)',
};

/** Resolves the chosen theme mode; 'system' follows the OS, dark when unknown. */
export function useTheme(): Theme {
  const mode = useContext(ThemeModeContext);
  const scheme = useColorScheme();
  const effective = mode === 'system' ? scheme : mode;
  return effective === 'light' ? lightTheme : darkTheme;
}
