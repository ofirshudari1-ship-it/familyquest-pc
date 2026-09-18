// Generates the installer branding assets (build/icon.ico, installerSidebar.bmp,
// installerHeader.bmp) purely with Node — no external design tools, so the assets
// are reproducible and reviewable as code. Run: node scripts/gen-assets.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'build');
fs.mkdirSync(OUT, { recursive: true });

// ---------- Brand palette ----------
const PURPLE_DARK = [43, 45, 99]; // #2b2d63
const PURPLE = [72, 52, 163]; // #4834a3
const PURPLE_LIGHT = [92, 72, 201]; // #5c48c9
const GOLD = [255, 209, 102]; // #ffd166
const GOLD_LIGHT = [255, 224, 138]; // #ffe08a
const GOLD_DARK = [199, 143, 15];
const WHITE = [255, 255, 255];

// ---------- Framebuffer ----------
class Canvas {
  constructor(w, h, bg = [0, 0, 0, 0]) {
    this.w = w;
    this.h = h;
    this.px = new Float64Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 4] = bg[0];
      this.px[i * 4 + 1] = bg[1];
      this.px[i * 4 + 2] = bg[2];
      this.px[i * 4 + 3] = bg[3] === undefined ? 255 : bg[3];
    }
  }
  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  blend(x, y, rgb, alpha) {
    if (!this.inBounds(x, y) || alpha <= 0) return;
    x = Math.floor(x);
    y = Math.floor(y);
    const i = (y * this.w + x) * 4;
    const a = Math.min(1, alpha);
    this.px[i] = this.px[i] * (1 - a) + rgb[0] * a;
    this.px[i + 1] = this.px[i + 1] * (1 - a) + rgb[1] * a;
    this.px[i + 2] = this.px[i + 2] * (1 - a) + rgb[2] * a;
    this.px[i + 3] = Math.max(this.px[i + 3], 255 * a);
  }
  fillRect(x0, y0, x1, y1, rgb, alpha = 1) {
    for (let y = Math.max(0, y0); y < Math.min(this.h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) this.blend(x, y, rgb, alpha);
    }
  }
  // Vertical gradient across the whole canvas.
  gradientV(top, bottom) {
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1);
      const rgb = [top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t];
      for (let x = 0; x < this.w; x++) this.blend(x, y, rgb, 1);
    }
  }
  // Diagonal gradient (top-left to bottom-right).
  gradientDiag(a, b) {
    const maxD = this.w + this.h;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = (x + y) / maxD;
        const rgb = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        this.blend(x, y, rgb, 1);
      }
    }
  }
  fillRoundedRect(x0, y0, x1, y1, radius, rgb, alpha = 1) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = x < x0 + radius ? x0 + radius - x : x > x1 - radius ? x - (x1 - radius) : 0;
        const dy = y < y0 + radius ? y0 + radius - y : y > y1 - radius ? y - (y1 - radius) : 0;
        if (dx > 0 && dy > 0 && Math.sqrt(dx * dx + dy * dy) > radius) continue;
        this.blend(x, y, rgb, alpha);
      }
    }
  }
  fillCircle(cx, cy, r, rgb, alpha = 1, feather = 1.2) {
    const y0 = Math.floor(cy - r - feather);
    const y1 = Math.ceil(cy + r + feather);
    const x0 = Math.floor(cx - r - feather);
    const x1 = Math.ceil(cx + r + feather);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r + feather) continue;
        const a = d <= r - feather ? 1 : 1 - (d - (r - feather)) / (feather * 2);
        this.blend(x, y, rgb, alpha * Math.max(0, Math.min(1, a)));
      }
    }
  }
  // 5-point star centered at (cx, cy) with outer radius rOuter.
  fillStar(cx, cy, rOuter, rInner, rgb, alpha = 1, rotationDeg = -90) {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const angle = ((rotationDeg + i * 36) * Math.PI) / 180;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    this.fillPolygon(points, rgb, alpha);
  }
  fillPolygon(points, rgb, alpha = 1) {
    const ys = points.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x1p, y1p] = points[i];
        const [x2p, y2p] = points[(i + 1) % points.length];
        if ((y1p <= y && y2p > y) || (y2p <= y && y1p > y)) {
          const t = (y - y1p) / (y2p - y1p);
          xs.push(x1p + t * (x2p - x1p));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i < xs.length; i += 2) {
        if (xs[i + 1] === undefined) break;
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.blend(x, y, rgb, alpha);
      }
    }
  }
  // Simple deterministic dot confetti for the sidebar banner.
  scatterDots(seed, count, rgb, minR, maxR, alpha) {
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < count; i++) {
      const x = rand() * this.w;
      const y = rand() * this.h;
      const r = minR + rand() * (maxR - minR);
      this.fillCircle(x, y, r, rgb, alpha * (0.4 + rand() * 0.6));
    }
  }
  resized(newW, newH) {
    const out = new Canvas(newW, newH, [0, 0, 0, 0]);
    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        // box-average downsample
        const sx0 = Math.floor((x / newW) * this.w);
        const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) / newW) * this.w));
        const sy0 = Math.floor((y / newH) * this.h);
        const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) / newH) * this.h));
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          for (let sx = sx0; sx < sx1; sx++) {
            const i = (sy * this.w + sx) * 4;
            r += this.px[i]; g += this.px[i + 1]; b += this.px[i + 2]; a += this.px[i + 3];
            n++;
          }
        }
        const i = (y * newW + x) * 4;
        out.px[i] = r / n; out.px[i + 1] = g / n; out.px[i + 2] = b / n; out.px[i + 3] = a / n;
      }
    }
    return out;
  }
  toRGBA() {
    const buf = Buffer.alloc(this.w * this.h * 4);
    for (let i = 0; i < this.w * this.h * 4; i++) buf[i] = Math.max(0, Math.min(255, Math.round(this.px[i])));
    return buf;
  }
}

