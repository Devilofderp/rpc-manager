// Draws the app icon (an atom on a black rounded square) in any accent color, as PNG or .ico.
// Used at run time so the icon follows the theme, and by tools/make-icon.mjs for the
// default red files. No dependencies: plain PNG encoding with zlib.
import zlib from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc32 = buf => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

function png(size, rgba) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 6, 0, 0, 0], 8);
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", zlib.deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

const mix = (a, b, t) => a + (b - a) * t;
const BLACK = [6, 6, 8];
const ORBITS = [0, Math.PI / 3, (2 * Math.PI) / 3];

const rgb = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
};

// Orbits: ellipses (semi-axes A, B) through the center, rotated 0, 60 and 120 degrees.
const A = 0.37;
const B = 0.135;
const ROT = ORBITS.map(angle => [Math.cos(angle), Math.sin(angle)]);
// One electron riding each orbit, at a different point on each.
const ELECTRONS = ROT.map(([cos, sin], i) => {
    const t = [2.6, 0.1, 4.4][i];
    const u = A * Math.cos(t);
    const v = B * Math.sin(t);
    return [0.5 + u * cos - v * sin, 0.5 + u * sin + v * cos];
});

// Distance from (dx, dy), relative to the center, to the nearest orbit.
function orbitDistance(dx, dy) {
    let best = Infinity;
    for (const [cos, sin] of ROT) {
        const u = dx * cos + dy * sin;
        const v = -dx * sin + dy * cos;
        const f = (u / A) ** 2 + (v / B) ** 2 - 1;
        const grad = Math.hypot((2 * u) / A ** 2, (2 * v) / B ** 2) || 1;
        const d = Math.abs(f / grad);
        if (d < best) best = d;
    }
    return best;
}

export function atomPng(size, accentHex = "#ff2a40") {
    const accent = rgb(accentHex);
    const electron = accent.map(c => mix(c, 255, 0.62));
    // Lines stay at least ~1.4px wide so the tray-sized icon still reads.
    const width = Math.max(0.026, 1.4 / size);
    const electronRadius = Math.max(0.045, 1.6 / size);
    // Big sizes need fewer samples per pixel for smooth edges.
    const ss = size >= 128 ? 2 : 4;
    const corner = 0.23;
    const rgba = Buffer.alloc(size * size * 4);

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let r = 0, g = 0, b = 0, hits = 0;
            for (let sy = 0; sy < ss; sy++) {
                for (let sx = 0; sx < ss; sx++) {
                    const x = (px + (sx + 0.5) / ss) / size;
                    const y = (py + (sy + 0.5) / ss) / size;
                    // Outside the rounded square: transparent.
                    const qx = Math.max(Math.abs(x - 0.5) - (0.5 - corner), 0);
                    const qy = Math.max(Math.abs(y - 0.5) - (0.5 - corner), 0);
                    if (qx * qx + qy * qy > corner * corner) continue;
                    hits++;

                    let color;
                    const nucleus = Math.hypot(x - 0.5, y - 0.5);
                    const orbit = orbitDistance(x - 0.5, y - 0.5);
                    if (ELECTRONS.some(([ex, ey]) => Math.hypot(x - ex, y - ey) < electronRadius)) color = electron;
                    else if (orbit < width || nucleus < 0.072) color = accent;
                    if (color) {
                        r += color[0]; g += color[1]; b += color[2];
                        continue;
                    }
                    // A soft glow around the lines and the center, over near-black.
                    const glow = Math.max(Math.exp(-((orbit / 0.05) ** 2)) * 0.32, Math.exp(-((nucleus / 0.2) ** 2)) * 0.28);
                    r += mix(BLACK[0], accent[0], glow);
                    g += mix(BLACK[1], accent[1], glow);
                    b += mix(BLACK[2], accent[2], glow);
                }
            }
            if (hits) rgba.set([r / hits, g / hits, b / hits, (hits / (ss * ss)) * 255], (py * size + px) * 4);
        }
    }
    return png(size, rgba);
}

// Windows .ico holding PNG images at the sizes Explorer and the taskbar ask for.
export function atomIco(accentHex, sizes = [16, 24, 32, 48, 64, 128, 256]) {
    const images = sizes.map(size => atomPng(size, accentHex));
    const header = Buffer.alloc(6 + 16 * sizes.length);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    sizes.forEach((size, i) => {
        const entry = 6 + 16 * i;
        header.writeUInt8(size >= 256 ? 0 : size, entry);
        header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(images[i].length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += images[i].length;
    });
    return Buffer.concat([header, ...images]);
}
