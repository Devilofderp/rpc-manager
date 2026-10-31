// Startup: creates each piece of the app and hands them to each other.
import { app, nativeTheme } from "electron";
import path from "node:path";
import { Icons } from "./appearance/icons.js";
import { Bridge } from "./bridge.js";
import { ctx } from "./context.js";
import { Presence } from "./discord/presence.js";
import { registerIpc } from "./ipc.js";
import { APP_DETAILS, APP_ID, assetsDir, extensionDir, isTestCopy } from "./paths.js";
import { registerAppScheme, serveApp } from "./protocol.js";
import { maybeSnapshot } from "./snapshot.js";
import { Store } from "./store.js";
import { createTray } from "./tray.js";
import { Updates } from "./updates.js";
import { createWindow, currentTheme, showWindow } from "./window.js";

if (!app.requestSingleInstanceLock() || process.argv.includes("--quit")) app.exit(0);

registerAppScheme();

// Starting the app again shows the window; `--quit` asks the running copy to quit instead.
app.on("second-instance", (_event, argv) => {
    if (argv.includes("--quit")) return app.quit();
    if (ctx.win) showWindow();
});

app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    nativeTheme.themeSource = "dark";
    ctx.store = new Store(app.getPath("userData"));
    ctx.presence = new Presence();
    ctx.bridge = new Bridge(path.join(extensionDir, "manifest.json"));
    ctx.bridge.start();
    ctx.icons = new Icons({
        assetsDir,
        cacheDir: path.join(app.getPath("userData"), "icons"),
        // A test copy must never repaint the real shortcuts.
        shortcuts: isTestCopy ? [] : [
            path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "RPC Manager.lnk"),
            path.join(app.getPath("desktop"), "RPC Manager.lnk")
        ],
        appDetails: APP_DETAILS
    });
    ctx.updates = new Updates();
    serveApp();
    registerIpc();
    createWindow();
    if (!isTestCopy) createTray();
    ctx.icons.apply(currentTheme().accent, ctx).catch(err => console.error("icon update failed", err));
    maybeSnapshot();
    ctx.presence.start(ctx.store.presets);
    if (app.isPackaged) ctx.updates.start();
});

app.on("before-quit", () => {
    ctx.quitting = true;
    ctx.presence?.stop();
    ctx.bridge?.stop();
    ctx.store?.flush();
});
