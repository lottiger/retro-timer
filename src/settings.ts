import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from './theme';

export type ChessBehavior = 'switch' | 'restart';

export interface Settings {
  /** What a tap does in chess mode. */
  behavior: ChessBehavior;
  /** Time per player in chess mode, seconds. */
  chessSeconds: number;
  /** Seconds added to a player's clock when they complete a turn (0 = none). */
  chessIncrementSeconds: number;
  /** Length of one turn in "restart next player" mode, seconds. */
  turnSeconds: number;
  /** Last duration chosen on the Custom screen, seconds. */
  customSeconds: number;
  /** Rotate each chess player's half toward them (phone lying between players). */
  chessFacePlayers: boolean;
  sound: boolean;
  haptics: boolean;
  /** Appearance: follow the system, or force dark/light. */
  themeMode: ThemeMode;
}

export const DEFAULT_SETTINGS: Settings = {
  behavior: 'switch',
  chessSeconds: 180,
  chessIncrementSeconds: 0,
  turnSeconds: 60,
  customSeconds: 300,
  chessFacePlayers: false,
  sound: true,
  haptics: true,
  themeMode: 'system',
};

const KEY = 'hourglass.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // non-fatal: settings simply won't persist
  }
}
