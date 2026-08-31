// Generates the app icon set (hourglass on dark ground) without any image
// dependencies — draws pixels directly and encodes PNG via zlib.
// Run once with: node scripts/gen-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- minimal PNG encoder ----------
const CRC_TABLE = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // no filter
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- hourglass geometry (same profile as the app) ----------
function hw(s, R, neckR) {
  const dome = 0.32;
  const capRatio = 0.55;
  if (s < dome) {
    const q = (dome - s) / dome;
    return R * Math.sqrt(1 - q * q * (1 - capRatio * capRatio));
  }
  const u = (s - dome) / (1 - dome);
  return neckR + (R - neckR) * Math.pow(Math.cos((u * Math.PI) / 2), 1.15);
}

function makeGeometry(S, scale) {
  const glassW = S * scale;
  const R = glassW / 2;
  const glassH = glassW * 1.55;
  const neckR = R * 0.075;
  const capH = glassW * 0.075;
  const neckGap = glassW * 0.045;
  const chamberH = (glassH - neckGap) / 2;
  const yTop = (S - glassH) / 2;
  return {
    R,
    neckR,
    capH,
    chamberH,
    yTop,
    yNeckTop: yTop + chamberH,
    yNeckBot: yTop + chamberH + neckGap,
    yBot: yTop + glassH,
    glassW,
  };
}

function inGlass(dx, y, grow, g) {
  const ady = Math.abs(dx);
  if (y >= g.yTop - grow && y <= g.yNeckTop) {
    const s = Math.min(1, Math.max(0, (y - g.yTop) / g.chamberH));
    return ady <= hw(s, g.R, g.neckR) + grow;
  }
  if (y > g.yNeckTop && y < g.yNeckBot) return ady <= g.neckR + grow;
  if (y >= g.yNeckBot && y <= g.yBot + grow) {
    const s = Math.min(1, Math.max(0, 1 - (y - g.yNeckBot) / g.chamberH));
    return ady <= hw(s, g.R, g.neckR) + grow;
  }
  return false;
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

const CLEAR = [0, 0, 0, 0];
const WHITE = [255, 255, 255, 255];

// Light-theme palette — warm paper ground, dark grey sand.
const PALETTE = {
  bg: [245, 242, 235, 255],
  sand: [58, 62, 70, 255],
  cap: [74, 68, 56, 255],
  outline: [40, 45, 55, 255],
  tint: [30, 35, 45, 255], // glass interior wash
};

function render(S, { scale, background, mono }) {
  const { bg: BG, sand: SAND, cap: CAP, outline: OUTLINE, tint: TINT } = PALETTE;
  const g = makeGeometry(S, scale);
  const stroke = Math.max(1.5, g.glassW * 0.012);
  const surfTopY = g.yTop + g.chamberH * 0.42;
  const fillBotY = g.yBot - g.chamberH * 0.45;
  const dipAmp = g.chamberH * 0.1;
  const moundAmp = g.chamberH * 0.2;
  const streamW = Math.max(1.2, g.glassW * 0.014);
  const capW = g.R * 1.09;

  const sample = (x, y) => {
    const dx = x - S / 2;
    const ady = Math.abs(dx);
    // caps
    if (
      ady <= capW &&
      ((y >= g.yTop - g.capH && y <= g.yTop + stroke) ||
        (y >= g.yBot - stroke && y <= g.yBot + g.capH))
    ) {
      return mono ? WHITE : CAP;
    }
    const inside = inGlass(dx, y, 0, g);
    if (mono) return inside || inGlass(dx, y, stroke, g) ? WHITE : CLEAR;
    if (inside) {
      // sand — upper chamber (concave surface)
      const topSurf = surfTopY + dipAmp * (1 - Math.min(1, ady / g.R) ** 2);
      if (y >= topSurf && y <= g.yNeckTop) return SAND;
      // sand — lower pile (mound)
      const botSurf = fillBotY - moundAmp * Math.max(0, 1 - (ady / (g.R * 0.85)) ** 2);
      if (y >= botSurf) return SAND;
      // stream
      if (ady <= streamW && y > g.yNeckTop) return SAND;
      // glass interior tint
      const under = background ? BG : CLEAR;
      return mix(under, TINT, 0.05);
    }
    // outline just outside the silhouette
    if (inGlass(dx, y, stroke, g)) {
      const under = background ? BG : CLEAR;
      return mix(under, OUTLINE, 0.55);
    }
    return background ? BG : CLEAR;
  };

  const rgba = Buffer.alloc(S * S * 4);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      // 2x2 supersampling
      let r = 0;
      let gg = 0;
      let b = 0;
      let a = 0;
      for (const oy of [0.25, 0.75]) {
        for (const ox of [0.25, 0.75]) {
          const c = sample(px + ox, py + oy);
          r += c[0];
          gg += c[1];
          b += c[2];
          a += c[3];
        }
      }
      const i = (py * S + px) * 4;
      rgba[i] = Math.round(r / 4);
      rgba[i + 1] = Math.round(gg / 4);
      rgba[i + 2] = Math.round(b / 4);
      rgba[i + 3] = Math.round(a / 4);
    }
  }
  return encodePng(S, S, rgba);
}

function solid(S, color) {
  const rgba = Buffer.alloc(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    rgba[i * 4] = color[0];
    rgba[i * 4 + 1] = color[1];
    rgba[i * 4 + 2] = color[2];
    rgba[i * 4 + 3] = color[3];
  }
  return encodePng(S, S, rgba);
}

const out = (name, buf) => {
  const p = path.join(__dirname, '..', 'assets', name);
  fs.writeFileSync(p, buf);
  console.log('wrote', p, buf.length, 'bytes');
};

out('icon.png', render(1024, { scale: 0.55, background: true, mono: false }));
out('splash-icon.png', render(1024, { scale: 0.45, background: false, mono: false }));
out('android-icon-foreground.png', render(1024, { scale: 0.38, background: false, mono: false }));
out('android-icon-background.png', solid(1024, PALETTE.bg));
out('android-icon-monochrome.png', render(1024, { scale: 0.38, background: false, mono: true }));
out('favicon.png', render(64, { scale: 0.7, background: true, mono: false }));
