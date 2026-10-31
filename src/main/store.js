// Presets live in presets.json in the app's data folder (%APPDATA%\RPC Manager).
import fs from "node:fs";
import path from "node:path";
import { newPreset, newSitePreset } from "../shared/activity.js";
import { SITES } from "../shared/sites.js";

const CUSTOM_RPC_SOURCES = ["Equicord", "Vencord"];

export class Store {
    constructor(dataDir) {
        this.file = path.join(dataDir, "presets.json");
        this.prefs = {};
        this.presets = this.load();
    }

    load() {
        try {
            const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
            this.prefs = data.prefs ?? {};
            // Fill in fields added in later versions.
            const presets = data.presets.filter(p => p.kind !== "browser").map(p => newPreset(p));
            // The old single "Browser" entry becomes one preset per site, at the top,
            // so what you're watching shows above custom presets.
            const browser = data.presets.find(p => p.kind === "browser");
            if (browser) presets.unshift(...["youtube", "reanime"].map(site => newSitePreset(site, SITES[site].name, { active: browser.active })));
            return presets;
        } catch (err) {
            if (err.code !== "ENOENT") console.error("could not read presets", err);
            return importCustomRpc();
        }
    }

    set(presets) {
        this.presets = presets;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.flush(), 400);
    }

    setPrefs(prefs) {
        Object.assign(this.prefs, prefs);
        this.flush();
    }

    flush() {
        clearTimeout(this.saveTimer);
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const temp = `${this.file}.tmp`;
        fs.writeFileSync(temp, JSON.stringify({ version: 2, presets: this.presets, prefs: this.prefs }, null, 2));
        fs.renameSync(temp, this.file);
    }
}

// First run: copy the Vencord/Equicord CustomRPC setup in as a preset, if there is one.
function importCustomRpc() {
    for (const source of CUSTOM_RPC_SOURCES) {
        const file = path.join(process.env.APPDATA ?? "", source, "settings", "settings.json");
        let settings;
        try {
            settings = JSON.parse(fs.readFileSync(file, "utf8")).plugins?.CustomRPC;
        } catch {
            continue;
        }
        if (!settings?.appID) continue;

        const progress = settings.timestampMode === 3 && settings.startTime && settings.endTime > settings.startTime;
        return [newPreset({
            label: settings.appName || `${source} CustomRPC`,
            appId: settings.appID,
            type: [0, 2, 3, 5].includes(settings.type) ? settings.type : 0,
            name: settings.appName ?? "",
            details: settings.details ?? "",
            detailsUrl: settings.detailsURL ?? "",
            state: settings.state ?? "",
            stateUrl: settings.stateURL ?? "",
            largeImage: settings.imageBig ?? "",
            largeText: settings.imageBigTooltip ?? "",
            largeUrl: settings.imageBigURL ?? "",
            smallImage: settings.imageSmall ?? "",
            smallText: settings.imageSmallTooltip ?? "",
            smallUrl: settings.imageSmallURL ?? "",
            buttons: [
                { label: settings.buttonOneText ?? "", url: settings.buttonOneURL ?? "" },
                { label: settings.buttonTwoText ?? "", url: settings.buttonTwoURL ?? "" }
            ],
            timer: progress ? "progress" : ({ 1: "activated", 2: "midnight" }[settings.timestampMode] ?? "none"),
            progressSeconds: progress ? Math.round((settings.endTime - settings.startTime) / 1000) : 1440,
            partySize: settings.partySize ?? 0,
            partyMax: settings.partyMaxSize ?? 0
        })];
    }
    return [];
}
