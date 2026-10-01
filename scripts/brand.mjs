// Builds every brand asset from the one source logo: run `just brand` after replacing assets/brand/git-card-logo.png.
//
//   public/brand/logo.png, logo-480.{png,webp}   the lockup, transparent, for the README, header and footer
//   public/brand/mark.png                        the mark alone, square
//   public/favicon.ico, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png
//   src/brand/logo-data.ts                       small embedded copies for cards and OG images, which cannot
//                                                load files (README images and the PNG renderer block them)

import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'assets/brand/git-card-logo.png';
// The mark sits left of the divider, inside the frame, in the source image.
const MARK_BOX = { left: 290, top: 265, width: 460, height: 470 };

// ---- White background to transparency ------------------------------------------------------------
// Only near-white pixels are background, so the green middle of the gradient stays opaque. Edge pixels
// get partial alpha, with their color unblended from white so they do not halo on dark backgrounds.
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const RAMP = 60;
for (let i = 0; i < data.length; i += 4) {
  const a = Math.min(1, Math.max(0, (765 - (data[i] + data[i + 1] + data[i + 2])) / RAMP));
  if (a < 1 && a > 0) {
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * 255) / a)));
  }
  data[i + 3] = Math.round(a * data[i + 3]);
}
const clear = () => sharp(data, { raw: info });
const png = (img) => img.png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 });

mkdirSync('public/brand', { recursive: true });
mkdirSync('src/brand', { recursive: true });

// ---- Lockup ------------------------------------------------------------------------------------------
const lockup = await sharp(await clear().png().toBuffer())
  .trim({ threshold: 1 })
  .png()
  .toBuffer();
const { width: lw, height: lh } = await sharp(lockup).metadata();
await png(sharp(lockup)).toFile('public/brand/logo.png');
await png(sharp(lockup).resize({ width: 480 })).toFile('public/brand/logo-480.png');
await sharp(lockup).resize({ width: 480 }).webp({ quality: 90, alphaQuality: 100 }).toFile('public/brand/logo-480.webp');

// ---- Mark ---------------------------------------------------------------------------------------------
const markTrim = await sharp(await clear().extract(MARK_BOX).png().toBuffer())
  .trim({ threshold: 1 })
  .png()
  .toBuffer();
const mm = await sharp(markTrim).metadata();
const side = Math.max(mm.width, mm.height);
const mark = await sharp(markTrim)
  .extend({
    top: Math.floor((side - mm.height) / 2),
    bottom: Math.ceil((side - mm.height) / 2),
    left: Math.floor((side - mm.width) / 2),
    right: Math.ceil((side - mm.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();
await png(sharp(mark).resize(512)).toFile('public/brand/mark.png');

// ---- Favicons: the mark on the site's dark tile, readable on light and dark browser tabs ------------
async function tile(size, padRatio = 0.14, radius = 0.22) {
  const pad = Math.round(size * padRatio);
  const inner = await sharp(mark)
    .resize(size - pad * 2)
    .png()
    .toBuffer();
  const r = Math.round(size * radius);
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#0A0A0C"/></svg>`,
  );
  return sharp(bg)
    .composite([{ input: inner, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
const icons = { 16: await tile(16, 0.08, 0.2), 32: await tile(32, 0.1), 48: await tile(48), 192: await tile(192), 512: await tile(512) };
writeFileSync('public/favicon-32.png', icons[32]);
writeFileSync('public/apple-touch-icon.png', await tile(180, 0.14, 0)); // iOS rounds the corners itself
writeFileSync('public/icon-192.png', icons[192]);
writeFileSync('public/icon-512.png', icons[512]);

// favicon.ico: a directory of embedded PNGs.
const entries = [16, 32, 48].map((s) => [s, icons[s]]);
const head = Buffer.alloc(6 + 16 * entries.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(entries.length, 4);
let offset = head.length;
entries.forEach(([s, buf], i) => {
  const e = 6 + i * 16;
  head.writeUInt8(s, e);
  head.writeUInt8(s, e + 1);
  head.writeUInt16LE(1, e + 4);
  head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(buf.length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += buf.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([head, ...entries.map(([, b]) => b)]));

// ---- Embedded copies for SVG cards and OG images ---------------------------------------------------------
// Rendered at 2x the largest size they are drawn at, so they stay sharp on retina screens.
const dataUri = async (height) => `data:image/png;base64,${(await png(sharp(lockup).resize({ height })).toBuffer()).toString('base64')}`;
const small = await dataUri(40); // card footers draw it 20 px tall
const large = await dataUri(112); // OG images draw it 56 px tall
writeFileSync(
  'src/brand/logo-data.ts',
  `// Generated by scripts/brand.mjs from ${SRC}. Do not edit.\n` +
    `// Embedded because README images and the PNG renderer cannot load external files.\n\n` +
    `/** Width over height of the logo lockup. */\n` +
    `export const LOGO_RATIO = ${(lw / lh).toFixed(4)};\n\n` +
    `/** About ${Math.round(small.length / 1024)} KB. For card footers. */\n` +
    `export const LOGO_SMALL = '${small}';\n\n` +
    `/** About ${Math.round(large.length / 1024)} KB. For OG images. */\n` +
    `export const LOGO_LARGE = '${large}';\n`,
);

console.log(
  `lockup ${lw}x${lh}, mark ${mm.width}x${mm.height}, embedded ${Math.round(small.length / 1024)} KB + ${Math.round(large.length / 1024)} KB`,
);
