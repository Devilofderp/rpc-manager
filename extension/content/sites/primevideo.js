// Prime Video (primevideo.com, and amazon.com/gp/video): describes what's playing in the player.
// Watching <show or movie> / <episode name> / Season <n> · Episode <n>. The player opens over the
// title's page, which can autoplay a trailer, so nothing counts until the player itself is open.
// Each content script gets its own scope: they share one global space per page.
(() => {
    const PRIME_LOGO = "https://m.media-amazon.com/images/G/01/digital/video/DVUI/favicons/apple-touch-icon-152x152.png";

    const clean = text => (text ?? "").replace(/\s+/g, " ").trim();
    const textOf = selector => clean(document.querySelector(selector)?.textContent);

    // The player's title bar hides with its controls, so the episode line it last showed is kept
    // for as long as the same video plays.
    let remembered = { source: null, subtitle: "" };

    // Several players can be on the page (the last episode stays behind, paused): the playing one.
    function playerVideo() {
        const videos = [...document.querySelectorAll('div[id^="dv-web-player"] video')];
        return videos.find(video => !video.paused) ?? videos.find(video => video.clientWidth > 0) ?? null;
    }

    // "Season 1, Ep. 3 Name" or "S1 E3 Name" becomes the episode name and "Season 1 · Episode 3".
    function episode(subtitle) {
        const parts = subtitle.match(/^(?:Season\s*(\d+),?\s*Ep(?:isode)?\.?\s*(\d+)|S(\d+)\s*E(\d+))[\s:.,-]*(.*)$/i);
        if (!parts) return { details: subtitle || undefined };
        return { details: parts[5] || undefined, state: `Season ${parts[1] ?? parts[3]} · Episode ${parts[2] ?? parts[4]}` };
    }

    function describe() {
        const video = playerVideo();
        if (!video) return null;
        const source = video.currentSrc || video.src;
        if (remembered.source !== source) remembered = { source, subtitle: "" };
        const subtitle = textOf(".atvwebplayersdk-episode-info") || textOf(".atvwebplayersdk-subtitle-text");
        if (subtitle) remembered.subtitle = subtitle;

        const heroImage = document.querySelector(".DVWebNode-detail-atf-wrapper picture img");
        const title = textOf(".atvwebplayersdk-title-text")
            || clean(heroImage?.alt)
            || textOf('h1[data-automation-id="title"]')
            || clean(document.title).replace(/^Watch\s+/i, "").replace(/(\s*-\s*Season\s*\d+)?\s*\|\s*Prime Video$/i, "");
        if (!title) return null;
        const { details, state } = episode(remembered.subtitle === title ? "" : remembered.subtitle);
        const length = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        return {
            site: "primevideo",
            name: title,
            details,
            state,
            // The video's own clock, which also counts Prime's opening jingle and any ads.
            position: length ? { current: video.currentTime, duration: length } : undefined,
            live: video.duration === Infinity,
            // Prime's artwork is wide, so a poster is looked up by title, with the page's art as a fallback.
            posterLookup: { title, kind: state ? "show" : "movie" },
            fallbackImage: /^https:\/\//.test(heroImage?.src ?? "") ? heroImage.src : PRIME_LOGO,
            buttons: [{ label: "Watch on Prime Video", url: location.href.replace(/[?#].*$/, "").replace(/\/ref=.*$/, "") }]
        };
    }

    // Any other page reports nothing, so a trailer playing on a title's page doesn't count.
    function report() {
        try {
            chrome.runtime.sendMessage({ type: "page", page: describe() ?? {} });
        } catch {
            clearInterval(timer);
        }
    }

    const timer = setInterval(report, 2000);
    report();
})();
