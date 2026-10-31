// Hulu doesn't hand its artwork to the page, so posters are looked up by title:
// shows on TVmaze, movies (and shows TVmaze misses) through IMDb's search suggestions.
import { getJson } from "./lookups.js";

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

export async function posterFor({ title, kind }) {
    if (kind === "show") return (await tvmazePoster(title)) || imdbPoster(title, kind);
    return imdbPoster(title, kind);
}