// ---------- PNG encoder (for the 256px ICO entry) ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}
function encodePNG(canvas) {
  const { w, h } = canvas;
  const rgba = canvas.toRGBA();
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- BMP encoder (24-bit, bottom-up — standard Windows BMP) ----------
function encodeBMP24(canvas) {
  const { w, h } = canvas;
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const pixelDataSize = rowSize * h;
  const fileSize = 54 + pixelDataSize;
  const buf = Buffer.alloc(fileSize);
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // pixel data offset
  buf.writeUInt32LE(40, 14); // DIB header size
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // bpp
  buf.writeUInt32LE(0, 30); // no compression
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38); // ~72 DPI
  buf.writeInt32LE(2835, 42);

  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y; // bottom-up
    for (let x = 0; x < w; x++) {
      const si = (srcY * w + x) * 4;
      const di = 54 + y * rowSize + x * 3;
      buf[di] = Math.round(canvas.px[si + 2]); // B
      buf[di + 1] = Math.round(canvas.px[si + 1]); // G
      buf[di + 2] = Math.round(canvas.px[si]); // R
    }
  }
  return buf;
}

// ---------- ICO encoder (256px as PNG, smaller sizes as raw 32bpp DIB) ----------
function encodeICODib32(canvas) {
  // BITMAPINFOHEADER + XOR (32bpp BGRA, bottom-up) + AND mask (1bpp, all zero = fully opaque via alpha)
  const { w, h } = canvas;
  const headerSize = 40;
  const xorSize = w * h * 4;
  const andRowSize = Math.ceil(w / 32) * 4;
  const andSize = andRowSize * h;
  const buf = Buffer.alloc(headerSize + xorSize + andSize);
  buf.writeUInt32LE(headerSize, 0);
  buf.writeInt32LE(w, 4);
  buf.writeInt32LE(h * 2, 8); // height counts XOR+AND
  buf.writeUInt16LE(1, 12);
  buf.writeUInt16LE(32, 14);
  buf.writeUInt32LE(0, 16);
  buf.writeUInt32LE(xorSize, 20);

  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y;
    for (let x = 0; x < w; x++) {
      const si = (srcY * w + x) * 4;
      const di = headerSize + (y * w + x) * 4;
      buf[di] = Math.round(canvas.px[si + 2]); // B
      buf[di + 1] = Math.round(canvas.px[si + 1]); // G
      buf[di + 2] = Math.round(canvas.px[si]); // R
      buf[di + 3] = Math.round(canvas.px[si + 3]); // A
    }
  }
  // AND mask left zeroed (fully opaque everywhere) — 32bpp alpha already handles transparency.
  return buf;
}

function encodeICO(entries) {
  // entries: [{ size, data, isPng }]
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const dataBlocks = [];
  let offset = 6 + count * 16;
  for (const e of entries) {
    const dir = Buffer.alloc(16);
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, 0); // 0 means 256
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(e.data.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirEntries.push(dir);
    dataBlocks.push(e.data);
    offset += e.data.length;
  }
  return Buffer.concat([header, ...dirEntries, ...dataBlocks]);
}

