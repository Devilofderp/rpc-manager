// What each open tab last reported, and which tab is playing for a site.

const STALE_MS = 8000;      // a tab that stopped reporting is gone (closed, navigated away)

export const tabs = new Map();     // tabId -> { page, pageAt, players: Map(frameId -> state) }
let activeTabId = null;

export const setActiveTab = tabId => { activeTabId = tabId; };
export const forgetTab = tabId => tabs.delete(tabId);

// Stores a content script's report. Returns false if it didn't come from a tab.
export function recordReport(message, sender) {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    const tab = tabs.get(tabId) ?? { players: new Map() };
    tabs.set(tabId, tab);
    const now = Date.now();
    if (message.type === "page") {
        tab.page = message.page;
        tab.pageAt = now;
    }
    if (message.type === "player") tab.players.set(sender.frameId, { ...message, at: now });
    return true;
}

function playerFor(tab, now) {
    let best = null;
    for (const state of tab.players.values()) {
        if (now - state.at > STALE_MS) continue;
        if (!best || (state.playing && !best.playing) || (state.playing === best.playing && state.duration > best.duration)) best = state;
    }
    return best;
}

// When a tab last reported anything. A hidden tab (browser behind a game) only runs
// the page script's timer about once a minute, but its playing video keeps reporting,
// so the tab counts as present for as long as either does.
const lastSeen = tab => Math.max(tab.pageAt ?? 0, ...[...tab.players.values()].map(p => p.at));

export function dropQuietTabs(now) {
    for (const [tabId, tab] of tabs) if (now - lastSeen(tab) > STALE_MS * 4) tabs.delete(tabId);
}

// The playing tab for a site; the tab you're looking at breaks ties.
export function pick(site, now) {
    let best = null;
    for (const [tabId, tab] of tabs) {
        if (tab.page?.site !== site || now - lastSeen(tab) > STALE_MS) continue;
        const player = playerFor(tab, now);
        if (!player?.playing) continue;
        const score = (tabId === activeTabId ? 1 : 0) + tab.pageAt / 1e13;
        if (!best || score > best.score) best = { tab, player, score };
    }
    return best;
}
