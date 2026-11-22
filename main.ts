// news-image-20261122 — "THE WORLD IN ONE DAY — SUNDAY 22 NOVEMBER 2026"
// A newspaper front page drawn entirely from code: a 5x7 bitmap font, a
// hand-rolled PNG encoder, and simple vector pictograms. Node 22 stdlib
// only, no network. Deterministic: every run writes the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---------- palette ----------
const PAPER: RGB = [250, 247, 238];
const INK: RGB = [22, 22, 22];
const RED: RGB = [176, 32, 32];
const BLUE: RGB = [28, 78, 138];
const TEAL: RGB = [0, 104, 96];
const GOLD: RGB = [176, 126, 18];
const GREY: RGB = [108, 108, 104];
const LIGHT: RGB = [232, 226, 212];
const WHITE: RGB = [255, 255, 255];

// ---------- CRC32 + PNG encoder (written from scratch) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w: number, h: number, px: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(px.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- framebuffer ----------
const px = new Uint8Array(W * H * 3);

function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function hline(x: number, y: number, w: number, c: RGB): void {
  fillRect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: RGB): void {
  fillRect(x, y, 1, h, c);
}

// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function circle(cx: number, cy: number, r: number, c: RGB): void {
  const steps = Math.max(24, r * 6);
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    setPixel(Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), c);
  }
}

function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  const steps = Math.max(24, rx * 6);
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    setPixel(Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a)), c);
  }
}

// ---------- 5x7 bitmap font (each glyph: 7 rows of 5 bits) ----------
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
};

const DIGITS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
};

const PUNCT: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
};

function glyphOf(ch: string): string[] {
  const up = ch.toUpperCase();
  if (FONT[up]) return FONT[up];
  if (DIGITS[ch]) return DIGITS[ch];
  if (PUNCT[ch]) return PUNCT[ch];
  return PUNCT[' '];
}

// One character, 5 wide + 1 gap, scaled by s.
function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = glyphOf(ch);
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === '1') fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}

function drawText(text: string, x: number, y: number, s: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    drawChar(ch, cx, y, s, c);
    cx += 6 * s;
  }
}

function textWidth(text: string, s: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * s - s;
}

function drawTextCentred(text: string, cx: number, y: number, s: number, c: RGB): void {
  drawText(text, cx - Math.floor(textWidth(text, s) / 2), y, s, c);
}

