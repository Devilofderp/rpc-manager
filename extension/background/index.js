// The extension's background worker: wires the browser's events to the rest.
//
// It collects what each tab reports and sends the RPC Manager app one activity per
// site (YouTube, ReANIME, ...) over a local WebSocket. Only the sites in manifest.json are
// read, and only a video that is actually playing is shown: paused, stopped or just
// browsing means nothing at all.
import { currentActivities, update } from "./activities.js";
import { connect, isConnected, isOutdated, reconnect, send } from "./connection.js";
import { forgetTab, recordReport, setActiveTab, tabs } from "./tabs.js";

/* Reports from the content scripts */

chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.type === "status") {
        const version = chrome.runtime.getManifest().version;
        reply({ connected: isConnected(), activities: currentActivities(), version, outdated: isOutdated(version) });
        return;
    }
    // The popup's Reconnect button: a fresh connection to the app, then send everything again.
    if (message.type === "refresh") {
        reconnect();
        reply({});
        return;
    }
    if (recordReport(message, sender)) update();
});

// After the extension is installed, updated or refreshed, put its page scripts back
// into tabs that are already open, so a playing video keeps being seen without a reload.
// (Not after a browser update: tabs reopened then already got the scripts on load.)
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== "install" && reason !== "update") return;
    for (const script of chrome.runtime.getManifest().content_scripts ?? []) {
        const open = await chrome.tabs.query({ url: script.matches }).catch(() => []);
        for (const tab of open) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: Boolean(script.all_frames) },
                files: script.js,
                world: script.world ?? "ISOLATED"
            }).catch(() => {});
        }
    }
});

chrome.tabs.onRemoved.addListener(tabId => {
    forgetTab(tabId);
    update();
});

// A tab loading a new page has stopped playing whatever it had.
chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status !== "loading" || !tabs.has(tabId)) return;
    forgetTab(tabId);
    update();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    setActiveTab(tabId);
    update();
});

/* Staying connected */

// The browser puts this worker to sleep when nothing happens; the alarm wakes
// it every 30 seconds so it reconnects to the app even when no video is open.
chrome.alarms.create("reconnect", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => {
    connect();
    update();
});

// Regular traffic keeps the worker awake while connected and drops tabs that went quiet.
setInterval(() => {
    update();
    send({ type: "ping" });
}, 5000);

connect();
