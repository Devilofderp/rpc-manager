// Everything the window asks of the app, and everything the app tells the window.
import { ipcMain, Notification, shell } from "electron";
import path from "node:path";
import { ctx } from "./context.js";
import { appInfo } from "./discord/app-info.js";
import { assetsDir, extensionDir } from "./paths.js";
import { refreshTrayMenu } from "./tray.js";
import { applyWindowTheme, currentTheme, glassSupported, openLink } from "./window.js";
import { normalizeTheme } from "../shared/theme.js";

// A new version is downloaded: the title bar and tray offer the restart, and a
// notification says so if the window is tucked away.
function announceUpdate(version) {
    const { win } = ctx;
    refreshTrayMenu();
    win.webContents.send("update:ready", version);
    if (!win.isVisible() && Notification.isSupported()) {
        new Notification({
            title: "RPC Manager update ready",
            body: "Open RPC Manager and click Restart to update.",
            icon: path.join(assetsDir, "icon.png")
        }).show();
    }
}

export function registerIpc() {
    const { store, presence, bridge, icons, updates } = ctx;

    ipcMain.handle("state:get", () => ({
        presets: store.presets,
        presence: presence.snapshot(),
        bridge: bridge.snapshot(),
        extensionDir,
        theme: currentTheme(),
        titleIcon: icons.titleIcon(currentTheme().accent),
        glassSupported,
        minimizeToTray: Boolean(store.prefs.minimizeToTray),
        updateReady: updates.ready
    }));
    ipcMain.on("theme:set", (_event, theme) => {
        const before = currentTheme().accent;
        store.setPrefs({ theme: normalizeTheme(theme) });
        applyWindowTheme(currentTheme());
        if (currentTheme().accent !== before) icons.apply(currentTheme().accent, ctx).catch(err => console.error("icon update failed", err));
    });
    ipcMain.on("minimize-to-tray:set", (_event, on) => store.setPrefs({ minimizeToTray: Boolean(on) }));
    ipcMain.on("extension:open", () => shell.openPath(extensionDir));
    ipcMain.on("update:install", () => updates.install());
    ipcMain.on("presets:set", (_event, presets) => {
        store.set(presets);
        presence.update(presets);
    });
    ipcMain.handle("app:info", (_event, appId) => appInfo(String(appId)));
    ipcMain.on("link:open", (_event, url) => openLink(String(url)));

    bridge.on("change", snapshot => {
        presence.setSiteActivities(snapshot.activities);
        ctx.win?.webContents.send("bridge:change", snapshot);
    });
    presence.on("change", snapshot => ctx.win?.webContents.send("presence:change", snapshot));
    updates.on("ready", announceUpdate);
}
