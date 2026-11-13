// Disney+ (disneyplus.com): describes what's playing in the player.
// Watching <show or movie> / <episode name> / Season 1 · Episode 3. disneyplus-player.js reads
// the player from the page's own world and passes it here. The position is the player's own
// clock for the show itself, so ads don't throw it off.
// Each content script gets its own scope: they share one global space per page.
(() => {
    const LOGO = "https://static-assets.bamgrid.com/product/disneyplus/favicons/disPlus-favicon-180x180.7d56f648dc95f591721935193bc827cb.png";
    const POSTER_RATIO = 0.71;
    const clean = text => (text ?? "").replace(/\s+/g, " ").trim();

    let latest = null;      // what the player last said, and when
    window.addEventListener("message", event => {
        if (event.source !== window || event.data?.type !== "rpc-manager-disneyplus") return;
        latest = { ...event.data, at: Date.now() };
    });

    // The artwork closest to a poster's shape.
    function artwork(tiles) {
        const ratios = Object.keys(tiles ?? {}).filter(ratio => tiles[ratio]);
        if (!ratios.length) return null;
        const best = ratios.reduce((a, b) => Math.abs(b - POSTER_RATIO) < Math.abs(a - POSTER_RATIO) ? b : a);
        return `https://disney.images.edge.bamgrid.com/ripcut-delivery/v2/variant/disney/${encodeURIComponent(tiles[best])}/compose?format=png&width=512`;
    }

    function describe() {
        if (!/\/(play|video)\//.test(location.pathname)) return null;
        // Nothing heard from the player lately: it closed.
        if (!latest || Date.now() - latest.at > 5000) return null;
        const title = clean(latest.title);
        if (!title) return null;

        // Episodes read like "S1:E3 Episode Name"; movies have no season and episode.
        const subtitle = clean(latest.subtitle);
        const episode = subtitle.match(/^S(\d+):\s*E(\d+)\s*(.*)$/i);
        const duration = latest.durationMs / 1000;
        return {
            site: "disneyplus",
            name: title,
            details: episode ? episode[3] || undefined : subtitle || undefined,
            state: episode ? `Season ${episode[1]} · Episode ${episode[2]}` : undefined,
            largeImage: artwork(latest.tiles) ?? LOGO,
            buttons: [{ label: "Watch on Disney+", url: location.href.replace(/[?#].*$/, "") }],
            position: duration > 0 && latest.positionMs >= 0 ? { current: latest.positionMs / 1000, duration } : undefined
        };
    }

    // Any other page reports nothing.
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
