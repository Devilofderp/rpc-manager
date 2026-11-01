// Runs in every frame (players are often embedded from another site) and reports
// the main video or audio element: position, length, and whether it's playing.
// Each content script gets its own scope: they share one global space per page.
(() => {
    let found = null;           // last media element we reported
    let lastDeepScan = 0;
    let startedAt = 0;          // when the current stretch of playback began

    function deepFind(root, out) {
        for (const el of root.querySelectorAll("*")) {
            if (!el.shadowRoot) continue;
            out.push(...el.shadowRoot.querySelectorAll("video, audio"));
            deepFind(el.shadowRoot, out);
        }
        return out;
    }

    // Calls and webcams are live camera streams, not something you're watching. Twitch's
    // player feeds its video from a worker, which also comes through srcObject.
    const usable = media => media.srcObject ? !(media.srcObject instanceof MediaStream) : media.currentSrc || media.src;

    const lengthOf = media => Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0;

    function mainMedia() {
        let media = [...document.querySelectorAll("video, audio")].filter(usable);
        // Some players hide the video inside shadow DOM; that scan is costly, so do it rarely.
        if (!media.length && Date.now() - lastDeepScan > 15000) {
            lastDeepScan = Date.now();
            media = deepFind(document, []).filter(usable);
        }
        if (!media.length) return found?.isConnected && usable(found) ? found : null;
        // Prefer what's playing, then the longest: short clips are previews or ads.
        media.sort((a, b) => (b.paused ? 0 : 1) - (a.paused ? 0 : 1) || lengthOf(b) - lengthOf(a));
        return media[0];
    }

    function send(message) {
        lastReport = Date.now();
        try {
            chrome.runtime.sendMessage({ type: "player", ...message });
        } catch {
            // The extension was reloaded; this copy of the script is orphaned.
            clearInterval(timer);
        }
    }

    let lastReport = 0;
    function report() {
        const media = mainMedia();
        if (!media) {
            // The video went away (you navigated elsewhere): say so once, right away.
            if (found) send({ playing: false, duration: 0 });
            found = null;
            startedAt = 0;
            return;
        }
        found = media;
        // A short buffering stall mid-video still counts as watching; not having started yet doesn't.
        const playing = !media.paused && !media.ended && (media.readyState > 2 || media.currentTime > 0);
        if (playing && !startedAt) startedAt = Date.now();
        if (!playing) startedAt = 0;
        send({
            playing,
            currentTime: media.currentTime,
            duration: lengthOf(media),
            live: media.duration === Infinity,
            muted: media.muted || media.volume === 0,
            kind: media.tagName === "AUDIO" || (media.readyState > 0 && !media.videoWidth) ? "audio" : "video",
            startedAt
        });
    }

    // Pausing and seeking report right away so Discord follows instantly.
    for (const event of ["play", "playing", "pause", "seeked", "ended", "emptied", "loadedmetadata", "durationchange", "volumechange"])
        document.addEventListener(event, report, true);
    document.addEventListener("timeupdate", () => Date.now() - lastReport > 2000 && report(), true);
    // Leaving the page (or the player frame being removed) stops it, so say so before going.
    window.addEventListener("pagehide", () => found && send({ playing: false, duration: 0 }));
    const timer = setInterval(report, 2000);
    report();
})();
