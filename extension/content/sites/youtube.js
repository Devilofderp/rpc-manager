// YouTube (youtube.com): describes the video on a watch page.
// Watching <channel> / <video title>, with the channel's picture. The background only
// shows it while the video plays, and holds still while an ad runs.
// Each content script gets its own scope: they share one global space per page.
(() => {
    const clean = text => (text ?? "").replace(/\s+/g, " ").trim();

    // The channel's profile picture from the box beside the video, asked for at 240px
    // (the page loads it at 48px: ".../...=s48-c-k-c0x00ffffff-no-rj"). Until it has
    // loaded, the widescreen thumbnail stands in (no black bars, unlike hqdefault).
    function channelPicture() {
        const src = document.querySelector("#owner ytd-video-owner-renderer #avatar img, ytd-video-owner-renderer #avatar img")?.src ?? "";
        return /^https:\/\/yt\d\.(ggpht|googleusercontent)\.com\//.test(src) ? src.replace(/=s\d+(-|$)/, "=s240$1") : null;
    }

    function describe() {
        if (location.pathname !== "/watch") return null;
        const id = new URLSearchParams(location.search).get("v");
        if (!id) return null;
        const session = navigator.mediaSession?.metadata;
        const title = clean(document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent)
            || clean(session?.title)
            || clean(document.title).replace(/^\(\d+\+?\)\s*/, "").replace(/\s*-\s*YouTube$/, "");
        if (!title) return null;
        const channelLink = document.querySelector("ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a");
        const channelUrl = channelLink?.href;
        // Watching <channel> / <video title>; until the channel's name has loaded, the title leads.
        const channel = clean(channelLink?.textContent) || clean(session?.artist);
        return {
            site: "youtube",
            name: channel || title,
            details: channel ? title : undefined,
            largeImage: channelPicture() ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
            buttons: [
                { label: "Watch on YouTube", url: `https://www.youtube.com/watch?v=${id}` },
                channelUrl && { label: "View Channel", url: channelUrl }
            ].filter(Boolean),
            ad: Boolean(document.querySelector("#movie_player.ad-showing"))
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
