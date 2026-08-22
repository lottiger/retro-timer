import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useTheme } from '../theme';

const HEIGHT = 10;

interface EdgeShadowProps {
  /** 'down' fades downward (under a header), 'up' fades upward (above a footer). */
  direction: 'down' | 'up';
}

/** A soft cast-shadow band that gives headers and footers a sense of depth. */
export function EdgeShadow({ direction }: EdgeShadowProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const down = direction === 'down';
  return (
    <View pointerEvents="none">
      <Canvas style={{ width, height: HEIGHT }}>
        <Rect x={0} y={0} width={width} height={HEIGHT}>
          <LinearGradient
            start={vec(0, down ? 0 : HEIGHT)}
            end={vec(0, down ? HEIGHT : 0)}
            colors={[theme.edgeShadow, 'rgba(0,0,0,0)']}
          />
        </Rect>
      </Canvas>
    </View>
  );
}
