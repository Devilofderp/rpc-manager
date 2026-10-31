// Public Discord endpoints for an Application's name, icon and uploaded art assets.
// Used by the preview so it can show the real app name and resolve asset keys.
const cache = new Map();

async function getJson(url) {
    const res = await fetch(url, { headers: { "User-Agent": "RPC Manager" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export function appInfo(appId) {
    if (!/^\d{17,20}$/.test(appId)) return Promise.resolve(null);
    if (!cache.has(appId)) {
        const request = Promise.all([
            getJson(`https://discord.com/api/v10/applications/${appId}/rpc`),
            getJson(`https://discord.com/api/v10/oauth2/applications/${appId}/assets`).catch(() => [])
        ]).then(([app, assets]) => ({
            name: app.name,
            icon: app.icon ? `https://cdn.discordapp.com/app-icons/${appId}/${app.icon}.png?size=128` : null,
            assets: Object.fromEntries(assets.map(a => [a.name, `https://cdn.discordapp.com/app-assets/${appId}/${a.id}.png`]))
        })).catch(() => {
            cache.delete(appId);
            return null;
        });
        cache.set(appId, request);
    }
    return cache.get(appId);
}
