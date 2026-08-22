import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import {
  cancelAnimation,
  Easing,
  runOnJS,
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

interface ChessScreenProps {
  settings: Settings;
  onBack: () => void;
  onOpenSettings: () => void;
}

type Side = 'L' | 'R';
type Phase = 'idle' | 'running' | 'paused';

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ChessScreen({ settings, onBack, onOpenSettings }: ChessScreenProps) {
  useKeepAwake();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playChime = useChime();

  const size = Math.min(width * 0.36, height * 0.32);
  const totalMs =
    (settings.behavior === 'restart' ? settings.turnSeconds : settings.chessSeconds) * 1000;

  const pL = useSharedValue(0);
  const pR = useSharedValue(0);
  const runL = useSharedValue(0);
  const runR = useSharedValue(0);
  const glowL = useSharedValue(0);
  const glowR = useSharedValue(0);

  // Wall-clock bookkeeping is the source of truth for time; the shared
  // values only drive the sand. This allows banking time above the starting
  // amount (Fischer increment) and is immune to frame-timing drift.
  const remainRef = useRef<Record<Side, number>>({ L: totalMs, R: totalMs });
  const startedAtRef = useRef(0);
  const activeRef = useRef<Side>('L');
  const phaseRef = useRef<Phase>('idle');
  const flaggedRef = useRef<Record<Side, boolean>>({ L: false, R: false });
  const notifId = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [flagged, setFlagged] = useState<Record<Side, boolean>>({ L: false, R: false });
  const [times, setTimes] = useState({ L: fmt(totalMs), R: fmt(totalMs) });

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const sv = (side: Side) =>
    side === 'L'
      ? { p: pL, run: runL, glow: glowL }
      : { p: pR, run: runR, glow: glowR };

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const liveRemaining = (side: Side): number => {
    if (side === activeRef.current && phaseRef.current === 'running') {
      return Math.max(0, remainRef.current[side] - (Date.now() - startedAtRef.current));
    }
    return remainRef.current[side];
  };

  /** Sand fraction for a given remaining time (banked time shows as full). */
  const fractionFor = (remaining: number) => 1 - Math.min(remaining, totalMs) / totalMs;

  const onFlag = (side: Side) => {
    remainRef.current[side] = 0;
    if (flaggedRef.current[side]) return;
    flaggedRef.current[side] = true;
    setFlagged({ ...flaggedRef.current });
    const { run, glow } = sv(side);
    run.value = 0;
    glow.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0.35, { duration: 800 })
    );
    if (settingsRef.current.haptics) finishHaptic();
    if (settingsRef.current.sound) playChime();
  };

  /** Starts (or resumes) the active side's clock from its stored remaining time. */
  const startActive = () => {
    const side = activeRef.current;
    const { p, run, glow } = sv(side);
    const other = sv(side === 'L' ? 'R' : 'L');
    other.glow.value = withTiming(0, { duration: 250 });
    glow.value = withTiming(1, { duration: 250 });
    const remaining = remainRef.current[side];
    if (remaining <= 0) {
      run.value = 0;
      onFlag(side);
      return;
    }
    startedAtRef.current = Date.now();
    run.value = 1;
    // Banked time (remaining > total) keeps the glass full for the excess,
    // then the sand drains over the visible `total` window.
    const banked = Math.max(0, remaining - totalMs);
    const drainMs = Math.min(remaining, totalMs);
    p.value = fractionFor(remaining);
    const timing = withTiming(1, { duration: drainMs, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished) runOnJS(onFlag)(side);
    });
    p.value = banked > 0 ? withDelay(banked, timing) : timing;
    cancelNotification(notifId.current);
    scheduleExpiryNotification(
      remaining,
      `${side === 'L' ? 'Left' : 'Right'} player ran out of time.`,
      settingsRef.current.sound
    ).then((id) => {
      notifId.current = id;
    });
  };

  /** Stops the active side's clock and banks the precise remaining time. */
  const stopActive = () => {
    const side = activeRef.current;
    const { p, run } = sv(side);
    cancelAnimation(p);
    run.value = 0;
    if (phaseRef.current === 'running') {
      remainRef.current[side] = Math.max(
        0,
        remainRef.current[side] - (Date.now() - startedAtRef.current)
      );
    }
    p.value = fractionFor(remainRef.current[side]);
    cancelNotification(notifId.current);
    notifId.current = null;
  };

  const tap = () => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'paused') {
      setPhaseBoth('running');
      startActive();
      if (settingsRef.current.haptics) tapHaptic();
      return;
    }
    // running: the active player completed their turn
    const cur = activeRef.current;
    const next: Side = cur === 'L' ? 'R' : 'L';
    stopActive();
    if (remainRef.current[cur] <= 0) {
      // closes the tap-vs-flag race: wall clock says the mover already flagged
      onFlag(cur);
    } else if (
      settingsRef.current.behavior === 'switch' &&
      settingsRef.current.chessIncrementSeconds > 0
    ) {
      remainRef.current[cur] += settingsRef.current.chessIncrementSeconds * 1000;
      sv(cur).p.value = withTiming(fractionFor(remainRef.current[cur]), { duration: 250 });
    }
    if (settingsRef.current.behavior === 'restart') {
      remainRef.current[next] = totalMs;
      sv(next).p.value = 0;
      flaggedRef.current[next] = false;
      setFlagged({ ...flaggedRef.current });
    }
    activeRef.current = next;
    startActive();
    if (settingsRef.current.haptics) tapHaptic();
  };

  const longPress = () => {
    if (phaseRef.current === 'running') {
      stopActive();
      sv(activeRef.current).glow.value = withTiming(0.35, { duration: 250 });
      setPhaseBoth('paused');
    } else {
      // paused or idle: reset the whole game
      cancelAnimation(pL);
      cancelAnimation(pR);
      remainRef.current = { L: totalMs, R: totalMs };
      flaggedRef.current = { L: false, R: false };
      setFlagged({ L: false, R: false });
      pL.value = withTiming(0, { duration: 300 });
      pR.value = withTiming(0, { duration: 300 });
      runL.value = 0;
      runR.value = 0;
      glowL.value = withTiming(0, { duration: 300 });
      glowR.value = withTiming(0, { duration: 300 });
      activeRef.current = 'L';
      setPhaseBoth('idle');
      cancelNotification(notifId.current);
      notifId.current = null;
    }
    if (settingsRef.current.haptics) tapHaptic();
  };

  useEffect(() => {
    const tick = setInterval(() => {
      setTimes({ L: fmt(liveRemaining('L')), R: fmt(liveRemaining('R')) });
    }, 150);
    return () => {
      clearInterval(tick);
      cancelAnimation(pL);
      cancelAnimation(pR);
      cancelNotification(notifId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMs]);

  const hint =
    phase === 'idle'
      ? 'tap to start'
      : phase === 'paused'
        ? 'paused — tap to resume, hold to reset'
        : null;

  return (
    <Pressable
      style={[styles.root, { backgroundColor: theme.bg }]}
      onPress={tap}
      onLongPress={longPress}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={
        phase === 'running' ? 'Switch player. Long press to pause.' : 'Start. Long press to reset.'
      }
    >
      <Backdrop />
      <View style={styles.row} pointerEvents="none">
        <View style={styles.player}>
          <Hourglass size={size} progress={pL} running={runL} durationMs={totalMs} glow={glowL} />
          <Text
            style={[
              styles.time,
              { color: flagged.L ? theme.sand : theme.dim, marginTop: -size * 0.08 },
            ]}
          >
            {times.L}
          </Text>
        </View>
        <View style={styles.player}>
          <Hourglass size={size} progress={pR} running={runR} durationMs={totalMs} glow={glowR} />
          <Text
            style={[
              styles.time,
              { color: flagged.R ? theme.sand : theme.dim, marginTop: -size * 0.08 },
            ]}
          >
            {times.R}
          </Text>
        </View>
      </View>
      {hint && (
        <Text
          style={[styles.hint, { color: theme.faint, bottom: insets.bottom + 28 }]}
          pointerEvents="none"
        >
          {hint}
        </Text>
      )}
      <CornerButton
        glyph="‹"
        onPress={onBack}
        style={{ top: insets.top + 4, left: 8 }}
        accessibilityLabel="Back to menu"
      />
      <CornerButton
        glyph="⋯"
        onPress={onOpenSettings}
        style={{ top: insets.top + 4, right: 8 }}
        accessibilityLabel="Chess settings"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: {
    width: '50%',
    alignItems: 'center',
  },
  time: {
    fontSize: 26,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
