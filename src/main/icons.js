// Keeps the app icon in the accent color: tray, title bar, window, taskbar and the
// Start menu and desktop shortcuts. Each color's .ico is drawn once and kept in the
// data folder, under a name per color (Windows caches taskbar icons by file).
import { nativeImage, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { atomPng } from "./atom-icon.js";
import { DEFAULT_THEME } from "../shared/theme.js";

function drawIco(accent) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./icon-worker.js", import.meta.url), { workerData: { accent } });
        worker.once("message", data => resolve(Buffer.from(data)));
        worker.once("error", reject);
    });
}

export class Icons {
    constructor({ assetsDir, cacheDir, shortcuts, appDetails }) {
        this.assetsDir = assetsDir;
        this.cacheDir = cacheDir;
        this.shortcuts = shortcuts;
        this.appDetails = appDetails; // setAppDetails fields other than the icon
        this.accent = null;
    }

    // The small title-bar icon, as a data URL for the window.
    titleIcon(accent) {
        return `data:image/png;base64,${atomPng(64, accent).toString("base64")}`;
    }

    async apply(accent, { win, tray }) {
        this.accent = accent;
        const isDefault = accent === DEFAULT_THEME.accent;
        tray?.setImage(isDefault ? path.join(this.assetsDir, "tray.png") : nativeImage.createFromBuffer(atomPng(32, accent)));
        win?.webContents.send("icon:change", this.titleIcon(accent));

        let ico = path.join(this.assetsDir, "atom.ico");
        if (!isDefault) {
            ico = path.join(this.cacheDir, `atom-${accent.slice(1)}.ico`);
            if (!fs.existsSync(ico)) {
                const data = await drawIco(accent);
                fs.mkdirSync(this.cacheDir, { recursive: true });
                fs.writeFileSync(ico, data);
            }
        }
        // Another color was picked while this one was drawing.
        if (this.accent !== accent || !win || win.isDestroyed()) return;
        win.setIcon(ico);
        if (process.platform === "win32") {
            win.setAppDetails({ ...this.appDetails, appIconPath: ico, appIconIndex: 0 });
            // The taskbar takes its icon from the Start menu shortcut when the app opens, so a
            // new color reaches the taskbar on the next start (the tray and title bar change now).
            for (const shortcut of this.shortcuts) this.updateShortcut(shortcut, ico);
        }
    }

    // Only a shortcut that opens this app gets the new icon.
    updateShortcut(shortcut, ico) {
        if (!fs.existsSync(shortcut)) return;
        try {
            const link = shell.readShortcutLink(shortcut);
            if (link.target !== process.execPath || link.icon === ico) return;
            shell.writeShortcutLink(shortcut, "update", { icon: ico, iconIndex: 0 });
        } catch (err) {
            console.error("could not update the shortcut icon", err);
        }
    }
}
