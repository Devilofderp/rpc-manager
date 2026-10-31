// The connection to the RPC Manager app.
import { currentActivities } from "./activities.js";

const APP_URL = "ws://127.0.0.1:47833";

let socket = null;
let connected = false;
let expectedVersion = null; // the extension version the app has on disk

export const isConnected = () => connected;
export const isOutdated = version => Boolean(expectedVersion) && expectedVersion !== version;

export function send(message) {
    if (connected) socket.send(JSON.stringify(message));
}

export function connect() {
    if (socket && socket.readyState <= WebSocket.OPEN) return;
    const ws = new WebSocket(APP_URL);
    socket = ws;
    // Events from a connection that has since been replaced are ignored.
    ws.addEventListener("open", () => {
        if (socket !== ws) return;
        connected = true;
        send({ type: "hello", version: chrome.runtime.getManifest().version });
        send({ type: "activities", activities: currentActivities() });
    });
    ws.addEventListener("message", event => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === "welcome") expectedVersion = message.expectedVersion ?? null;
        } catch {}
    });
    ws.addEventListener("close", () => {
        if (socket !== ws) return;
        connected = false;
        setTimeout(connect, 3000);
    });
    ws.addEventListener("error", () => ws.close());
}

// Drop the current connection and open a fresh one right away.
export function reconnect() {
    const old = socket;
    socket = null;
    connected = false;
    old?.close();
    connect();
}
