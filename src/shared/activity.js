// Shared by the main process (sending to Discord) and the window (preview + validation).

export const TYPES = [
    { value: 0, label: "Playing", verb: "Playing" },
    { value: 2, label: "Listening", verb: "Listening to" },
    { value: 3, label: "Watching", verb: "Watching" },
    { value: 5, label: "Competing", verb: "Competing in" }
];

const STATUS_DISPLAY = { name: 0, state: 1, details: 2 };

export const TIMERS = [
    { value: "none", label: "None" },
    { value: "activated", label: "Since turned on" },
    { value: "midnight", label: "Time of day" },
    { value: "progress", label: "Progress bar" }
];

export const verbFor = type => TYPES.find(t => t.value === type)?.verb ?? "Playing";

// RPC Manager's own Discord Application. Discord only accepts activities from a real
// Application, so presets without an App ID of their own use this one. Every activity
// carries its own name, so this app's name never shows.
export const BUILT_IN_APP_ID = "1564851018020425748";

export const appIdOf = preset => preset.appId.trim() || BUILT_IN_APP_ID;

export function newPreset(fields = {}) {
    return {
        id: crypto.randomUUID(),
        kind: "preset",
        label: "New preset",
        active: false,
        appId: "",
        type: 0,
        name: "",
        details: "",
        detailsUrl: "",
        state: "",
        stateUrl: "",
        statusDisplay: "name",
        largeImage: "",
        largeText: "",
        largeUrl: "",
        smallImage: "",
        smallText: "",
        smallUrl: "",
        buttons: [{ label: "", url: "" }, { label: "", url: "" }],
        timer: "none",
        progressSeconds: 1440,
        partySize: 0,
        partyMax: 0,
        ...fields
    };
}

// A site the browser extension reads (see sites.js). Its content comes from the
// site; the preset only decides whether it shows and where in the order.
export const newSitePreset = (site, label, fields = {}) => newPreset({
    id: `site:${site}`,
    kind: "site",
    site,
    label,
    active: true,
    appId: "",
    ...fields
});

const isUrl = value => /^https?:\/\/\S+$/i.test(value);

// Activities from the extension are cleaned to what Discord accepts, so a
// long title gets shortened instead of the whole update being rejected.
export function sanitizeBrowserActivity(raw) {
    if (!raw || typeof raw !== "object") return null;
    const text = (value, max = 128) => {
        if (typeof value !== "string") return undefined;
        const clean = value.replace(/\s+/g, " ").trim();
        if (clean.length < 2) return undefined;
        return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
    };
    const link = value => typeof value === "string" && isUrl(value) && value.length <= 512 ? value : undefined;
    const time = value => Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;

    const activity = {
        type: [0, 2, 3, 5].includes(raw.type) ? raw.type : 3,
        name: text(raw.name),
        details: text(raw.details),
        state: text(raw.state)
    };
    if (activity.details) activity.details_url = link(raw.details_url);
    if (activity.state) activity.state_url = link(raw.state_url);

    const assets = {};
    for (const size of ["large", "small"]) {
        const image = link(raw.assets?.[`${size}_image`]);
        if (!image) continue;
        assets[`${size}_image`] = image;
        assets[`${size}_text`] = text(raw.assets[`${size}_text`]);
        assets[`${size}_url`] = link(raw.assets[`${size}_url`]);
    }
    if (Object.keys(assets).length) activity.assets = assets;

    const buttons = (Array.isArray(raw.buttons) ? raw.buttons : [])
        .map(b => ({ label: typeof b?.label === "string" ? b.label.trim().slice(0, 31) : "", url: link(b?.url) }))
        .filter(b => b.label && b.url)
        .slice(0, 2);
    if (buttons.length) activity.buttons = buttons;

    const start = time(raw.timestamps?.start);
    const end = time(raw.timestamps?.end);
    if (start) activity.timestamps = end > start ? { start, end } : { start };

    return JSON.parse(JSON.stringify(activity));
}