// Greedy word wrap to a pixel width; returns lines (never longer than maxW).
function wrapText(text: string, maxW: number, s: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const trial = cur === '' ? word : cur + ' ' + word;
    if (textWidth(trial, s) <= maxW) {
      cur = trial;
    } else {
      if (cur !== '') lines.push(cur);
      cur = word;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

function drawPara(text: string, x: number, y: number, maxW: number, s: number, c: RGB, leading: number): number {
  const lines = wrapText(text, maxW, s);
  let yy = y;
  for (const ln of lines) {
    drawText(ln, x, yy, s, c);
    yy += leading;
  }
  return yy;
}

// ---------- pictograms (simple shapes, drawn from code) ----------
function picGlobe(cx: number, cy: number, r: number): void {
  fillCircle(cx, cy, r, WHITE);
  circle(cx, cy, r, BLUE);
  circle(cx, cy, r - 2, BLUE);
  ellipse(cx, cy, Math.floor(r * 0.42), r, BLUE);
  ellipse(cx, cy, r, Math.floor(r * 0.42), BLUE);
  hline(cx - r, cy, 2 * r, BLUE);
  vline(cx, cy - r, 2 * r, BLUE);
  // orbit ring with a marker dot
  ellipse(cx, cy, r + 26, Math.floor(r * 0.34), GOLD);
  fillCircle(cx + r + 20, cy - 12, 5, RED);
}

function picMissile(x: number, y: number, s: number): void {
  // diagonal missile, nose top-right, flame bottom-left; drawn thick
  const dx = 1;
  const dy = -1;
  for (const off of [-4, -2, 0, 2, 4]) {
    line(x + 8 + off * dx, y + s - 8 + off * dy, x + s - 8 + off * dx, y + 8 + off * dy, INK);
  }
  // nose cone
  line(x + s - 8, y + 8, x + s - 2, y + 16, RED);
  line(x + s - 8, y + 8, x + s - 16, y + 2, RED);
  line(x + s - 6, y + 10, x + s - 2, y + 18, RED);
  // fins
  line(x + 8, y + s - 8, x + 22, y + s - 2, RED);
  line(x + 8, y + s - 8, x + 2, y + s - 22, RED);
  // flame
  fillRect(x, y + s - 8, 10, 6, GOLD);
  fillRect(x + 2, y + s - 12, 6, 6, RED);
  // impact burst at the nose
  line(x + s - 4, y + 2, x + s - 4, y - 8, GOLD);
  line(x + s - 2, y + 4, x + s + 8, y - 2, GOLD);
  line(x + s - 6, y + 6, x + s - 12, y - 2, GOLD);
}

function picShield(x: number, y: number, s: number): void {
  // interception dome with three incoming missiles above it
  const cx = x + Math.floor(s / 2);
  const cy = y + s - 14;
  const r = Math.floor(s * 0.36);
  for (const rr of [r, r - 2, r - 4]) {
    for (let a = 0; a <= 24; a++) {
      const t = (Math.PI * a) / 24;
      setPixel(Math.round(cx + rr * Math.cos(Math.PI + t)), Math.round(cy - rr * Math.sin(t)), TEAL);
    }
  }
  fillRect(cx - r, cy - 2, 2 * r, 4, TEAL);
  line(x + 6, y + 6, x + 22, y + 22, RED);
  line(x + 8, y + 4, x + 24, y + 20, RED);
  line(x + s - 6, y + 4, x + s - 22, y + 20, RED);
  line(x + s - 8, y + 2, x + s - 24, y + 18, RED);
  line(cx, y + 2, cx, y + 18, RED);
  line(cx + 2, y + 2, cx + 2, y + 18, RED);
  fillCircle(x + 22, y + 22, 3, GOLD);
  fillCircle(x + s - 22, y + 20, 3, GOLD);
  fillCircle(cx, y + 18, 3, GOLD);
}

function picCoin(x: number, y: number, s: number): void {
  const cx = x + Math.floor(s / 2);
  const cy = y + Math.floor(s / 2) - 6;
  const r = Math.floor(s * 0.32);
  fillCircle(cx, cy, r, GOLD);
  circle(cx, cy, r, INK);
  drawTextCentred('$', cx, cy - 10, 3, INK);
  // falling trend line
  line(x + 4, y + s - 22, x + Math.floor(s / 2), y + s - 12, RED);
  line(x + Math.floor(s / 2), y + s - 12, x + s - 6, y + s - 4, RED);
  line(x + s - 6, y + s - 4, x + s - 14, y + s - 6, RED);
  line(x + s - 6, y + s - 4, x + s - 8, y + s - 12, RED);
}

function picChip(x: number, y: number, s: number): void {
  const m = 14;
  fillRect(x + m, y + m, s - 2 * m, s - 2 * m, WHITE);
  for (let i = 0; i < 4; i++) {
    const p = x + m + 8 + i * 14;
    vline(p, y + 4, 10, INK);
    vline(p, y + s - 14, 10, INK);
    hline(x + 4, y + m + 8 + i * 14, 10, INK);
    hline(x + s - 14, y + m + 8 + i * 14, 10, INK);
  }
  fillRect(x + m, y + m, s - 2 * m, 3, INK);
  fillRect(x + m, y + s - m - 3, s - 2 * m, 3, INK);
  fillRect(x + m, y + m, 3, s - 2 * m, INK);
  fillRect(x + s - m - 3, y + m, 3, s - 2 * m, INK);
  fillRect(x + m + 16, y + m + 16, s - 2 * m - 32, s - 2 * m - 32, BLUE);
  // falling arrow through the chip
  line(x + m + 6, y + m + 6, x + s - m - 6, y + s - m - 6, RED);
  line(x + s - m - 6, y + s - m - 6, x + s - m - 16, y + s - m - 6, RED);
  line(x + s - m - 6, y + s - m - 6, x + s - m - 6, y + s - m - 16, RED);
}

function picBall(cx: number, cy: number, rx: number, ry: number): void {
  fillCircle(cx, cy, 4, TEAL);
  ellipse(cx, cy, rx, ry, TEAL);
  ellipse(cx, cy, Math.floor(rx * 0.72), Math.floor(ry * 0.72), TEAL);
  line(cx - rx + 8, cy, cx + rx - 8, cy, TEAL);
  line(cx, cy - ry + 6, cx, cy + ry - 6, TEAL);
}

// ---------- page layout ----------
const M = 36; // margin
const CW = W - 2 * M; // 952 content width

function drawMasthead(): void {
  drawTextCentred('THE WORLD IN ONE DAY', 512, 26, 5, INK);
  fillRect(M, 74, CW, 4, RED);
  drawTextCentred('SUNDAY 22 NOVEMBER 2026', 512, 88, 2, INK);
  hline(M, 112, CW, INK);
}

function drawLead(): void {
  drawText('CLIMATE - COP31', M, 130, 2, RED);
  drawText('COP31 NEARS A FINAL DEAL', M, 154, 3, INK);
  drawText('AFTER ALL-NIGHT TALKS', M, 184, 3, INK);
  drawPara(
    "After all-night talks in Antalya, a final text was put to nearly 200 nations at dawn. A plenary is set to approve it at 0600 GMT, with fossil-fuel language back in the draft.",
    M, 224, 600, 2, INK, 22,
  );
  picGlobe(824, 245, 95);
  drawTextCentred('ANTALYA, TURKIYE', 824, 356, 2, GREY);
  hline(M, 402, CW, INK);
}

interface Story {
  kicker: string;
  kickerColor: RGB;
  headline: string;
  body: string;
  pic: (x: number, y: number, s: number) => void;
}

const STORIES: Story[] = [
  {
    kicker: 'UKRAINE',
    kickerColor: BLUE,
    headline: 'STRIKE ON KRYVYI RIH',
    body: "Russian triple-tap strike on Zelenskyy's home city kills 2, wounds 60.",
    pic: picMissile,
  },
  {
    kicker: 'MIDDLE EAST',
    kickerColor: TEAL,
    headline: 'MISSILES OVER RIYADH',
    body: 'Three Houthi ballistic missiles intercepted - the second attack on the capital in days.',
    pic: picShield,
  },
  {
    kicker: 'MARKETS',
    kickerColor: GOLD,
    headline: 'BITCOIN AT TWO-YEAR LOW',
    body: 'Sinks to about $55,250, its lowest since September 2024.',
    pic: picCoin,
  },
  {
    kicker: 'TECH',
    kickerColor: RED,
    headline: 'NVIDIA IN FREEFALL',
    body: 'Shares down 14% to a 52-week low after a Reuters report of an SEC accounting probe.',
    pic: picChip,
  },
];

function drawCell(s: Story, x: number, y: number): void {
  s.pic(x + 4, y + 12, 88);
  const tx = x + 108;
  drawText(s.kicker, tx, y + 10, 2, s.kickerColor);
  drawText(s.headline, tx, y + 32, 2, INK);
  drawPara(s.body, tx, y + 56, 348, 2, INK, 20);
}

function drawGrid(): void {
  const cellW = 464;
  const cellH = 154;
  const ys = [420, 590];
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawCell(STORIES[i], M + col * (cellW + 24), ys[row]);
  }
  void cellH;
  hline(M, 762, CW, INK);
}

function drawSport(): void {
  drawText('SPORT', M, 778, 2, RED);
  drawText('IRELAND STUN THE SPRINGBOKS IN DUBLIN', M, 802, 3, INK);
  drawText('Ireland beat the world champions in Dublin.', M, 834, 2, INK);
  picBall(880, 812, 58, 38);
  hline(M, 868, CW, INK);
}

function drawFooter(): void {
  drawText('ALSO TODAY', M, 884, 2, RED);
  drawPara(
    '24 DEAD IN NIGERIA BOAT CAPSIZE - F-16 CRASH IN GERMANY - BAYER\'S $7.25BN ROUNDUP SETTLEMENT - BELGIUM AIR SHUTDOWN - TRUMP VOWS 10% CREDIT-CARD CAP',
    M, 910, CW, 2, INK, 20,
  );
  fillRect(M, 992, CW, 2, GREY);
}

function drawPage(): void {
  fillAll(PAPER);
  drawMasthead();
  drawLead();
  drawGrid();
  drawSport();
  drawFooter();
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
  drawPage();
  const png = encodePNG(W, H, px);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
  console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes, ${W}x${H})`);
}

main();
