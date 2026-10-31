// Writes the default (red) app icon files: PNGs, an .ico and the extension icon.
// Run with `npm run icon`. The app redraws the icon in your accent color at run
// time (src/main/icons.js); these are the defaults it starts from.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomIco, atomPng } from "../src/main/atom-icon.js";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "assets");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon.png"), atomPng(256));
// The .ico's name changes with the design: Windows caches taskbar icons by file.
fs.writeFileSync(path.join(outDir, "atom.ico"), atomIco("#ff2a40"));
fs.writeFileSync(path.join(outDir, "tray.png"), atomPng(32));
fs.writeFileSync(path.join(outDir, "..", "..", "extension", "icon.png"), atomPng(128));
console.log(`wrote icon.png, atom.ico and tray.png to ${outDir}, and the extension icon`);
