// Twitch (twitch.tv): describes a live stream or a past broadcast you've opened.
// Watching <streamer> / <stream title> / <category>, with their picture. The background only
// shows it while the video plays, and holds still while an ad runs.
// Each content script gets its own scope: they share one global space per page.
(() => {
    const FALLBACK_PICTURE = "https://static-cdn.jtvnw.net/ttv-static-metadata/twitch_logo3.jpg";

    const clean = text => (text ?? "").replace(/\s+/g, " ").trim();
    const textOf = (root, selector) => clean(root.querySelector(selector)?.textContent);
    const meta = property => document.querySelector(`meta[property="${property}"]`)?.content ?? "";

    // The small picture beside the stream, asked for at 300px.
    function picture(box, login) {
        const src = box.querySelector(`a[href="/${login}" i] img`)?.src ?? "";
        return /^https:\/\/static-cdn\.jtvnw\.net\//.test(src) ? src.replace(/-\d+x\d+(\.\w+)$/, "-300x300$1") : FALLBACK_PICTURE;
    }

    function liveStream(login) {
        const box = document.querySelector("#live-channel-stream-information");
        const name = box && textOf(box, `a[href="/${login}" i] h1`);
        // An offline channel's page plays an old broadcast, so the stream has to say it's live.
        if (name && box.querySelector('.live-time, [data-a-target="animated-channel-viewers-count"]')) {
            return {
                name,
                details: textOf(box, '[data-a-target="stream-title"]') || undefined,
                state: textOf(box, '[data-a-target="stream-game-link"]') || undefined,
                largeImage: picture(box, login)
            };
        }
        // The bar can fill in late on a fresh page load. The page's tags describe the stream until
        // then, but only for the channel it was loaded on: Twitch doesn't update them as you browse.
        if (meta("og:profile:username").toLowerCase() === login && meta("og:title").endsWith(" - Live on Twitch")) {
            return {
                name: meta("og:title").replace(/ - Live on Twitch$/, ""),
                // "<stream title> | Streaming <category> for <number> viewers.", and sometimes less.
                details: clean(meta("og:description")).replace(/\s*\|\s*Streaming [^|]*$/, "") || undefined,
                largeImage: meta("og:image") || FALLBACK_PICTURE
            };
        }
        return null;
    }

    function pastBroadcast(id) {
        const box = document.querySelector("#live-channel-stream-information");
        const channelUrl = box?.querySelector("h1")?.closest("a")?.href;
        const login = channelUrl && new URL(channelUrl).pathname.slice(1);
        const title = clean(document.title).replace(/\s*-\s*Twitch$/, "");
        if (!login || !title) return null;
        return {
            name: textOf(box, "h1"),
            details: title,
            state: textOf(box, '[data-a-target="video-info-game-boxart-link"]') || undefined,
            largeImage: picture(box, login),
            buttons: [
                { label: "Watch on Twitch", url: `https://www.twitch.tv/videos/${id}` },
                { label: "View Channel", url: channelUrl }
            ]
        };
    }

    function describe() {
        const [first, second, ...rest] = location.pathname.split("/").filter(Boolean);
        const ad = Boolean(document.querySelector('[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"]'));
        if (first === "videos" && /^\d+$/.test(second ?? "") && !rest.length) {
            const page = pastBroadcast(second);
            return page && { site: "twitch", ad, ...page };
        }
        if (!/^\w+$/.test(first ?? "") || second) return null;
        const login = first.toLowerCase();
        const page = liveStream(login);
        return page && { site: "twitch", live: true, ad, buttons: [{ label: "Watch on Twitch", url: `https://www.twitch.tv/${login}` }], ...page };
    }

    // Any other page reports nothing, so the stream that autoplays on the home page doesn't count.
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
