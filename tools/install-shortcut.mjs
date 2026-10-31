// Adds "RPC Manager" to the Start menu, opening the app straight from this folder
// (no terminal window). Run with `npm run shortcut`; running it again updates it.
import { app, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const link = path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "RPC Manager.lnk");

// This script never opens a window; keep Electron's profile files out of AppData.
app.disableHardwareAcceleration();
app.setPath("userData", path.join(os.tmpdir(), "rpc-manager-shortcut"));

app.whenReady().then(() => {
    const ok = shell.writeShortcutLink(link, fs.existsSync(link) ? "replace" : "create", {
        target: process.execPath,
        args: `"${root}"`,
        cwd: root,
        icon: path.join(root, "src", "assets", "atom.ico"),
        iconIndex: 0,
        // Same ID the app sets, so the taskbar treats the shortcut and the window as one app.
        appUserModelId: "RPCManager.Desktop",
        description: "Discord Rich Presence presets"
    });
    console.log(ok ? `Start menu shortcut written: ${link}` : "Could not write the shortcut.");
    app.exit(ok ? 0 : 1);
});
