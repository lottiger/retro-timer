import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { CornerButton } from '../components/CornerButton';
import { useTheme } from '../theme';
import type { ChessBehavior, Settings } from '../settings';

interface ChessSettingsScreenProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onBack: () => void;
}

const BEHAVIORS: { value: ChessBehavior; title: string; hint: string }[] = [
  {
    value: 'switch',
    title: 'Switch player',
    hint: 'Each player keeps their remaining time — a chess clock.',
  },
  {
    value: 'restart',
    title: 'Restart next player',
    hint: 'The next player always starts from full time — a turn timer.',
  },
];

const TIME_CONTROLS = [
  { label: '3+0', hint: 'Blitz', seconds: 180, increment: 0 },
  { label: '10+5', hint: 'Rapid', seconds: 600, increment: 5 },
  { label: '15+10', hint: 'Rapid', seconds: 900, increment: 10 },
];

const TURN_LENGTHS = [
  { label: '30 sec', seconds: 30 },
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
];

export function ChessSettingsScreen({ settings, onChange, onBack }: ChessSettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const chipStyle = (selected: boolean) => [
    styles.chip,
    {
      borderColor: selected ? theme.accentDeep : 'transparent',
      backgroundColor: selected ? theme.selectedTint : theme.pressed,
    },
  ];

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 56, paddingBottom: insets.bottom },
      ]}
    >
      <Backdrop />
      <CornerButton
        glyph="‹"
        onPress={onBack}
        style={{ top: insets.top + 4, left: 8 }}
        accessibilityLabel="Back to chess"
      />

      <Text style={[styles.section, { color: theme.faint }]}>Touch behavior</Text>
      {BEHAVIORS.map((b) => {
        const selected = settings.behavior === b.value;
        return (
          <Pressable
            key={b.value}
            style={[
              styles.card,
              {
                borderColor: selected ? theme.accentDeep : 'transparent',
                backgroundColor: selected ? theme.selectedTint : theme.pressed,
              },
            ]}
            onPress={() => onChange({ behavior: b.value })}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={b.title}
          >
            <Text style={[styles.cardTitle, { color: selected ? theme.accent : theme.text }]}>
              {b.title}
            </Text>
            <Text style={[styles.cardHint, { color: theme.dim }]}>{b.hint}</Text>
          </Pressable>
        );
      })}

      {settings.behavior === 'switch' ? (
        <>
          <Text style={[styles.section, { color: theme.faint }]}>Time control</Text>
          <View style={styles.chips}>
            {TIME_CONTROLS.map((tc) => {
              const selected =
                settings.chessSeconds === tc.seconds &&
                settings.chessIncrementSeconds === tc.increment;
              return (
                <Pressable
                  key={tc.label}
                  style={chipStyle(selected)}
                  onPress={() =>
                    onChange({ chessSeconds: tc.seconds, chessIncrementSeconds: tc.increment })
                  }
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${tc.label} ${tc.hint}`}
                >
                  <Text style={[styles.chipText, { color: selected ? theme.accent : theme.dim }]}>
                    {tc.label}
                  </Text>
                  <Text style={[styles.chipHint, { color: selected ? theme.accent : theme.faint }]}>
                    {tc.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.section, { color: theme.faint }]}>Time per turn</Text>
          <View style={styles.chips}>
            {TURN_LENGTHS.map((t) => {
              const selected = settings.turnSeconds === t.seconds;
              return (
                <Pressable
                  key={t.seconds}
                  style={chipStyle(selected)}
                  onPress={() => onChange({ turnSeconds: t.seconds })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${t.label} per turn`}
                >
                  <Text style={[styles.chipText, { color: selected ? theme.accent : theme.dim }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 30,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  cardHint: {
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 5,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    minWidth: 88,
  },
  chipText: {
    fontSize: 15,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  chipHint: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
