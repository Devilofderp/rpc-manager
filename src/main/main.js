import { app, BrowserWindow, ipcMain, Menu, nativeTheme, net, Notification, protocol, shell, Tray } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { appInfo } from "./appinfo.js";
import { Bridge } from "./bridge.js";
import { Presence } from "./presence.js";
import { setBlur } from "./blur.js";
import { Icons } from "./icons.js";
import { Store } from "./store.js";
import { Updates } from "./updates.js";
import { normalizeTheme, windowColorFor } from "../shared/theme.js";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// Installed, the app's files are packed into app.asar. Windows reads the icon files itself
// (taskbar, shortcuts), so those are kept unpacked beside it, and the browser loads the
// extension from its own folder next to the app.
const assetsDir = path.join(srcDir, "assets").replace(/app\.asar(?=[\\/])/, "app.asar.unpacked");
const extensionDir = app.isPackaged ? path.join(process.resourcesPath, "extension") : path.join(srcDir, "..", "extension");
// Glass uses Windows' blur-behind (blur.js), which Windows 10 and 11 both have.
const glassSupported = process.platform === "win32";
// Windows groups taskbar buttons and finds the shortcuts' icon by this ID (the installer's
// appId in package.json and tools/install-shortcut.mjs use the same one).
const APP_ID = "RPCManager.Desktop";
const APP_DETAILS = {
    appId: APP_ID,
    relaunchCommand: app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${path.join(srcDir, "..")}"`,
    relaunchDisplayName: "RPC Manager"
};
// A test copy (own bridge port) stays out of the tray so it isn't mistaken for the real app.
const isTestCopy = Boolean(process.env.RPC_MANAGER_BRIDGE_PORT);

if (!app.requestSingleInstanceLock() || process.argv.includes("--quit")) app.exit(0);

// Serve the window from app:// so it can load ES modules (shared/activity.js).
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let win;
let tray;
let store;
let presence;
let bridge;
let icons;
let updates;
let quitting = false;

function serveApp() {
    protocol.handle("app", request => {
        const { pathname } = new URL(request.url);
        const file = path.normalize(path.join(srcDir, decodeURIComponent(pathname)));
        if (!file.startsWith(srcDir + path.sep)) return new Response("Not found", { status: 404 });
        return net.fetch(pathToFileURL(file).toString());
    });
}

const currentTheme = () => {
    const theme = normalizeTheme(store.prefs.theme);
    // Glass needs Windows' blur-behind; elsewhere it falls back to dark gray.
    if (theme.background === "glass" && !glassSupported) theme.background = "dark";
    return theme;
};

// The title bar is 46px; Windows' own buttons on the right grow with the UI size.
const TITLE_BAR = 46;

// The window's own background (behind the page) and the UI size follow the theme.
function applyWindowTheme(theme) {
    win.setBackgroundColor(windowColorFor(theme));
    setBlur(win, theme.background === "glass");
    win.webContents.setZoomFactor(theme.scale);
    if (process.platform === "win32") win.setTitleBarOverlay({ height: Math.round(TITLE_BAR * theme.scale) });
}