// Returns { field: message } for every problem Discord would reject.
export function validate(preset) {
    const errors = {};
    const text = (field, { min = 2, max = 128 } = {}) => {
        const value = preset[field].trim();
        if (!value) return;
        if (value.length < min) errors[field] = `Needs at least ${min} characters.`;
        else if (value.length > max) errors[field] = `Can't be longer than ${max} characters.`;
    };
    const url = field => {
        const value = preset[field].trim();
        if (value && !isUrl(value)) errors[field] = "Must be a link starting with https://";
    };

    // The App ID is optional: empty means the built-in app.
    const ownApp = preset.appId.trim();
    if (ownApp && !/^\d{17,20}$/.test(ownApp)) errors.appId = "An Application ID is a long number. Leave it empty to use the built-in one.";
    // With the built-in app there's no name of yours to fall back on.
    if (preset.kind === "preset" && !ownApp && !preset.name.trim())
        errors.name = "Type the name to show after \"Playing\" or \"Watching\".";
    text("name", { min: 1 });
    text("details");
    text("state");
    text("largeText");
    text("smallText");
    ["detailsUrl", "stateUrl", "largeUrl", "smallUrl"].forEach(url);
    if (preset.detailsUrl.trim() && !preset.details.trim()) errors.detailsUrl = "Needs a Details line to attach to.";
    if (preset.stateUrl.trim() && !preset.state.trim()) errors.stateUrl = "Needs a State line to attach to.";
    // A site preset's lines come from the site, so only its Application ID is checked.
    if (preset.kind === "site") return errors;
    if (preset.statusDisplay === "details" && !preset.details.trim()) errors.statusDisplay = "Details is empty, so the member list falls back to the name.";
    if (preset.statusDisplay === "state" && !preset.state.trim()) errors.statusDisplay = "State is empty, so the member list falls back to the name.";

    preset.buttons.forEach((button, i) => {
        const label = button.label.trim();
        const link = button.url.trim();
        if (!label && !link) return;
        if (!label) errors[`button${i}Label`] = "Needs a label.";
        else if (label.length > 31) errors[`button${i}Label`] = "Can't be longer than 31 characters.";
        if (!link) errors[`button${i}Url`] = "Needs a link.";
        else if (!isUrl(link)) errors[`button${i}Url`] = "Must be a link starting with https://";
    });

    if (preset.timer === "progress" && !(preset.progressSeconds > 0)) errors.progressSeconds = "Set a length.";
    if (preset.type === 0 && (preset.partySize || preset.partyMax) && !(preset.partySize > 0 && preset.partyMax >= preset.partySize))
        errors.party = "Party size must be between 1 and the maximum.";

    // statusDisplay messages are only hints; Discord still accepts the activity.
    return errors;
}

export const blockingErrors = errors => Object.keys(errors).filter(key => key !== "statusDisplay");

function startOfToday(now) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

// timing: { activatedAt, loopStart } for this preset, now: current time in ms.
export function timestampsFor(preset, timing, now) {
    switch (preset.timer) {
        case "activated": return { start: timing.activatedAt };
        case "midnight": return { start: startOfToday(now) };
        case "progress": return { start: timing.loopStart, end: timing.loopStart + preset.progressSeconds * 1000 };
        default: return undefined;
    }
}

// Builds the activity object sent with SET_ACTIVITY.
export function buildActivity(preset, timing, now = Date.now()) {
    const activity = { type: preset.type };
    const set = (key, value) => {
        const trimmed = typeof value === "string" ? value.trim() : value;
        if (trimmed) activity[key] = trimmed;
    };

    set("name", preset.name);
    set("details", preset.details);
    set("state", preset.state);
    if (activity.details) set("details_url", preset.detailsUrl);
    if (activity.state) set("state_url", preset.stateUrl);
    // An empty line can't be the summary, so leave Discord on the name.
    if (preset.statusDisplay !== "name" && activity[preset.statusDisplay])
        activity.status_display_type = STATUS_DISPLAY[preset.statusDisplay];

    const assets = {};
    for (const size of ["large", "small"]) {
        const image = preset[`${size}Image`].trim();
        if (!image) continue;
        assets[`${size}_image`] = image;
        if (preset[`${size}Text`].trim()) assets[`${size}_text`] = preset[`${size}Text`].trim();
        if (preset[`${size}Url`].trim()) assets[`${size}_url`] = preset[`${size}Url`].trim();
    }
    if (Object.keys(assets).length) activity.assets = assets;

    const buttons = preset.buttons
        .map(b => ({ label: b.label.trim(), url: b.url.trim() }))
        .filter(b => b.label && b.url);
    if (buttons.length) activity.buttons = buttons;

    const timestamps = timestampsFor(preset, timing, now);
    if (timestamps) activity.timestamps = timestamps;

    if (preset.type === 0 && preset.partySize > 0 && preset.partyMax >= preset.partySize)
        activity.party = { size: [preset.partySize, preset.partyMax] };

    return activity;
}
