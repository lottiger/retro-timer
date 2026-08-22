import React, { useMemo } from 'react';
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  Oval,
  Path,
  RoundedRect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { buildGeometry, levelAt } from './geometry';
import { useTheme } from '../theme';

interface HourglassProps {
  /** Glass width in px. The canvas is a square of size*2.1 around it. */
  size: number;
  /** 0 = all sand on top, 1 = all sand at the bottom. */
  progress: SharedValue<number>;
  /** 1 while sand is flowing, 0 when frozen/finished. */
  running: SharedValue<number>;
  /** Total duration in ms — drives grain motion from elapsed time. */
  durationMs: number;
  /** 0..1 highlight strength (active player / finished pulse). */
  glow?: SharedValue<number>;
  /** Extra rotation in degrees (gravity counter-rotation + restart flip). */
  rotation?: SharedValue<number>;
}

export function Hourglass({ size, progress, running, durationMs, glow, rotation }: HourglassProps) {
  const geo = useMemo(() => buildGeometry(size), [size]);
  const theme = useTheme();
  const zero = useSharedValue(0);
  const glowSV = glow ?? zero;
  const rotSV = rotation ?? zero;

  const { cx, R, yTopIn, yNeckTop, yNeckBot, yBotIn, capH, topLevelLUT, botLevelLUT } = geo;

  // Upper chamber sand: everything below the (slightly funnel-dipped)
  // surface, clipped to the chamber interior.
  const topSandPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const remaining = 1 - progress.value;
    if (remaining <= 0.001) return p;
    const ySurf = levelAt(topLevelLUT, remaining);
    const dip = Math.min(size * 0.05, (yNeckTop - ySurf) * 0.35);
    p.moveTo(cx - R - 4, ySurf);
    p.quadTo(cx, ySurf + dip * 2, cx + R + 4, ySurf);
    p.lineTo(cx + R + 4, yNeckTop + 4);
    p.lineTo(cx - R - 4, yNeckTop + 4);
    p.close();
    return p;
  });

  // Lower chamber sand: a pile with a mound that grows under the stream and
  // settles flat as the last grains land.
  const botSandPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const filled = progress.value;
    if (filled <= 0.001) return p;
    const ySurf = levelAt(botLevelLUT, filled);
    const headroom = ySurf - yNeckBot;
    const settle = 0.25 + 0.75 * Math.min(1, (1 - filled) * 6);
    const mound = Math.min(size * 0.055, headroom * 0.4) * settle;
    p.moveTo(cx - R - 4, ySurf);
    p.quadTo(cx, ySurf - mound * 2, cx + R + 4, ySurf);
    p.lineTo(cx + R + 4, yBotIn + 4);
    p.lineTo(cx - R - 4, yBotIn + 4);
    p.close();
    return p;
  });

  // The falling stream plus a few loose grains, only while running. Grain
  // motion is driven by elapsed time (progress × duration) instead of a
  // frame clock, so a paused or finished glass causes zero redraws.
  const streamPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    if (running.value < 0.5) return p;
    const remaining = 1 - progress.value;
    if (remaining <= 0.001 || progress.value >= 0.999) return p;
    const yLand = levelAt(botLevelLUT, Math.max(progress.value, 0.02));
    const t = progress.value * durationMs;
    const w = size * 0.008 + size * 0.003 * Math.sin(t / 67);
    p.addRect(Skia.XYWHRect(cx - w, yNeckTop - 3, w * 2, yLand - yNeckTop + 3));
    // a few grains drifting just off the stream
    const len = yLand - yNeckBot;
    for (let i = 0; i < 4; i++) {
      const yy = yNeckBot + ((t * 0.28 + i * 41) % Math.max(len, 1));
      const xx = cx + Math.sin(i * 2.4 + t / 130) * size * 0.02;
      p.addCircle(xx, yy, size * 0.006);
    }
    return p;
  });

  const streamOpacity = useDerivedValue(() =>
    running.value > 0.5 && progress.value < 0.999 ? 0.95 : 0
  );

  const glowOpacity = useDerivedValue(() => glowSV.value * 0.55);
  const glowFillOpacity = useDerivedValue(() => glowSV.value * 0.07);

  // The ground shadow fades as the glass tilts away from upright, so it
  // never looks painted onto a rotating image.
  const shadowOpacity = useDerivedValue(() => {
    const c = Math.cos((rotSV.value * Math.PI) / 180);
    return 0.35 * Math.max(0, c) * Math.max(0, c);
  });

  // Reflection: a soft lens-shaped band of light hugging the upper bulb's
  // left curvature — wide in the middle, tapering to points at both ends,
  // like a window reflected in curved glass.
  const highlightPath = useMemo(() => {
    const p = Skia.Path.Make();
    const { topHW, N } = geo;
    const chamberH = yNeckTop - yTopIn;
    const s0 = 0.08;
    const s1 = 0.5;
    const kOuter = 0.8; // outer edge, as a fraction of the local half-width
    const kInner = 0.56; // widest point of the band
    const steps = 16;
    const outer: [number, number][] = [];
    const inner: [number, number][] = [];
    for (let j = 0; j <= steps; j++) {
      const s = s0 + ((s1 - s0) * j) / steps;
      const hw = topHW[Math.round(s * N)];
      const y = yTopIn + s * chamberH;
      const taper = Math.sin((Math.PI * j) / steps);
      outer.push([cx - hw * kOuter, y]);
      inner.push([cx - hw * (kOuter - (kOuter - kInner) * taper), y]);
    }
    p.moveTo(outer[0][0], outer[0][1]);
    for (let j = 1; j <= steps; j++) p.lineTo(outer[j][0], outer[j][1]);
    for (let j = steps; j >= 0; j--) p.lineTo(inner[j][0], inner[j][1]);
    p.close();
    return p;
  }, [geo]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotSV.value}deg` }],
  }));

  const capW = R * 2 + size * 0.09;

  return (
    <Animated.View
      style={[{ width: geo.canvasW, height: geo.canvasH }, animatedStyle]}
      pointerEvents="none"
    >
      <Canvas style={{ width: geo.canvasW, height: geo.canvasH }}>
        {/* ground shadow — wide, soft and quiet */}
        <Oval
          x={cx - R * 0.8}
          y={yBotIn + capH + size * 0.03}
          width={R * 1.6}
          height={size * 0.042}
          color="black"
          opacity={shadowOpacity}
        >
          <BlurMask blur={size * 0.055} style="normal" />
        </Oval>

        {/* active glow behind the glass */}
        <Path
          path={geo.glassPath}
          style="stroke"
          strokeWidth={size * 0.06}
          color={theme.sand}
          opacity={glowOpacity}
        >
          <BlurMask blur={size * 0.12} style="normal" />
        </Path>
        <Path path={geo.glassPath} color={theme.sand} opacity={glowFillOpacity} />

        {/* glass body — vertical tint + edge sheen for wall thickness */}
        <Path path={geo.glassPath}>
          <LinearGradient
            start={vec(cx, yTopIn)}
            end={vec(cx, yBotIn)}
            colors={[theme.glassFillTop, theme.glassFillBottom]}
          />
        </Path>
        <Path path={geo.glassPath}>
          <LinearGradient
            start={vec(cx - R, 0)}
            end={vec(cx + R, 0)}
            colors={[theme.glassFillTop, 'rgba(255,255,255,0)', theme.glassFillTop]}
            positions={[0, 0.5, 1]}
          />
        </Path>

        {/* sand — upper chamber, shaded across for a rounded volume */}
        <Group clip={geo.topClip}>
          <Path path={topSandPath}>
            <LinearGradient
              start={vec(cx - R, 0)}
              end={vec(cx + R, 0)}
              colors={[theme.sandDeep, theme.sand, theme.sandDeep]}
              positions={[0, 0.45, 1]}
            />
          </Path>
        </Group>

        {/* sand — falling stream, kept inside the glass */}
        <Group clip={geo.glassPath}>
          <Path path={streamPath} color={theme.sandBright} opacity={streamOpacity} />
        </Group>

        {/* sand — lower chamber */}
        <Group clip={geo.botClip}>
          <Path path={botSandPath}>
            <LinearGradient
              start={vec(cx - R, 0)}
              end={vec(cx + R, 0)}
              colors={[theme.sandDeep, theme.sand, theme.sandDeep]}
              positions={[0, 0.45, 1]}
            />
          </Path>
        </Group>

        {/* glass outline + highlight */}
        <Path
          path={geo.glassPath}
          style="stroke"
          strokeWidth={size * 0.009}
          color={theme.glassStroke}
        />
        <Path path={highlightPath} color={theme.highlight}>
          <BlurMask blur={size * 0.014} style="normal" />
        </Path>

        {/* caps — lit from above */}
        <RoundedRect
          x={cx - capW / 2}
          y={yTopIn - capH + 2}
          width={capW}
          height={capH}
          r={size * 0.02}
        >
          <LinearGradient
            start={vec(0, yTopIn - capH + 2)}
            end={vec(0, yTopIn + 2)}
            colors={[theme.capEdge, theme.cap]}
          />
        </RoundedRect>
        <RoundedRect
          x={cx - capW / 2}
          y={yBotIn - 2}
          width={capW}
          height={capH}
          r={size * 0.02}
        >
          <LinearGradient
            start={vec(0, yBotIn - 2)}
            end={vec(0, yBotIn - 2 + capH)}
            colors={[theme.capEdge, theme.cap]}
          />
        </RoundedRect>
      </Canvas>
    </Animated.View>
  );
}
