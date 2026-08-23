import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Hourglass } from '../hourglass/Hourglass';
import { Backdrop } from '../components/Backdrop';
import { CornerButton } from '../components/CornerButton';
import { useChime } from '../useChime';
import { finishHaptic, tapHaptic } from '../haptics';
import { cancelNotification, scheduleExpiryNotification } from '../notifications';
import { useTheme } from '../theme';
import type { Settings } from '../settings';

interface TimerScreenProps {
  seconds: number;
  settings: Settings;
  onBack: () => void;
}

const FLIP_MS = 550;

export function TimerScreen({ seconds, settings, onBack }: TimerScreenProps) {
  useKeepAwake();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playChime = useChime();

  const size = Math.min(width, height) * 0.62;
  const durationMs = seconds * 1000;

  const progress = useSharedValue(0);
  const running = useSharedValue(0);
  const glow = useSharedValue(0);
  const flip = useSharedValue(0);
  const flipping = useRef(false);
  const notifId = useRef<string | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [a11yTime, setA11yTime] = useState('');

  // A fleeting whisper shown when the glass starts: fades in, lingers a
  // moment, fades away — enough to teach the gesture without cluttering.
  const hintOpacity = useSharedValue(0);
  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOpacity.value }));
  const whisperHint = () => {
    hintOpacity.value = withSequence(
      withTiming(1, { duration: 500 }),
      withDelay(2400, withTiming(0, { duration: 900 }))
    );
  };

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onFinished = () => {
    running.value = 0;
    glow.value = withSequence(
      withTiming(1, { duration: 250 }),
      withTiming(0.3, { duration: 900 })
    );
    if (settingsRef.current.haptics) finishHaptic();
    if (settingsRef.current.sound) playChime();
  };

  const start = () => {
    glow.value = withTiming(0, { duration: 200 });
    progress.value = 0;
    running.value = 1;
    pausedRef.current = false;
    setPaused(false);
    cancelNotification(notifId.current);
    notifId.current = null;
    scheduleExpiryNotification(
      durationMs,
      'The hourglass has finished.',
      settingsRef.current.sound
    ).then((id) => {
      notifId.current = id;
    });
    progress.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        'worklet';
        if (finished) runOnJS(onFinished)();
      }
    );
  };

  // Long press freezes the sand mid-flow; the next tap lets it run again.
  const pause = () => {
    if (flipping.current || pausedRef.current) return;
    if (progress.value >= 0.999) return; // already finished — nothing to pause
    pausedRef.current = true;
    setPaused(true);
    cancelAnimation(progress);
    running.value = 0;
    cancelNotification(notifId.current);
    notifId.current = null;
    if (settingsRef.current.haptics) tapHaptic();
  };

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    const remainingMs = durationMs * (1 - progress.value);
    running.value = 1;
    scheduleExpiryNotification(
      remainingMs,
      'The hourglass has finished.',
      settingsRef.current.sound
    ).then((id) => {
      notifId.current = id;
    });
    progress.value = withTiming(
      1,
      { duration: remainingMs, easing: Easing.linear },
      (finished) => {
        'worklet';
        if (finished) runOnJS(onFinished)();
      }
    );
    if (settingsRef.current.haptics) tapHaptic();
  };

  useEffect(() => {
    start();
    whisperHint();
    return () => {
      cancelAnimation(progress);
      cancelNotification(notifId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  // Remaining time for screen readers only — the visual stays numberless.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (!enabled || !mounted) return;
        interval = setInterval(() => {
          const rem = Math.max(0, Math.ceil((durationMs * (1 - progress.value)) / 1000));
          setA11yTime(rem > 0 ? `${rem} seconds remaining` : 'Finished');
        }, 1000);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  // Tap anywhere: flip the glass over and let it run again. While the glass
  // turns, the remaining sand "dumps" into the lower chamber; at the moment
  // the 180° flip completes, flip=180/progress=1 renders identically to
  // flip=0/progress=0, so we snap both and restart without any visible jump.
  const restart = () => {
    if (flipping.current) return;
    if (pausedRef.current) {
      resume();
      return;
    }
    flipping.current = true;
    cancelAnimation(progress);
    cancelNotification(notifId.current);
    notifId.current = null;
    running.value = 0;
    glow.value = withTiming(0, { duration: 150 });
    if (settingsRef.current.haptics) tapHaptic();
    progress.value = withTiming(1, { duration: FLIP_MS * 0.55, easing: Easing.in(Easing.quad) });
    flip.value = withTiming(
      flip.value + 180,
      { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) {
          flip.value = flip.value - 180;
          progress.value = 0;
        }
        runOnJS(afterFlip)();
      }
    );
  };

  const afterFlip = () => {
    flipping.current = false;
    start();
  };

  return (
    <Pressable
      style={[styles.root, { backgroundColor: theme.bg }]}
      onPress={restart}
      onLongPress={pause}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={
        paused ? 'Resume hourglass' : 'Restart hourglass. Long press to pause.'
      }
      accessibilityValue={a11yTime ? { text: a11yTime } : undefined}
    >
      <Backdrop />
      <View style={styles.center} pointerEvents="none">
        <Hourglass
          size={size}
          progress={progress}
          running={running}
          durationMs={durationMs}
          glow={glow}
          rotation={flip}
        />
      </View>
      {paused ? (
        <Text
          style={[styles.hint, { color: theme.faint, bottom: insets.bottom + 28 }]}
          pointerEvents="none"
        >
          paused — tap to resume
        </Text>
      ) : (
        <Animated.Text
          style={[styles.hint, { color: theme.faint, bottom: insets.bottom + 28 }, hintStyle]}
          pointerEvents="none"
        >
          tap to restart — hold to pause
        </Animated.Text>
      )}
      <CornerButton
        glyph="‹"
        onPress={onBack}
        style={{ top: insets.top + 4, left: 8 }}
        accessibilityLabel="Back to menu"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
