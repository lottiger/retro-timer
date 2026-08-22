import { Skia, type SkPath } from '@shopify/react-native-skia';

/**
 * All the static geometry for one hourglass, in canvas pixels.
 *
 * The interior silhouette is defined by a half-width function sampled into
 * arrays; the same samples drive the glass outline, the sand clip paths and
 * the area→level lookup tables, so the sand level always matches the shape
 * exactly and the amount of sand accurately represents remaining time.
 */
export interface HourglassGeometry {
  canvasW: number;
  canvasH: number;
  cx: number;
  R: number; // widest half-width of a bulb
  neckR: number;
  yTopIn: number; // top of the interior (under the top cap)
  yNeckTop: number; // bottom of the upper chamber
  yNeckBot: number; // top of the lower chamber
  yBotIn: number; // bottom of the interior
  capH: number;
  N: number; // samples per chamber
  topHW: number[]; // half-widths, index 0 = yTopIn … N = yNeckTop
  botHW: number[]; // half-widths, index 0 = yNeckBot … N = yBotIn
  /** fraction of sand (0..1) → y of the upper sand surface */
  topLevelLUT: number[];
  /** fraction of sand (0..1) → y of the lower sand surface */
  botLevelLUT: number[];
  glassPath: SkPath; // full interior outline (both chambers + neck)
  topClip: SkPath;
  botClip: SkPath;
}

/** Interior half-width profile of one bulb. s=0 at the flat cap end, s=1 at the neck. */
function halfWidth(s: number, R: number, neckR: number): number {
  const dome = 0.32; // portion of the height taken by the rounded shoulder
  const capRatio = 0.55; // half-width at the flat cap end, as a fraction of R
  if (s < dome) {
    const q = (dome - s) / dome;
    return R * Math.sqrt(1 - q * q * (1 - capRatio * capRatio));
  }
  const u = (s - dome) / (1 - dome);
  return neckR + (R - neckR) * Math.pow(Math.cos((u * Math.PI) / 2), 1.15);
}

const LUT_SIZE = 64;
/** Sand fills this fraction of one chamber when "full" — leaves a little air like a real hourglass. */
export const FILL_RATIO = 0.88;

export function buildGeometry(size: number): HourglassGeometry {
  // `size` is the glass width; the canvas is a square big enough for the
  // glass to rotate freely with gravity without clipping.
  const canvasW = size * 2.1;
  const canvasH = size * 2.1;
  const cx = canvasW / 2;
  const R = size * 0.5;
  const neckR = R * 0.075;
  const glassH = size * 1.55;
  const capH = size * 0.055;
  const neckGap = size * 0.045;

  const yTopIn = (canvasH - glassH) / 2;
  const yBotIn = yTopIn + glassH;
  const chamberH = (glassH - neckGap) / 2;
  const yNeckTop = yTopIn + chamberH;
  const yNeckBot = yNeckTop + neckGap;

  const N = 48;
  const topHW: number[] = [];
  const botHW: number[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    topHW.push(halfWidth(s, R, neckR)); // s=0 at top cap → s=1 at neck
    botHW.push(halfWidth(1 - s, R, neckR)); // index 0 at neck → N at bottom cap
  }

  const dy = chamberH / N;

  // Cumulative cross-section area of the upper chamber measured upward from
  // the neck: areaUp[k] = area between sample (N-k) and the neck.
  const areaUp: number[] = [0];
  for (let k = 1; k <= N; k++) {
    const i = N - k;
    areaUp.push(areaUp[k - 1] + (topHW[i] + topHW[i + 1]) * dy); // trapezoid, ×2 halves cancel /2
  }
  const chamberArea = areaUp[N];
  const sandArea = chamberArea * FILL_RATIO;

  // Upper surface level: fraction f of the sand remaining → y.
  const topLevelLUT: number[] = [];
  for (let k = 0; k <= LUT_SIZE; k++) {
    const target = (k / LUT_SIZE) * sandArea;
    let j = 1;
    while (j < N && areaUp[j] < target) j++;
    const a0 = areaUp[j - 1];
    const a1 = areaUp[j];
    const t = a1 > a0 ? (target - a0) / (a1 - a0) : 0;
    const stepsUpFromNeck = j - 1 + t;
    topLevelLUT.push(yNeckTop - stepsUpFromNeck * dy);
  }

  // Cumulative area of the lower chamber measured upward from the bottom.
  const areaBot: number[] = [0];
  for (let k = 1; k <= N; k++) {
    const i = N - k;
    areaBot.push(areaBot[k - 1] + (botHW[i] + botHW[i + 1]) * dy);
  }
  const botLevelLUT: number[] = [];
  for (let k = 0; k <= LUT_SIZE; k++) {
    const target = (k / LUT_SIZE) * sandArea;
    let j = 1;
    while (j < N && areaBot[j] < target) j++;
    const a0 = areaBot[j - 1];
    const a1 = areaBot[j];
    const t = a1 > a0 ? (target - a0) / (a1 - a0) : 0;
    const stepsUpFromBottom = j - 1 + t;
    botLevelLUT.push(yBotIn - stepsUpFromBottom * dy);
  }

  const topY = (i: number) => yTopIn + (i / N) * chamberH;
  const botY = (i: number) => yNeckBot + (i / N) * chamberH;

  const topClip = Skia.Path.Make();
  topClip.moveTo(cx - topHW[0], topY(0));
  for (let i = 1; i <= N; i++) topClip.lineTo(cx - topHW[i], topY(i));
  for (let i = N; i >= 0; i--) topClip.lineTo(cx + topHW[i], topY(i));
  topClip.close();

  const botClip = Skia.Path.Make();
  botClip.moveTo(cx - botHW[0], botY(0));
  for (let i = 1; i <= N; i++) botClip.lineTo(cx - botHW[i], botY(i));
  for (let i = N; i >= 0; i--) botClip.lineTo(cx + botHW[i], botY(i));
  botClip.close();

  const glassPath = Skia.Path.Make();
  glassPath.moveTo(cx - topHW[0], topY(0));
  for (let i = 1; i <= N; i++) glassPath.lineTo(cx - topHW[i], topY(i));
  glassPath.lineTo(cx - neckR, yNeckBot); // left side of the neck
  for (let i = 1; i <= N; i++) glassPath.lineTo(cx - botHW[i], botY(i));
  for (let i = N; i >= 0; i--) glassPath.lineTo(cx + botHW[i], botY(i));
  glassPath.lineTo(cx + neckR, yNeckTop); // right side of the neck
  for (let i = N; i >= 0; i--) glassPath.lineTo(cx + topHW[i], topY(i));
  glassPath.close();

  return {
    canvasW,
    canvasH,
    cx,
    R,
    neckR,
    yTopIn,
    yNeckTop,
    yNeckBot,
    yBotIn,
    capH,
    N,
    topHW,
    botHW,
    topLevelLUT,
    botLevelLUT,
    glassPath,
    topClip,
    botClip,
  };
}

/** Linear interpolation into a level LUT. Safe to call from worklets. */
export function levelAt(lut: number[], fraction: number): number {
  'worklet';
  const n = lut.length - 1;
  const x = Math.min(Math.max(fraction, 0), 1) * n;
  const i = Math.floor(x);
  if (i >= n) return lut[n];
  const t = x - i;
  return lut[i] * (1 - t) + lut[i + 1] * t;
}
