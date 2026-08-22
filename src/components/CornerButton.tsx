import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface CornerButtonProps {
  glyph: string;
  onPress: () => void;
  style?: ViewStyle;
  accessibilityLabel: string;
}

/** A deliberately faint touch target tucked into a screen corner. */
export function CornerButton({ glyph, onPress, style, accessibilityLabel }: CornerButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={16}
      style={({ pressed }) => [styles.btn, style, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.glyph, { color: theme.faint }]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  glyph: {
    fontSize: 26,
    fontWeight: '300',
  },
});
