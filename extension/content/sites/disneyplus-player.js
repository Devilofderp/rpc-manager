// Disney+ (disneyplus.com): runs in the page's own world, because the player keeps what's
// playing on its <disney-web-player> element, which the extension's own scripts can't see.
// Hands that to disneyplus.js through a window message. Follows PreMiD's open-source
// Disney+ activity (MPL-2.0).
(() => {
    if (window.rpcManagerDisneyPlus) return;
    window.rpcManagerDisneyPlus = true;

    setInterval(() => {
        const player = document.querySelector("disney-web-player")?.mediaPlayer;
        const metadata = player?.mediaPlaybackCriteria?.metadata;
        if (!metadata) return;
        const tiles = metadata.images_experience?.standard?.tile ?? {};
        const timeline = player.timeline?.info;
        window.postMessage({
            type: "rpc-manager-disneyplus",
            title: metadata.title?.text,
            subtitle: metadata.subtitle?.text,
            // Aspect ratio -> image id, for the artwork.
            tiles: Object.fromEntries(Object.entries(tiles).map(([ratio, image]) => [ratio, image?.imageId])),
            positionMs: timeline?.playheadPositionMs,
            durationMs: timeline?.programDurationMs
        }, location.origin);
    }, 1000);
})();
