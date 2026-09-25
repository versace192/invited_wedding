const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const width = 1600;
const height = 1000;
const outputDir = path.join(__dirname, '..', 'assets');
const outputPath = path.join(outputDir, 'hero-bg.png');

const colors = {
  cream: [248, 238, 232],
  paper: [255, 253, 249],
  mist: [237, 244, 240],
  blush: [233, 186, 184],
  sage: [167, 189, 169],
  blue: [170, 196, 208],
  lavender: [201, 191, 215],
  clay: [197, 154, 127],
};

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function blend(base, overlay, alpha) {
  return [
    base[0] * (1 - alpha) + overlay[0] * alpha,
    base[1] * (1 - alpha) + overlay[1] * alpha,
    base[2] * (1 - alpha) + overlay[2] * alpha,
  ];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function addBand(color, current, x, y, center, amplitude, widthValue, alpha) {
  const wave = center + Math.sin(x * 0.006 + center * 0.01) * amplitude;
  const distance = y - wave;
  const strength = Math.exp(-(distance * distance) / (2 * widthValue * widthValue)) * alpha;
  return blend(current, color, strength);
}

function blendPixel(buffer, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) {
    return;
  }

  const index = (y * width + x) * 4;
  buffer[index] = clampByte(buffer[index] * (1 - alpha) + color[0] * alpha);
  buffer[index + 1] = clampByte(buffer[index + 1] * (1 - alpha) + color[1] * alpha);
  buffer[index + 2] = clampByte(buffer[index + 2] * (1 - alpha) + color[2] * alpha);
}

function drawPetal(buffer, cx, cy, size, rotation, color, alpha) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const radiusX = size * 0.46;
  const radiusY = size;
  const bounds = Math.ceil(size * 1.2);

  for (let y = Math.floor(cy - bounds); y <= Math.ceil(cy + bounds); y += 1) {
    for (let x = Math.floor(cx - bounds); x <= Math.ceil(cx + bounds); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const rx = dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;
      const taper = 0.54 + 0.46 * (1 - Math.min(1, Math.abs(ry) / radiusY));
      const shape = (rx * rx) / (radiusX * radiusX * taper) + (ry * ry) / (radiusY * radiusY);

      if (shape <= 1) {
        const edge = Math.max(0, 1 - shape);
        blendPixel(buffer, x, y, color, alpha * Math.min(1, edge * 2.4));
      }
    }
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];

    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const pixels = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const nx = x / (width - 1);
    const ny = y / (height - 1);
    const baseA = mix(colors.cream, colors.paper, nx * 0.8);
    const baseB = mix(colors.mist, colors.lavender, nx * 0.54);
    let color = mix(baseA, baseB, ny * 0.9);

    color = addBand(colors.blush, color, x, y, height * 0.2, 54, 78, 0.18);
    color = addBand(colors.blue, color, x, y, height * 0.48, 74, 96, 0.14);
    color = addBand(colors.sage, color, x, y, height * 0.75, 48, 90, 0.13);

    const grain = (rand(x * 0.7 + y * 1.9) - 0.5) * 4;
    const index = (y * width + x) * 4;
    pixels[index] = clampByte(color[0] + grain);
    pixels[index + 1] = clampByte(color[1] + grain);
    pixels[index + 2] = clampByte(color[2] + grain);
    pixels[index + 3] = 255;
  }
}

const petalColors = [colors.blush, colors.sage, colors.blue, colors.lavender, colors.clay];

for (let i = 0; i < 150; i += 1) {
  const x = rand(i + 1) * width;
  const y = rand(i + 41) * height;
  const size = 8 + rand(i + 99) * 28;
  const rotation = rand(i + 222) * Math.PI * 2;
  const color = petalColors[i % petalColors.length];
  const alpha = 0.08 + rand(i + 404) * 0.13;
  drawPetal(pixels, x, y, size, rotation, color, alpha);
}

const scanlineLength = width * 4 + 1;
const raw = Buffer.alloc(scanlineLength * height);

for (let y = 0; y < height; y += 1) {
  const rawOffset = y * scanlineLength;
  const pixelOffset = y * width * 4;
  raw[rawOffset] = 0;
  pixels.copy(raw, rawOffset + 1, pixelOffset, pixelOffset + width * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, png);
console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
