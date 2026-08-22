import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Rect, RadialGradient, vec } from '@shopify/react-native-skia';
import { useTheme } from '../theme';

/**
 * A barely-there radial vignette behind every screen — a soft pool of light
 * around the center that falls off toward the edges. Static, so it renders
 * once and costs nothing.
 */
export function Backdrop() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height * 0.42)}
          r={Math.max(width, height) * 0.75}
          colors={[theme.bgGlow, theme.bg]}
        />
      </Rect>
    </Canvas>
  );
}
