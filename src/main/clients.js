// Discord clients that are their own program. Ones that patch regular Discord (Vencord,
// Equicord, BetterDiscord) run as Discord.exe and work as is, but these have no Discord
// connection of their own, only arRPC: a stand-in that answers the same way, behind a setting.
import { execFile } from "node:child_process";

const CLIENTS = [
    { exe: "vesktop.exe", name: "Vesktop", fix: "turn on Rich Presence in its settings" },
    { exe: "equibop.exe", name: "Equibop", fix: "turn on Use Built-in Server in its Rich Presence settings" },
    { exe: "legcord.exe", name: "Legcord", fix: "turn on Rich Presence in its settings" },
    { exe: "goofcord.exe", name: "GoofCord", fix: "turn on Rich Presence in its settings" }
];

// arRPC can't see who's logged in, so it answers with this made-up user.
export const ARRPC_USER_ID = "1045800378228281345";

export function runningClient() {
    return new Promise(resolve => {
        execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true }, (_err, stdout) => {
            const running = (stdout ?? "").toLowerCase();
            resolve(CLIENTS.find(client => running.includes(`"${client.exe}"`)) ?? null);
        });
    });
}
