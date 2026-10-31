// The app window: its theme, and tucking it away into the tray.
import { BrowserWindow, Notification, shell } from "electron";
import path from "node:path";
import { setBlur } from "./appearance/blur.js";
import { ctx } from "./context.js";
import { APP_DETAILS, assetsDir, srcDir } from "./paths.js";
import { normalizeTheme, windowColorFor } from "../shared/theme.js";

// Glass uses Windows' blur-behind (blur.js), which Windows 10 and 11 both have.
export const glassSupported = process.platform === "win32";

export const currentTheme = () => {
    const theme = normalizeTheme(ctx.store.prefs.theme);
    // Glass needs Windows' blur-behind; elsewhere it falls back to dark gray.
    if (theme.background === "glass" && !glassSupported) theme.background = "dark";
    return theme;
};

// The title bar is 46px; Windows' own buttons on the right grow with the UI size.
const TITLE_BAR = 46;

// The window's own background (behind the page) and the UI size follow the theme.
export function applyWindowTheme(theme) {
    const { win } = ctx;
    win.setBackgroundColor(windowColorFor(theme));
    setBlur(win, theme.background === "glass");
    win.webContents.setZoomFactor(theme.scale);
    if (process.platform === "win32") win.setTitleBarOverlay({ height: Math.round(TITLE_BAR * theme.scale) });
}

export function openLink(url) {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

export function createWindow() {
    const theme = currentTheme();
    const win = new BrowserWindow({
        width: 1220,
        height: 780,
        minWidth: 980,
        minHeight: 620,
        show: false,
        title: "RPC Manager",
        icon: path.join(assetsDir, process.platform === "win32" ? "atom.ico" : "icon.png"),
        backgroundColor: windowColorFor(theme),
        titleBarStyle: "hidden",
        titleBarOverlay: { color: "#00000000", symbolColor: "#d9d9e3", height: Math.round(TITLE_BAR * theme.scale) },
        webPreferences: {
            preload: path.join(srcDir, "preload.cjs"),
            sandbox: true,
            contextIsolation: true,
            zoomFactor: theme.scale
        }
    });
    ctx.win = win;
    win.setMenu(null);
    // Without this the taskbar shows the stock Electron icon, since that's the program it runs.
    if (process.platform === "win32") win.setAppDetails({ ...APP_DETAILS, appIconPath: path.join(assetsDir, "atom.ico"), appIconIndex: 0 });
    setBlur(win, theme.background === "glass");
    win.loadURL("app://rpc/renderer/index.html");
    win.once("ready-to-show", () => {
        if (!process.argv.includes("--hidden")) win.show();
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
        openLink(url);
        return { action: "deny" };
    });
    win.webContents.on("will-navigate", event => event.preventDefault());

    // Closing the window tucks it into the tray and keeps presets live, and so does
    // minimizing if that's turned on in Settings; quitting from the tray clears them.
    win.on("close", event => {
        if (ctx.quitting) return;
        event.preventDefault();
        hideToTray();
    });
    win.on("minimize", () => {
        if (ctx.tray && ctx.store.prefs.minimizeToTray) hideToTray();
    });
}

function hideToTray() {
    ctx.win.hide();
    if (!ctx.store.prefs.trayHintShown && Notification.isSupported()) {
        new Notification({
            title: "RPC Manager is still running",
            body: "It's in the tray by the clock, and your presets stay live. Quit from there to clear them.",
            icon: path.join(assetsDir, "icon.png")
        }).show();
        ctx.store.setPrefs({ trayHintShown: true });
    }
}

export function showWindow() {
    const { win } = ctx;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}
