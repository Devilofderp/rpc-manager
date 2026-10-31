// Local WebSocket server the browser extension connects to.
// Only browser extensions are accepted (web pages can't pretend to be one).
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { WebSocketServer } from "ws";

// RPC_MANAGER_BRIDGE_PORT lets a test copy run beside the real one.
const BRIDGE_PORT = Number(process.env.RPC_MANAGER_BRIDGE_PORT) || 47833;
const EXTENSION_ORIGIN = /^(chrome|moz)-extension:\/\//;

export class Bridge extends EventEmitter {
    connections = new Map(); // socket -> { version, activities: { site: activity }, updatedAt: { site: time } }

    // The extension version in the folder; a browser running anything else needs a reload.
    constructor(manifestFile) {
        super();
        try {
            this.expectedVersion = JSON.parse(fs.readFileSync(manifestFile, "utf8")).version;
        } catch {
            this.expectedVersion = null;
        }
    }

    start() {
        this.server = new WebSocketServer({
            host: "127.0.0.1",
            port: BRIDGE_PORT,
            verifyClient: ({ origin }) => EXTENSION_ORIGIN.test(origin ?? "")
        });
        this.server.on("error", err => console.error("bridge server error", err));
        this.server.on("connection", socket => {
            this.connections.set(socket, { version: null, activities: {}, updatedAt: {} });
            this.emitChange();
            socket.on("message", data => this.receive(socket, data));
            socket.on("close", () => {
                this.connections.delete(socket);
                this.emitChange();
            });
        });
    }

    receive(socket, data) {
        let message;
        try {
            message = JSON.parse(data);
        } catch {
            return;
        }
        const entry = this.connections.get(socket);
        if (message.type === "hello") {
            entry.version = String(message.version ?? "");
            // Tell the extension which version is on disk, so its popup can say when it needs a reload.
            socket.send(JSON.stringify({ type: "welcome", expectedVersion: this.expectedVersion }));
        } else if (message.type === "activities" && message.activities && typeof message.activities === "object") {
            const now = Date.now();
            for (const [site, activity] of Object.entries(message.activities)) {
                const next = activity && typeof activity === "object" ? activity : null;
                if (JSON.stringify(next) !== JSON.stringify(entry.activities[site] ?? null)) entry.updatedAt[site] = now;
                entry.activities[site] = next;
            }
        } else {
            return;
        }
        this.emitChange();
    }

    // Per site, the browser that most recently started showing something wins.
    activities() {
        const best = {};
        for (const entry of this.connections.values()) {
            for (const [site, activity] of Object.entries(entry.activities)) {
                if (!activity) continue;
                if (!best[site] || entry.updatedAt[site] > best[site].at) best[site] = { activity, at: entry.updatedAt[site] };
            }
        }
        return Object.fromEntries(Object.entries(best).map(([site, { activity }]) => [site, activity]));
    }

    snapshot() {
        const versions = [...this.connections.values()].map(c => c.version);
        return {
            browsers: this.connections.size,
            // An old copy of the extension never says hello, so it shows up as outdated too.
            outdated: Boolean(this.expectedVersion) && versions.some(v => v !== this.expectedVersion),
            activities: this.activities()
        };
    }

    emitChange() {
        this.emit("change", this.snapshot());
    }

    stop() {
        this.server?.close();
    }
}
