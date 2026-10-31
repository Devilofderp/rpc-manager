// Collects what each tab reports and sends the RPC Manager app one activity per
// site (YouTube, ReANIME, ...) over a local WebSocket.
//
// Only the sites in manifest.json are read, and only a video that is actually
// playing is shown: paused, stopped or just browsing means nothing at all.

const APP_URL = "ws://127.0.0.1:47833";
const SITE_IDS = ["youtube", "hulu", "reanime"];
const STALE_MS = 8000;      // a tab that stopped reporting is gone (closed, navigated away)
const DRIFT_MS = 3000;      // playback jitter smaller than this doesn't resend the progress bar
const LOOKUP_WAIT_MS = 3000; // how long a new episode waits for its name and links before showing anyway

const tabs = new Map();     // tabId -> { page, pageAt, players: Map(frameId -> state) }
let activeTabId = null;
let socket = null;
let connected = false;
let current = {};           // site -> the activity last sent to the app
let expectedVersion = null; // the extension version the app has on disk

/* Reports from the content scripts */

chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.type === "status") {
        const version = chrome.runtime.getManifest().version;
        reply({ connected, activities: current, version, outdated: Boolean(expectedVersion) && expectedVersion !== version });
        return;
    }
    // The popup's Reconnect button: a fresh connection to the app, then send everything again.
    if (message.type === "refresh") {
        reconnect();
        reply({});
        return;
    }
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    const tab = tabs.get(tabId) ?? { players: new Map() };
    tabs.set(tabId, tab);
    const now = Date.now();
    if (message.type === "page") {
        tab.page = message.page;
        tab.pageAt = now;
    }
    if (message.type === "player") tab.players.set(sender.frameId, { ...message, at: now });
    update();
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
                files: script.js
            }).catch(() => {});
        }
    }
});

chrome.tabs.onRemoved.addListener(tabId => {
    tabs.delete(tabId);
    update();
});

// A tab loading a new page has stopped playing whatever it had.
chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status !== "loading" || !tabs.has(tabId)) return;
    tabs.delete(tabId);
    update();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    activeTabId = tabId;
    update();
});

/* Looking things up (anime episode names and legal links) */

const lookups = new Map(); // key -> { started, done, value }

function lookup(key, load) {
    let entry = lookups.get(key);
    if (!entry) {
        entry = { started: Date.now(), done: false, value: null };
        lookups.set(key, entry);
        load()
            .then(value => { entry.value = value; })
            .catch(() => setTimeout(() => lookups.delete(key), 60_000)) // try again later
            .finally(() => {
                entry.done = true;
                update();
            });
    }
    return entry;
}

async function getJson(url, options = {}) {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
    return res.json();
}

const KITSU = { headers: { Accept: "application/vnd.api+json" } };

// AniList: the anime's page (the one button shown) and episode titles from the
// streaming services it lists ("Episode 3 - Killing Magic").
async function aniList(anilistId) {
    const json = await getJson("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
            query: "query ($id: Int) { Media(id: $id) { siteUrl streamingEpisodes { title } } }",
            variables: { id: anilistId }
        })
    });
    const media = json.data?.Media;
    if (!media) return null;
    const buttons = media.siteUrl ? [{ label: "View on AniList", url: media.siteUrl }] : [];
    const titles = {};
    for (const { title } of media.streamingEpisodes ?? []) {
        const match = title.match(/^Episode\s+(\d+)\s*[-:]\s*(.+)$/i);
        if (match) titles[match[1]] = match[2].trim();
    }
    return { buttons, titles };
}

// Kitsu has per-episode titles for most shows; AniList's streaming titles are the fallback.
async function episodeTitle(anilistId, episode) {
    const mapping = await getJson(`https://kitsu.io/api/edge/mappings?filter[externalSite]=anilist/anime&filter[externalId]=${anilistId}&include=item`, KITSU).catch(() => null);
    const kitsuId = mapping?.included?.[0]?.id;
    let name = "";
    if (kitsuId) {
        const json = await getJson(`https://kitsu.io/api/edge/anime/${kitsuId}/episodes?filter[number]=${episode}`, KITSU).catch(() => null);
        const attributes = json?.data?.[0]?.attributes;
        name = attributes?.titles?.en || attributes?.canonicalTitle || "";
    }
    if (!name) name = (await aniList(anilistId).catch(() => null))?.titles[episode] ?? "";
    // Some entries are just "Episode 3", which adds nothing.
    return /^Episode\s+\d+$/i.test(name.trim()) ? "" : name.trim();
}

// Hulu doesn't hand its artwork to the page, so posters are looked up by title:
// shows on TVmaze, movies (and shows TVmaze misses) through IMDb's search suggestions.
const https = url => /^https:\/\//.test(url ?? "") ? url : "";

