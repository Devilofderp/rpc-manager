// Dev aid: `npm start -- --snapshot=out.png` saves a screenshot of the window and quits.
// `--snapshot-js=file.js` runs that script in the page first (e.g. to open a menu).
import { app } from "electron";
import fs from "node:fs";
import { ctx } from "./context.js";

export function maybeSnapshot() {
    const arg = process.argv.find(a => a.startsWith("--snapshot="));
    if (!arg) return;
    const script = process.argv.find(a => a.startsWith("--snapshot-js="));
    const { win } = ctx;
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
        try {
            const image = await win.webContents.capturePage();
            fs.writeFileSync(arg.slice("--snapshot=".length), image.toPNG());
        } finally {
            ctx.quitting = true;
            app.quit();
        }
    });
}
