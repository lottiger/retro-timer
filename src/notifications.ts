import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Suppress banners while the app is open — the hourglass itself, the chime
// and the haptics are the in-app signal. Notifications exist for the case
// where the timer expires while the app is in the background or the phone
// is locked.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

let channelReady = false;

async function prepare(): Promise<boolean> {
  try {
    if (!channelReady) {
      channelReady = true;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('timer', {
          name: 'Timer',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Schedules a "time is up" notification `ms` from now. Returns the
 * notification id, or null if permission is missing or ms is too small.
 */
export async function scheduleExpiryNotification(
  ms: number,
  body: string,
  sound: boolean
): Promise<string | null> {
  if (ms < 1500) return null;
  if (!(await prepare())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Time is up', body, sound },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(2, Math.round(ms / 1000)),
        channelId: 'timer',
      },
    });
  } catch {
    return null;
  }
}

export function cancelNotification(id: string | null | undefined): void {
  if (!id) return;
  Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
