// Keeps Discord showing exactly the active presets, in list order.
//
// Each active preset gets its own RPC connection. Phase 1 showed that the
// newest activity is listed first and wins the member-list line, so presets are
// sent bottom to top: the top preset is always sent last.
import { EventEmitter } from "node:events";
import { RpcClient } from "./discord-ipc.js";
import { appIdOf, blockingErrors, buildActivity, BUILT_IN_APP_ID, sanitizeBrowserActivity, validate } from "../shared/activity.js";

const RETRY_MS = 5000;
// Discord allows about 5 activity updates per 20 seconds per Application, and
// holds back its reply when that's exceeded, so we pace ourselves to match.
const RATE = { count: 5, windowMs: 20_000 };

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// RPC_MANAGER_DEBUG=1 logs every change sent to Discord, with the time.
const debugLog = message => process.env.RPC_MANAGER_DEBUG && console.log(`${new Date().toISOString().slice(11, 23)} ${message}`);

function friendlyError(err) {
    const message = err?.message ?? String(err);
    if (/Invalid Client ID|4000.*client/i.test(message)) return "Discord doesn't recognize this Application ID.";
    if (/pipe closed|ENOENT|ECONNRESET/i.test(message)) return "Lost the connection to Discord.";
    return message.replace(/^\d+: /, "");
}

export class Presence extends EventEmitter {
    status = { state: "connecting", user: null };
    live = {};              // preset id -> { state: "live" | "sending" | "waiting" | "error", error? }
    clients = new Map();    // preset id -> { client, appId, sentKey }
    sends = new Map();      // appId -> recent send times, for the rate limit
    applied = [];           // preset ids as Discord lists them, top first
    timing = new Map();     // preset id -> { activatedAt, loopStart }
    failed = new Map();     // preset id -> appId that Discord refused to connect
    presets = [];
    siteActivities = {};    // site -> what the browser extension says is playing there
    queue = Promise.resolve();
    queued = false;

    start(presets) {
        this.presets = presets;
        this.connectStatus();
    }

