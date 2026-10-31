// Why Discord can be open with no connection for this app. Clients that are their own program
// have no Discord connection of their own, only arRPC: a stand-in that answers the same way,
// behind a setting. Ones that patch regular Discord (Vencord, Equicord, BetterDiscord) run as
// Discord.exe and work as is, unless a plugin has turned the connection off.
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CLIENTS = [
    { exe: "vesktop.exe", name: "Vesktop", fix: "turn on Rich Presence in its settings" },
    { exe: "equibop.exe", name: "Equibop", fix: "turn on Use Built-in Server in its Rich Presence settings" },
    { exe: "legcord.exe", name: "Legcord", fix: "turn on Rich Presence in its settings" },
    { exe: "goofcord.exe", name: "GoofCord", fix: "turn on Rich Presence in its settings" }
];
const DISCORD = [
    { exe: "discord.exe", name: "Discord" },
    { exe: "discordptb.exe", name: "Discord PTB" },
    { exe: "discordcanary.exe", name: "Discord Canary" }
];

// arRPC can't see who's logged in, so it answers with this made-up user.
export const ARRPC_USER_ID = "1045800378228281345";

// Only Equicord's file counts: Vencord deleted this plugin, so its file can still say on.
function noRpcPluginOn() {
    try {
        const file = path.join(process.env.APPDATA ?? "", "Equicord", "settings", "settings.json");
        return JSON.parse(fs.readFileSync(file, "utf8")).plugins?.NoRPC?.enabled === true;
    } catch {
        return false;
    }
}

export function runningClient() {
    return new Promise(resolve => {
        execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true }, (_err, stdout) => {
            const running = (stdout ?? "").toLowerCase();
            const isRunning = client => running.includes(`"${client.exe}"`);
            const client = CLIENTS.find(isRunning);
            if (client) return resolve(client);
            const discord = DISCORD.find(isRunning);
            if (!discord) return resolve(null);
            // Also true for a few seconds while Discord starts up, hence "if this stays".
            const fix = noRpcPluginOn() ? "turn off Equicord's NoRPC plugin, then restart it" : "if this stays, quit it from the tray and reopen it";
            resolve({ name: discord.name, fix });
        });
    });
}