// ---------- Build the badge mark (shared by icon + banners) ----------
function drawBadge(canvas, cx, cy, size, opts = {}) {
  const r = size / 2;
  // soft glow
  canvas.fillCircle(cx, cy, r * 1.08, PURPLE_DARK, 0.35, r * 0.25);
  // rounded gradient square behind the coin, gives it an "app icon" feel
  if (opts.withPlate) {
    canvas.fillRoundedRect(cx - r * 1.15, cy - r * 1.15, cx + r * 1.15, cy + r * 1.15, r * 0.42, PURPLE, 1);
    canvas.fillRoundedRect(cx - r * 1.15, cy - r * 1.15, cx + r * 1.15, cy - r * 0.1, r * 0.42, PURPLE_LIGHT, 0.35);
  }
  // coin body
  canvas.fillCircle(cx, cy, r, GOLD_DARK, 1);
  canvas.fillCircle(cx, cy, r * 0.93, GOLD, 1);
  canvas.fillCircle(cx, cy, r * 0.78, GOLD_LIGHT, 0.5);
  // star mark
  canvas.fillStar(cx, cy, r * 0.52, r * 0.22, WHITE, 0.95);
  // glossy highlight
  canvas.fillCircle(cx - r * 0.32, cy - r * 0.38, r * 0.32, WHITE, 0.25, r * 0.3);
}

// ---------- 1) App icon (icon.ico) ----------
function buildIcon() {
  const master = new Canvas(256, 256, [0, 0, 0, 0]);
  master.fillRoundedRect(0, 0, 256, 256, 56, PURPLE, 1);
  // diagonal sheen
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const t = (x + y) / 512;
      const rgb = [PURPLE_DARK[0] + (PURPLE_LIGHT[0] - PURPLE_DARK[0]) * t, PURPLE_DARK[1] + (PURPLE_LIGHT[1] - PURPLE_DARK[1]) * t, PURPLE_DARK[2] + (PURPLE_LIGHT[2] - PURPLE_DARK[2]) * t];
      const dx = x < 56 ? 56 - x : x > 200 ? x - 200 : 0;
      const dy = y < 56 ? 56 - y : y > 200 ? y - 200 : 0;
      if (dx > 0 && dy > 0 && Math.sqrt(dx * dx + dy * dy) > 56) continue;
      master.blend(x, y, rgb, 1);
    }
  }
  drawBadge(master, 128, 138, 148, { withPlate: false });

  const png256 = encodePNG(master);
  const sizes = [16, 24, 32, 48];
  const entries = [{ size: 256, data: png256 }];
  for (const s of sizes) {
    const small = master.resized(s, s);
    entries.push({ size: s, data: encodeICODib32(small) });
  }
  entries.sort((a, b) => a.size - b.size);
  fs.writeFileSync(path.join(OUT, 'icon.ico'), encodeICO(entries));
  console.log('wrote build/icon.ico');
}

// ---------- 2) Installer sidebar (welcome/finish page), 164x314 ----------
function buildSidebar() {
  const c = new Canvas(164, 314, [0, 0, 0, 255]);
  c.gradientV(PURPLE_LIGHT, PURPLE_DARK);
  c.scatterDots(7, 26, GOLD, 2, 5, 0.5);
  c.scatterDots(42, 10, WHITE, 1.5, 3, 0.3);
  drawBadge(c, 82, 108, 108, { withPlate: false });
  // small decorative stars trailing down, echoing the coin mark
  c.fillStar(40, 220, 9, 4, GOLD, 0.85);
  c.fillStar(122, 250, 6, 2.6, WHITE, 0.6);
  c.fillStar(70, 275, 5, 2.2, GOLD, 0.55);
  fs.writeFileSync(path.join(OUT, 'installerSidebar.bmp'), encodeBMP24(c));
  console.log('wrote build/installerSidebar.bmp');
}

// ---------- 3) Installer header (interior pages), 150x57 ----------
function buildHeader() {
  const c = new Canvas(150, 57, WHITE);
  // subtle brand-tinted panel on the right (installer text sits to the left of it)
  c.fillRect(0, 0, 150, 57, [248, 247, 253], 1);
  drawBadge(c, 27, 28, 40, { withPlate: false });
  c.fillRect(0, 55, 150, 57, GOLD, 1);
  fs.writeFileSync(path.join(OUT, 'installerHeader.bmp'), encodeBMP24(c));
  console.log('wrote build/installerHeader.bmp');
}

buildIcon();
buildSidebar();
buildHeader();
