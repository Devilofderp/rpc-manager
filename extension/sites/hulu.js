// Hulu (hulu.com): describes what's on screen in the web player.
// Watching <show or movie> / <episode name> / Season 1 · Episode 3. Hulu stitches its
// ads into the video stream, so the position comes from Hulu's own timeline, not the
// video element. The page selectors follow PreMiD's open-source Hulu activity (MPL-2.0).
// Each content script gets its own scope: they share one global space per page.
(() => {
    const LOGO = "https://www.hulu.com/static/icons/apple-touch-icon.png";
    const clean = text => (text ?? "").replace(/\s+/g, " ").trim();
    const text = selector => clean(document.querySelector(selector)?.textContent);

    // "1:02:03" -> 3723
    const seconds = time => time.split(":").map(Number).reverse().reduce((total, value, i) => total + value * 60 ** i, 0);

    // Hulu's own artwork for what's playing, if the page has any: the media session first
    // (its links can be relative or start with //), then the page's share image unless
    // it's Hulu's generic one.
    function artwork() {
        // An empty value would resolve to this page's own address, which isn't a picture.
        const absolute = src => {
            if (!src?.trim()) return null;
            try {
                const url = new URL(src, location.href);
                if (url.protocol !== "https:" || url.href.split("#")[0] === location.href.split("#")[0]) return null;
                return url.href;
            } catch {
                return null;
            }
        };
        const session = (navigator.mediaSession?.metadata?.artwork ?? [])
            .map(a => ({ src: absolute(a.src), size: parseInt(a.sizes) || 0 }))
            .filter(a => a.src)
            .sort((a, b) => b.size - a.size);
        if (session[0]) return session[0].src;
        const share = absolute(document.querySelector('meta[property="og:image"]')?.content ?? "");
        return share && !/default/i.test(share) ? share : null;
    }

    function describe() {
        if (!location.pathname.startsWith("/watch")) return null;
        if (!document.querySelector("video#content-video-player")) return null;
        const title = text("#web-player-app div.PlayerMetadata__titleText");
        if (!title) return null;

        // Episodes read like "S1 E3 - Episode Name • 22 min"; movies have no season and episode.
        const subtitle = text("#web-player-app div.PlayerMetadata__subTitle");
        const episode = subtitle.match(/^S(\d+)\s*E(\d+)\s*[-–]\s*(.*)$/i);
        const live = Boolean(document.querySelector('.BottomUiControls__playbackControls div[aria-label*="LIVE"]'));

        const current = text(".Timeline__currentTimestamp");
        const duration = Number(document.querySelector('.Timeline__slider[role="slider"]')?.getAttribute("aria-valuemax"));
        const art = artwork();
        return {
            site: "hulu",
            name: title,
            details: episode ? clean(episode[3].replace(/\s*[•|].*$/, "")) : undefined,
            state: episode ? `Season ${episode[1]} · Episode ${episode[2]}` : live ? "Live" : undefined,
            largeImage: art ?? LOGO,
            // No artwork on the page: the background looks a poster up by title (not for live channels).
            posterLookup: !art && !live ? { title, kind: episode ? "show" : "movie" } : undefined,
            fallbackImage: LOGO,
            buttons: [{ label: "Watch on Hulu", url: location.href }],
            live,
            // Hulu's own clock for the show itself, without the ads.
            position: !live && current && duration > 0 ? { current: seconds(current), duration } : undefined
        };
    }

    function report() {
        const page = describe();
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
