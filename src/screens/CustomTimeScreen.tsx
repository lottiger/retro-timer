import React, { useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Backdrop } from '../components/Backdrop';
import { CornerButton } from '../components/CornerButton';
import { useTheme, type Theme } from '../theme';
import type { Settings } from '../settings';

interface CustomTimeScreenProps {
  settings: Settings;
  onStart: (seconds: number) => void;
  onBack: () => void;
}

const ITEM_H = 64;
const VISIBLE = 5; // odd number of rows in the wheel window

interface WheelProps {
  count: number;
  value: number;
  onChange: (value: number) => void;
  haptics: boolean;
  theme: Theme;
  accessibilityLabel: string;
  /** Spoken after the value, e.g. "minutes" → "5 minutes". */
  unit: string;
}

/** A vertical snap wheel in the style of the native iOS timer picker. */
function Wheel({ count, value, onChange, haptics, theme, accessibilityLabel, unit }: WheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lastIdx = useRef(value);
  const initialIdx = useRef(value);

  const idxFromOffset = (y: number) =>
    Math.min(count - 1, Math.max(0, Math.round(y / ITEM_H)));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = idxFromOffset(e.nativeEvent.contentOffset.y);
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      onChange(idx);
      if (haptics) Haptics.selectionAsync().catch(() => {});
    }
  };

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = idxFromOffset(e.nativeEvent.contentOffset.y);
    lastIdx.current = idx;
    onChange(idx);
  };

  // VoiceOver "adjustable": swipe up/down steps the value one notch.
  const step = (delta: number) => {
    const idx = Math.min(count - 1, Math.max(0, lastIdx.current + delta));
    lastIdx.current = idx;
    onChange(idx);
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
    if (haptics) Haptics.selectionAsync().catch(() => {});
  };

  const pad = (ITEM_H * (VISIBLE - 1)) / 2;

  return (
    <View
      style={styles.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') step(1);
        else if (e.nativeEvent.actionName === 'decrement') step(-1);
      }}
    >
      <ScrollView
        ref={scrollRef}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: initialIdx.current * ITEM_H }}
        contentContainerStyle={{ paddingVertical: pad }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onSettle}
        onScrollEndDrag={onSettle}
      >
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={styles.wheelItem}>
            <Text style={[styles.wheelText, { color: theme.text }]}>
              {String(i).padStart(2, '0')}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View
        pointerEvents="none"
        style={[styles.lens, { borderColor: theme.glassStroke }]}
      />
    </View>
  );
}

export function CustomTimeScreen({ settings, onStart, onBack }: CustomTimeScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [minutes, setMinutes] = useState(Math.min(60, Math.floor(settings.customSeconds / 60)));
  const [seconds, setSeconds] = useState(settings.customSeconds % 60);
  const total = minutes * 60 + seconds;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Backdrop />
      <CornerButton
        glyph="‹"
        onPress={onBack}
        style={{ top: insets.top + 4, left: 8 }}
        accessibilityLabel="Back to menu"
      />
      <View style={styles.pickerArea}>
        <View style={styles.pickerRow}>
          <View style={styles.column}>
            <Text style={[styles.unit, { color: theme.faint }]}>min</Text>
            <Wheel
              count={61}
              value={minutes}
              onChange={setMinutes}
              haptics={settings.haptics}
              theme={theme}
              accessibilityLabel="Minutes"
              unit="minutes"
            />
          </View>
          <Text style={[styles.colon, { color: theme.dim }]}>:</Text>
          <View style={styles.column}>
            <Text style={[styles.unit, { color: theme.faint }]}>sec</Text>
            <Wheel
              count={60}
              value={seconds}
              onChange={setSeconds}
              haptics={settings.haptics}
              theme={theme}
              accessibilityLabel="Seconds"
              unit="seconds"
            />
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => total > 0 && onStart(total)}
        disabled={total === 0}
        style={({ pressed }) => [styles.start, (pressed || total === 0) && { opacity: 0.4 }]}
        accessibilityRole="button"
        accessibilityLabel="Start hourglass"
        accessibilityState={{ disabled: total === 0 }}
      >
        <Text style={[styles.startText, { color: theme.accent }]}>Start</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pickerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  column: {
    alignItems: 'center',
  },
  unit: {
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  colon: {
    fontSize: 44,
    fontWeight: '200',
    marginHorizontal: 8,
    paddingBottom: ITEM_H * ((VISIBLE - 1) / 2) + 12,
  },
  wheel: {
    height: ITEM_H * VISIBLE,
    width: 110,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 40,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  lens: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (ITEM_H * (VISIBLE - 1)) / 2,
    height: ITEM_H,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  start: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  startText: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 8,
    textTransform: 'uppercase',
  },
});
