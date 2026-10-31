// Serves the window from app:// so it can load ES modules (shared/activity.js).
import { net, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { srcDir } from "./paths.js";

// Has to run before the app is ready.
export function registerAppScheme() {
    protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
}

export function serveApp() {
    protocol.handle("app", request => {
        const { pathname } = new URL(request.url);
        const file = path.normalize(path.join(srcDir, decodeURIComponent(pathname)));
        if (!file.startsWith(srcDir + path.sep)) return new Response("Not found", { status: 404 });
        return net.fetch(pathToFileURL(file).toString());
    });
}
