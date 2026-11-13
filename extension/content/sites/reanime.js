// Re:ANIME (reanime.to / reanime.cz / reanime.wtf): describes the episode on a watch page.
// Other pages (home, search, an anime's page) report nothing, and the site's
// own name never appears. The background only shows it while the video plays.
// The page selectors follow PreMiD's open-source ReAnime activity (MPL-2.0).
// Each content script gets its own scope: they share one global space per page.
(() => {
    const clean = text => (text ?? "").replace(/\s+/g, " ").trim();
    const meta = selector => clean(document.querySelector(selector)?.content);
    const params = () => new URLSearchParams(location.search);

    // Paths may carry a language prefix such as /it/watch/...
    const isWatchPage = () => location.pathname.replace(/^\/[a-z]{2}(?=\/)/, "").startsWith("/watch/");

    function animeTitle() {
        return clean(document.querySelector("h2[title]")?.getAttribute("title"))
            || meta('meta[property="og:title"]').replace(/^Watch\s+/i, "").replace(/\s+Episode\s+\d+.*$/i, "").replace(/\s+Online Free.*$/i, "")
            || clean(document.title).replace(/\s*-\s*Episode\s+\d+.*$/i, "").replace(/\s*\|\s*Re:ANIME$/i, "");
    }

    // The show's cover (from AniList); no fallback to the site's logo.
    function poster() {
        const image = meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]');
        return /^https:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(image) ? image : null;
    }

    // The highlighted episode card reads like "5. The Journey's End", or "5. Episode 5"
    // when the episode has no name of its own.
    function episode() {
        const card = clean(document.querySelector("a.episode-playing .line-clamp-1")?.textContent);
        const match = card.match(/^(\d+)\.\s*(.*)$/);
        const ep = params().get("ep");
        const number = match?.[1] ?? (/^\d+$/.test(ep ?? "") ? ep : "");
        const name = match?.[2] && !/^Episode\s+\d+$/i.test(match[2]) ? match[2] : "";
        return { number, name };
    }

    // Watching <show> / <episode name> / Episode 5 · SUB
    function describe() {
        const title = animeTitle();
        if (!title) return null;
        const { number, name } = episode();
        const lang = (params().get("lang") ?? "").toUpperCase();
        const image = poster();
        // The poster's file name carries the show's AniList ID (".../bx154587-...").
        const anilistId = image?.match(/\/cover\/\w+\/b?x?(\d+)-/)?.[1];
        // No links back to the site: the background adds the AniList page and
        // looks up the episode name from these IDs.
        return {
            site: "reanime",
            name: title,
            details: name,
            state: [number && `Episode ${number}`, lang].filter(Boolean).join(" · "),
            largeImage: image,
            anilistId: anilistId ? Number(anilistId) : undefined,
            episode: number ? Number(number) : undefined
        };
    }

    function report() {
        const page = isWatchPage() ? describe() : null;
        if (!page) return;
        try {
            chrome.runtime.sendMessage({ type: "page", page });
        } catch {
            clearInterval(timer);
        }
    }

    const timer = setInterval(report, 2000);
    report();
})();
