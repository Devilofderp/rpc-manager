// Builds each site's activity from what its tab reports, and sends the app any change.
import { aniList, episodeTitle } from "./anime.js";
import { send } from "./connection.js";
import { lookup } from "./lookups.js";
import { posterFor } from "./posters.js";
import { dropQuietTabs, pick } from "./tabs.js";

const SITE_IDS = ["youtube", "twitch", "hulu", "reanime"];
const DRIFT_MS = 3000;      // playback jitter smaller than this doesn't resend the progress bar
const LOOKUP_WAIT_MS = 3000; // how long a new episode waits for its name and links before showing anyway
const KEEP = Symbol("keep");

let current = {};           // site -> the activity last sent to the app

export const currentActivities = () => current;

function playbackStamps(player, now) {
    if (player.live || !player.duration) return { start: player.startedAt || now };
    const start = now - player.currentTime * 1000;
    return { start, end: start + player.duration * 1000 };
}

// A site that knows the real position itself (Hulu, where ads are part of the video).
function pageStamps(page, pageAt, player, now) {
    if (page.live) return { start: page.streamStart || player.startedAt || now };
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

export function update() {
    const now = Date.now();
    dropQuietTabs(now);
    const next = {};
    for (const site of SITE_IDS) {
        const activity = build(site, now);
        next[site] = activity === KEEP ? current[site] : activity && JSON.parse(JSON.stringify(activity));
    }
    if (SITE_IDS.every(site => same(next[site], current[site]))) return;
    current = next;
    send({ type: "activities", activities: current });
}