    // Edits arrive while typing; wait for a pause so Discord's rate limit goes to the final text.
    // Turning something off takes effect at once, even if updates are queued.
    update(presets) {
        this.presets = presets;
        for (const [id, entry] of [...this.clients]) {
            const preset = presets.find(p => p.id === id);
            if (!preset?.active || appIdOf(preset) !== entry.appId) this.drop(id);
        }
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => this.schedule(), 500);
    }

    setSiteActivities(activities) {
        const next = {};
        for (const [site, activity] of Object.entries(activities ?? {})) {
            const clean = sanitizeBrowserActivity(activity);
            if (clean) next[site] = clean;
        }
        if (JSON.stringify(next) === JSON.stringify(this.siteActivities)) return;
        for (const site of new Set([...Object.keys(next), ...Object.keys(this.siteActivities)]))
            if (Boolean(next[site]) !== Boolean(this.siteActivities[site])) debugLog(`browser: ${site} ${next[site] ? "started" : "stopped"}`);
        // Paused, stopped or tab closed: drop it right away instead of waiting in
        // line behind other updates (closing the connection isn't rate limited).
        for (const preset of this.presets)
            if (preset.kind === "site" && this.siteActivities[preset.site] && !next[preset.site]) this.drop(preset.id, { state: "idle" });
        this.siteActivities = next;
        this.schedule();
    }

    // Closing the connection clears the activity on Discord, and isn't rate limited.
    drop(id, live) {
        const entry = this.clients.get(id);
        if (!entry) return;
        debugLog(`drop ${id}`);
        entry.client.close();
        this.clients.delete(id);
        this.applied = this.applied.filter(appliedId => appliedId !== id);
        if (live) this.live[id] = live;
        else delete this.live[id];
        this.emitChange();
    }

    activityFor(preset, now) {
        if (preset.kind !== "site") return buildActivity(preset, this.timing.get(preset.id), now);
        // The show or video title is the activity name, so the member list reads "Watching <title>".
        return { ...this.siteActivities[preset.site] };
    }

    snapshot() {
        return { status: this.status, live: this.live };
    }

    emitChange() {
        this.emit("change", this.snapshot());
    }

    setLive(id, state, error) {
        this.live[id] = error ? { state, error } : { state };
        this.emitChange();
    }

    // One status connection tells us whether Discord is running and who is logged in.
    async connectStatus() {
        clearTimeout(this.retryTimer);
        const appId = BUILT_IN_APP_ID;
        for (let pipe = 0; pipe < 10; pipe++) {
            const client = new RpcClient(appId);
            try {
                const { user } = await client.connect(pipe);
                this.pipe = pipe;
                this.statusClient = client;
                client.onClose = () => this.lost();
                this.status = { state: "connected", user };
                this.emitChange();
                this.schedule();
                return;
            } catch {
                client.close();
            }
        }
        this.status = { state: "offline", user: null };
        this.markWaiting();
        this.retryTimer = setTimeout(() => this.connectStatus(), RETRY_MS);
    }

    lost() {
        for (const { client } of this.clients.values()) client.close();
        this.clients.clear();
        this.applied = [];
        this.status = { state: "offline", user: null };
        this.markWaiting();
        this.retryTimer = setTimeout(() => this.connectStatus(), RETRY_MS);
    }

    markWaiting() {
        this.live = {};
        for (const preset of this.presets) if (preset.active) this.live[preset.id] = { state: "waiting" };
        this.emitChange();
    }

    schedule() {
        if (this.queued) return;
        this.queued = true;
        this.queue = this.queue.then(() => {
            this.queued = false;
            return this.sync();
        }).catch(err => console.error("sync failed", err));
    }

    // Keeps per-preset timer state and wakes up for progress-bar loops and midnight.
    updateTiming(desired, now) {
        for (const id of this.timing.keys()) if (!desired.some(p => p.id === id)) this.timing.delete(id);
        let nextWake = Infinity;
        for (const preset of desired) {
            const timing = this.timing.get(preset.id) ?? { activatedAt: now, loopStart: now };
            if (preset.timer === "progress") {
                const length = preset.progressSeconds * 1000;
                if (now >= timing.loopStart + length) timing.loopStart = now;
                nextWake = Math.min(nextWake, timing.loopStart + length);
            }
            if (preset.timer === "midnight") {
                const midnight = new Date(now);
                midnight.setHours(24, 0, 0, 0);
                nextWake = Math.min(nextWake, midnight.getTime());
            }
            this.timing.set(preset.id, timing);
        }
        clearTimeout(this.wakeTimer);
        if (nextWake !== Infinity) this.wakeTimer = setTimeout(() => this.schedule(), Math.max(nextWake - now, 0) + 250);
    }

    async sync() {
        const activePresets = this.presets.filter(p => p.active);
        const desired = [];
        for (const preset of activePresets) {
            if (blockingErrors(validate(preset)).length) this.live[preset.id] = { state: "error", error: "Fix the highlighted fields to go live." };
            else if (this.failed.get(preset.id) === appIdOf(preset)) continue;
            else if (preset.kind === "site" && !this.siteActivities[preset.site]) this.live[preset.id] = { state: "idle" };
            else desired.push(preset);
        }
        for (const id of Object.keys(this.live)) if (!activePresets.some(p => p.id === id)) delete this.live[id];

        // Turned off, deleted, or moved to another Application: drop the old connection.
        for (const [id, entry] of this.clients) {
            const preset = desired.find(p => p.id === id);
            if (preset && appIdOf(preset) === entry.appId) continue;
            debugLog(`close ${id}`);
            entry.client.close();
            this.clients.delete(id);
            this.applied = this.applied.filter(appliedId => appliedId !== id);
        }
        for (const id of this.failed.keys()) if (!activePresets.some(p => p.id === id)) this.failed.delete(id);

        if (this.status.state !== "connected") return this.markWaiting();

        const now = Date.now();
        this.updateTiming(desired.filter(p => p.kind !== "site"), now);

        const desiredIds = desired.map(p => p.id);
        const kept = this.applied.filter(id => desiredIds.includes(id));
        const reorder = desiredIds.filter(id => kept.includes(id)).join() !== kept.join();

        // Walk bottom to top. A newly created activity jumps to the top, so
        // everything above it is re-created to restore the order. A plain
        // update may also bump it, so presets above an edited one are re-sent.
        let bumpAbove = reorder;
        let refreshAbove = false;
        const applied = [];
        for (const preset of [...desired].reverse()) {
            const activity = this.activityFor(preset, now);
            const key = JSON.stringify(activity);
            const entry = this.clients.get(preset.id);
            let action = null;
            if (!entry) action = "create";
            else if (bumpAbove) action = "bump";
            else if (entry.sentKey !== key) action = "update";
            else if (refreshAbove) action = "update";

            const ok = action ? await this.send(preset, action) : true;
            if (!ok) continue;
            applied.unshift(preset.id);
            if (action === "create") bumpAbove = true;
            if (action === "update") refreshAbove = true;
        }
        this.applied = applied;
        this.emitChange();
    }

    // The activity is built at the moment it goes out, so time spent waiting on
    // the rate limit never sends something that has changed since.
    async send(preset, action) {
        let entry = this.clients.get(preset.id);
        try {
            this.setLive(preset.id, "sending");
            if (!entry) {
                const client = new RpcClient(appIdOf(preset));
                await client.connect(this.pipe).catch(err => {
                    // Discord refused this Application; don't retry until the ID changes.
                    if (/Discord closed the connection/.test(err.message)) this.failed.set(preset.id, appIdOf(preset));
                    client.close();
                    throw err;
                });
                entry = { client, appId: appIdOf(preset), sentKey: null };
                client.onClose = () => {
                    if (this.clients.get(preset.id) !== entry) return;
                    this.clients.delete(preset.id);
                    this.applied = this.applied.filter(id => id !== preset.id);
                    this.schedule();
                };
                this.clients.set(preset.id, entry);
            }
            if (action === "bump") {
                await this.throttle(entry, preset.id);
                await entry.client.setActivity(null);
            }
            await this.throttle(entry, preset.id);
            // Turned off or paused while waiting.
            if (this.clients.get(preset.id) !== entry) return false;
            if (preset.kind === "site" && !this.siteActivities[preset.site]) return false;
            const activity = this.activityFor(preset, Date.now());
            debugLog(`send ${preset.label} (${action}): ${JSON.stringify(activity)}`);
            // Discord also limits how often your whole status can change and holds its reply
            // until it applies the update; say so when that happens.
            const slow = setTimeout(() => {
                if (this.clients.get(preset.id) !== entry) return;
                this.live[preset.id] = { state: "sending", limited: true };
                this.emitChange();
            }, 2000);
            await entry.client.setActivity(activity).finally(() => clearTimeout(slow));
            if (this.clients.get(preset.id) !== entry) return false;
            entry.sentKey = JSON.stringify(activity);
            this.setLive(preset.id, "live");
            return true;
        } catch (err) {
            // Dropped while waiting (e.g. the video was paused): not an error.
            if (entry && this.clients.get(preset.id) !== entry) return false;
            if (entry) entry.sentKey = null;
            this.setLive(preset.id, "error", friendlyError(err));
            return false;
        }
    }

    async throttle(entry, id) {
        const now = Date.now();
        const sends = (this.sends.get(entry.appId) ?? []).filter(t => now - t < RATE.windowMs);
        this.sends.set(entry.appId, sends);
        if (sends.length >= RATE.count) {
            this.live[id] = { state: "sending", limited: true };
            this.emitChange();
            await wait(sends[0] + RATE.windowMs - now);
        }
        sends.push(Date.now());
    }

    stop() {
        clearTimeout(this.retryTimer);
        clearTimeout(this.wakeTimer);
        clearTimeout(this.updateTimer);
        for (const { client } of this.clients.values()) client.close();
        this.statusClient?.close();
    }
}
