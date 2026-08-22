import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import type { Settings } from '../settings';

interface HomeScreenProps {
  settings: Settings;
  onChangeSettings: (patch: Partial<Settings>) => void;
  onPickDuration: (seconds: number) => void;
  onPickCustom: () => void;
  onPickChess: () => void;
}

const OPTIONS = [
  { label: '30 sec', seconds: 30 },
  { label: '1 min', seconds: 60 },
  { label: '1 min 30', seconds: 90 },
  { label: '2 min', seconds: 120 },
] as const;

export function HomeScreen({
  settings,
  onChangeSettings,
  onPickDuration,
  onPickCustom,
  onPickChess,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const toggle = (key: 'sound' | 'haptics') => {
    const next = !settings[key];
    onChangeSettings({ [key]: next });
    if (key === 'haptics' ? next : settings.haptics) {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const THEME_ORDER = ['system', 'dark', 'light'] as const;
  const THEME_LABEL = { system: 'Auto', dark: 'Dark', light: 'Light' } as const;
  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(settings.themeMode);
    onChangeSettings({ themeMode: THEME_ORDER[(idx + 1) % THEME_ORDER.length] });
    if (settings.haptics) Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {OPTIONS.map((o) => (
        <Pressable
          key={o.seconds}
          style={({ pressed }) => [
            styles.option,
            { borderBottomColor: theme.hairline },
            pressed && { backgroundColor: theme.pressed },
          ]}
          onPress={() => onPickDuration(o.seconds)}
          accessibilityRole="button"
          accessibilityLabel={`Start ${o.label} hourglass`}
        >
          <Text style={[styles.label, { color: theme.text }]}>{o.label}</Text>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [
          styles.option,
          { borderBottomColor: theme.hairline },
          pressed && { backgroundColor: theme.pressed },
        ]}
        onPress={onPickCustom}
        accessibilityRole="button"
        accessibilityLabel="Choose a custom duration"
      >
        <Text style={[styles.label, { color: theme.text }]}>Custom</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.option, styles.last, pressed && { backgroundColor: theme.pressed }]}
        onPress={onPickChess}
        accessibilityRole="button"
        accessibilityLabel="Start chess clock"
      >
        <Text style={[styles.label, { color: theme.sand }]}>Chess</Text>
      </Pressable>
      <View style={styles.feedbackRow}>
        <Pressable
          onPress={() => toggle('sound')}
          hitSlop={12}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.sound }}
          accessibilityLabel="Sound"
        >
          <Text
            style={[
              styles.feedback,
              { color: settings.sound ? theme.dim : theme.faint },
              !settings.sound && styles.feedbackOff,
            ]}
          >
            Sound
          </Text>
        </Pressable>
        <Pressable
          onPress={cycleTheme}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${THEME_LABEL[settings.themeMode]}. Tap to change.`}
        >
          <Text style={[styles.feedback, { color: theme.dim }]}>
            {THEME_LABEL[settings.themeMode]}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => toggle('haptics')}
          hitSlop={12}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.haptics }}
          accessibilityLabel="Haptics"
        >
          <Text
            style={[
              styles.feedback,
              { color: settings.haptics ? theme.dim : theme.faint },
              !settings.haptics && styles.feedbackOff,
            ]}
          >
            Haptics
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  last: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 42,
    fontWeight: '200',
    letterSpacing: 2,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    paddingVertical: 16,
  },
  feedback: {
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  feedbackOff: {
    textDecorationLine: 'line-through',
  },
});
