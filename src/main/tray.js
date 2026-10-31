// The tray icon and its menu.
import { app, Menu, Tray } from "electron";
import path from "node:path";
import { ctx } from "./context.js";
import { assetsDir } from "./paths.js";
import { showWindow } from "./window.js";

function trayMenu() {
    return Menu.buildFromTemplate([
        { label: "Open RPC Manager", click: showWindow },
        ...(ctx.updates.ready ? [{ label: "Restart to update", click: () => ctx.updates.install() }] : []),
        { type: "separator" },
        { label: "Quit and clear presence", click: () => app.quit() }
    ]);
}

export function refreshTrayMenu() {
    ctx.tray?.setContextMenu(trayMenu());
}

export function createTray() {
    const tray = new Tray(path.join(assetsDir, "tray.png"));
    ctx.tray = tray;
    tray.setToolTip("RPC Manager");
    tray.setContextMenu(trayMenu());
    tray.on("click", showWindow);
}
