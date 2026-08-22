import * as Haptics from 'expo-haptics';

/** Crisp single knock — used for restart taps and player switches. */
export function tapHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
}

/** One clear, heavy thud — used when a timer runs out. */
export function finishHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}
