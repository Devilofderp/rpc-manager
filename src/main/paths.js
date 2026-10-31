// Where the app's files are, and how Windows knows the app.
import { app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Installed, the app's files are packed into app.asar. Windows reads the icon files itself
// (taskbar, shortcuts), so those are kept unpacked beside it, and the browser loads the
// extension from its own folder next to the app.
export const assetsDir = path.join(srcDir, "assets").replace(/app\.asar(?=[\\/])/, "app.asar.unpacked");
export const extensionDir = app.isPackaged ? path.join(process.resourcesPath, "extension") : path.join(srcDir, "..", "extension");

// Windows groups taskbar buttons and finds the shortcuts' icon by this ID (the installer's
// appId in package.json and tools/install-shortcut.mjs use the same one).
export const APP_ID = "RPCManager.Desktop";
export const APP_DETAILS = {
    appId: APP_ID,
    relaunchCommand: app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${path.join(srcDir, "..")}"`,
    relaunchDisplayName: "RPC Manager"
};

// A test copy (own bridge port) stays out of the tray so it isn't mistaken for the real app.
export const isTestCopy = Boolean(process.env.RPC_MANAGER_BRIDGE_PORT);
