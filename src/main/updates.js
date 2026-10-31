// Keeps an installed copy up to date from the GitHub releases (the "publish" setting in
// package.json): checks when the app starts and every few hours, downloads in the
// background, then waits for a restart. Quitting from the tray installs it too.
import electronUpdater from "electron-updater";
import { EventEmitter } from "node:events";

const CHECK_EVERY = 4 * 60 * 60 * 1000;

export class Updates extends EventEmitter {
    ready = null; // the downloaded version, waiting for a restart

    start() {
        const { autoUpdater } = electronUpdater;
        autoUpdater.on("update-downloaded", ({ version }) => {
            this.ready = version;
            this.emit("ready", version);
        });
        // No internet or no release yet: try again at the next check.
        autoUpdater.on("error", err => console.error("update check failed", err.message));
        const check = () => autoUpdater.checkForUpdates().catch(() => {});
        check();
        setInterval(check, CHECK_EVERY);
    }

    // Installs without any windows and opens the app again.
    install() {
        electronUpdater.autoUpdater.quitAndInstall(true, true);
    }
}
