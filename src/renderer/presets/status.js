// A preset's live status: what its chip and the line above the editor say.
import { h } from "../dom.js";
import { siteName, state } from "../state.js";

export function statusFor(preset) {
    if (!preset.active) return { cls: "off", text: "Off", long: "Turned off. Switch it on in the list to show it on Discord." };
    if (preset.kind === "site") {
        if (!state.bridge.browsers)
            return { cls: "error", text: "No extension", long: "Your browser's RPC Manager extension isn't connected. See below." };
        if (state.bridge.outdated)
            return { cls: "error", text: "Reload extension", long: "Your browser is running an older copy of the extension. See below." };
        if (!state.bridge.activities[preset.site])
            return { cls: "off", text: "Idle", long: `Nothing playing on ${siteName(preset)} right now. It shows up the moment a video plays.` };
    }
    if (state.presence.status.state !== "connected")
        return { cls: "off", text: "Waiting", long: "Waiting for Discord to open. It goes live as soon as Discord is running." };
    const live = state.presence.live[preset.id];
    switch (live?.state) {
        case "live": return { cls: "live", text: "Live", long: "Live on your Discord profile." };
        case "sending": return {
            cls: "sending",
            text: "Updating",
            long: live.limited
                ? "Waiting on Discord: it limits how often your status can change, so this can take up to about 30 seconds after a lot of changes."
                : "Sending your changes to Discord…"
        };
        case "error": return { cls: "error", text: "Problem", long: live.error };
        default: return { cls: "sending", text: "Starting", long: "Starting…" };
    }
}

export const chip = status => h("span", { class: `chip ${status.cls}`, text: status.text });