async function tvmazePoster(title) {
    const json = await getJson(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`).catch(() => null);
    return https(json?.image?.original ?? json?.image?.medium);
}

// IMDb's search box feed (unofficial, no key): v3.sg.media-imdb.com/suggestion/<first letter>/<query>.json
async function imdbPoster(title, kind) {
    const query = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, "_");
    if (!query) return "";
    const json = await getJson(`https://v3.sg.media-imdb.com/suggestion/${query[0]}/${encodeURIComponent(query)}.json`).catch(() => null);
    const wanted = kind === "movie" ? ["movie"] : ["tvSeries", "tvMiniSeries"];
    const hit = (json?.d ?? []).find(item => wanted.includes(item.qid) && item.i?.imageUrl);
    // Ask for a 600px-wide copy instead of the full-size original.
    return https(hit?.i.imageUrl.replace(/\._V1_.*\.jpg$/, "._V1_SX600.jpg"));
}

async function posterFor({ title, kind }) {
    if (kind === "show") return (await tvmazePoster(title)) || imdbPoster(title, kind);
    return imdbPoster(title, kind);
}

/* Building each site's activity */

const KEEP = Symbol("keep");

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

// The playing tab for a site; the tab you're looking at breaks ties.
function pick(site, now) {
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

function playbackStamps(player, now) {
    if (player.live || !player.duration) return { start: player.startedAt || now };
    const start = now - player.currentTime * 1000;
    return { start, end: start + player.duration * 1000 };
}

// A site that knows the real position itself (Hulu, where ads are part of the video).
function pageStamps(page, pageAt, player, now) {
    if (page.live) return { start: player.startedAt || now };
    if (!page.position) return playbackStamps(player, now);
    const start = pageAt - page.position.current * 1000;
    return { start, end: start + page.position.duration * 1000 };
}

function build(site, now) {
    const chosen = pick(site, now);
    if (!chosen) return null;
    const { player } = chosen;
    const page = chosen.tab.page;
    const activity = {
        type: 3,
        name: page.name,
        details: page.details || undefined,
        state: page.state || undefined,
        assets: page.largeImage ? { large_image: page.largeImage } : undefined,
        buttons: page.buttons,
        timestamps: pageStamps(page, chosen.tab.pageAt, player, now)
    };

    // An ad's length isn't the video's: keep showing the video as it was.
    if (page.ad) return current[site] ? KEEP : null;

    if (site === "reanime" && page.anilistId) {
        const info = lookup(`anilist:${page.anilistId}`, () => aniList(page.anilistId));
        const name = page.details || !page.episode
            ? { done: true, value: page.details }
            : lookup(`episode:${page.anilistId}:${page.episode}`, () => episodeTitle(page.anilistId, page.episode));
        // Wait briefly for the name and links so Discord gets one complete update, not three.
        const pending = (!info.done || !name.done) && now - Math.min(info.started, name.started ?? now) < LOOKUP_WAIT_MS;
        if (pending) {
            if (!info.done || !name.done) setTimeout(update, LOOKUP_WAIT_MS);
            return current[site] ? KEEP : null;
        }
        activity.details = name.value || undefined;
        activity.buttons = info.value?.buttons;
    }

    // No artwork on the page: wait briefly for a poster, then fall back.
    if (page.posterLookup) {
        const { title, kind } = page.posterLookup;
        const poster = lookup(`poster:${kind}:${title}`, () => posterFor(page.posterLookup));
        if (!poster.done && now - poster.started < LOOKUP_WAIT_MS) {
            setTimeout(update, LOOKUP_WAIT_MS);
            return current[site] ? KEEP : null;
        }
        activity.assets = { large_image: poster.value || page.fallbackImage };
    }
    return activity;
}

// Same activity apart from a little playback drift counts as unchanged.
function same(a, b) {
    if (!a || !b) return !a && !b;
    const strip = x => JSON.stringify({ ...x, timestamps: undefined });
    if (strip(a) !== strip(b)) return false;
    const ta = a.timestamps;
    const tb = b.timestamps;
    if (!ta || !tb) return !ta && !tb;
    return Math.abs(ta.start - tb.start) < DRIFT_MS && Math.abs((ta.end ?? 0) - (tb.end ?? 0)) < DRIFT_MS;
}

function update() {
    const now = Date.now();
    for (const [tabId, tab] of tabs) if (now - lastSeen(tab) > STALE_MS * 4) tabs.delete(tabId);
    const next = {};
    for (const site of SITE_IDS) {
        const activity = build(site, now);
        next[site] = activity === KEEP ? current[site] : activity && JSON.parse(JSON.stringify(activity));
    }
    if (SITE_IDS.every(site => same(next[site], current[site]))) return;
    current = next;
    send({ type: "activities", activities: current });
}

/* Connection to the app */

function send(message) {
    if (connected) socket.send(JSON.stringify(message));
}

function connect() {
    if (socket && socket.readyState <= WebSocket.OPEN) return;
    const ws = new WebSocket(APP_URL);
    socket = ws;
    // Events from a connection that has since been replaced are ignored.
    ws.addEventListener("open", () => {
        if (socket !== ws) return;
        connected = true;
        send({ type: "hello", version: chrome.runtime.getManifest().version });
        send({ type: "activities", activities: current });
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
function reconnect() {
    const old = socket;
    socket = null;
    connected = false;
    old?.close();
    connect();
}

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
