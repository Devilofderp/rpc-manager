// Looks things up on the web once, and refreshes the activities when the answer arrives.
import { update } from "./activities.js";

const lookups = new Map(); // key -> { started, done, value }

export function lookup(key, load) {
    let entry = lookups.get(key);
    if (!entry) {
        entry = { started: Date.now(), done: false, value: null };
        lookups.set(key, entry);
        load()
            .then(value => { entry.value = value; })
            .catch(() => setTimeout(() => lookups.delete(key), 60_000)) // try again later
            .finally(() => {
                entry.done = true;
                update();
            });
    }
    return entry;
}

export async function getJson(url, options = {}) {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
    return res.json();
}
