// Anime episode names and legal links, from AniList and Kitsu.
import { getJson } from "./lookups.js";

const KITSU = { headers: { Accept: "application/vnd.api+json" } };

// AniList: the anime's page (the one button shown) and episode titles from the
// streaming services it lists ("Episode 3 - Killing Magic").
export async function aniList(anilistId) {
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
export async function episodeTitle(anilistId, episode) {
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