function createWindow() {
    const theme = currentTheme();
    win = new BrowserWindow({
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

    // Closing or minimizing the window tucks it into the tray and keeps presets live;
    // quitting from the tray clears them.
    win.on("close", event => {
        if (quitting) return;
        event.preventDefault();
        hideToTray();
    });
    win.on("minimize", () => {
        if (tray) hideToTray();
    });
}

function hideToTray() {
    win.hide();
    if (!store.prefs.trayHintShown && Notification.isSupported()) {
        new Notification({
            title: "RPC Manager is still running",
            body: "It's in the tray by the clock, and your presets stay live. Quit from there to clear them.",
            icon: path.join(assetsDir, "icon.png")
        }).show();
        store.setPrefs({ trayHintShown: true });
    }
}

function showWindow() {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
}

function trayMenu() {
    return Menu.buildFromTemplate([
        { label: "Open RPC Manager", click: showWindow },
        ...(updates.ready ? [{ label: "Restart to update", click: () => updates.install() }] : []),
        { type: "separator" },
        { label: "Quit and clear presence", click: () => app.quit() }
    ]);
}

function createTray() {
    tray = new Tray(path.join(assetsDir, "tray.png"));
    tray.setToolTip("RPC Manager");
    tray.setContextMenu(trayMenu());
    tray.on("click", showWindow);
}

// A new version is downloaded: the title bar and tray offer the restart, and a
// notification says so if the window is tucked away.
function updateReady(version) {
    tray?.setContextMenu(trayMenu());
    win.webContents.send("update:ready", version);
    if (!win.isVisible() && Notification.isSupported()) {
        new Notification({
            title: "RPC Manager update ready",
            body: "Open RPC Manager and click Restart to update.",
            icon: path.join(assetsDir, "icon.png")
        }).show();
    }
}

function openLink(url) {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
}

function registerIpc() {
    ipcMain.handle("state:get", () => ({
        presets: store.presets,
        presence: presence.snapshot(),
        bridge: bridge.snapshot(),
        extensionDir,
        theme: currentTheme(),
        titleIcon: icons.titleIcon(currentTheme().accent),
        glassSupported,
        updateReady: updates.ready
    }));
    ipcMain.on("theme:set", (_event, theme) => {
        const before = currentTheme().accent;
        store.setPrefs({ theme: normalizeTheme(theme) });
        applyWindowTheme(currentTheme());
        if (currentTheme().accent !== before) icons.apply(currentTheme().accent, { win, tray }).catch(err => console.error("icon update failed", err));
    });
    ipcMain.on("extension:open", () => shell.openPath(extensionDir));
    ipcMain.on("update:install", () => updates.install());
    bridge.on("change", snapshot => {
        presence.setSiteActivities(snapshot.activities);
        win?.webContents.send("bridge:change", snapshot);
    });
    ipcMain.on("presets:set", (_event, presets) => {
        store.set(presets);
        presence.update(presets);
    });
    ipcMain.handle("app:info", (_event, appId) => appInfo(String(appId)));
    ipcMain.on("link:open", (_event, url) => openLink(String(url)));
    presence.on("change", snapshot => win?.webContents.send("presence:change", snapshot));
}

// Dev aid: `npm start -- --snapshot=out.png` saves a screenshot of the window and quits.
// `--snapshot-js=file.js` runs that script in the page first (e.g. to open a menu).
async function maybeSnapshot() {
    const arg = process.argv.find(a => a.startsWith("--snapshot="));
    if (!arg) return;
    const script = process.argv.find(a => a.startsWith("--snapshot-js="));
    // A hidden window stops redrawing, so show it invisible instead: fully
    // transparent, click-through, unfocusable and off the taskbar.
    win.setSkipTaskbar(true);
    win.setFocusable(false);
    win.setIgnoreMouseEvents(true);
    win.setOpacity(0);
    win.showInactive();
    win.webContents.once("did-finish-load", async () => {
        await new Promise(resolve => setTimeout(resolve, 2500));
        if (script) {
            await win.webContents.executeJavaScript(fs.readFileSync(script.slice("--snapshot-js=".length), "utf8"));
            await new Promise(resolve => setTimeout(resolve, 600));
        }
        const image = await win.webContents.capturePage();
        fs.writeFileSync(arg.slice("--snapshot=".length), image.toPNG());
        quitting = true;
        app.quit();
    });
}

// Starting the app again shows the window; `--quit` asks the running copy to quit instead.
app.on("second-instance", (_event, argv) => {
    if (argv.includes("--quit")) return app.quit();
    if (win) showWindow();
});

app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    nativeTheme.themeSource = "dark";
    store = new Store(app.getPath("userData"));
    presence = new Presence();
    bridge = new Bridge(path.join(extensionDir, "manifest.json"));
    bridge.start();
    icons = new Icons({
        assetsDir,
        cacheDir: path.join(app.getPath("userData"), "icons"),
        // A test copy must never repaint the real shortcuts.
        shortcuts: isTestCopy ? [] : [
            path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "RPC Manager.lnk"),
            path.join(app.getPath("desktop"), "RPC Manager.lnk")
        ],
        appDetails: APP_DETAILS
    });
    updates = new Updates();
    updates.on("ready", updateReady);
    serveApp();
    registerIpc();
    createWindow();
    if (!isTestCopy) createTray();
    icons.apply(currentTheme().accent, { win, tray }).catch(err => console.error("icon update failed", err));
    maybeSnapshot();
    presence.start(store.presets);
    if (app.isPackaged) updates.start();
});

app.on("before-quit", () => {
    quitting = true;
    presence?.stop();
    bridge?.stop();
    store?.flush();
});
