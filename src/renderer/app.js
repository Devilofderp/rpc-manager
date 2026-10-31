import { appIdOf, blockingErrors, newPreset, newSitePreset, timestampsFor, TIMERS, TYPES, validate, verbFor } from "../shared/activity.js";
import { SITES } from "../shared/sites.js";
import { ACCENTS, BACKGROUNDS, CORNERS, DEFAULT_THEME, normalizeTheme, SCALES } from "../shared/theme.js";

const ICONS = {
    app: '<rect x="2.5" y="2.5" width="11" height="11" rx="3"/><path d="M6 8h4M8 6v4"/>',
    text: '<path d="M3 4h10M3 8h10M3 12h6"/>',
    image: '<rect x="2" y="3" width="12" height="10" rx="2"/><circle cx="6" cy="6.5" r="1.2"/><path d="m3 12 3.5-3.5 2.5 2.5 2-2 3 3"/>',
    button: '<rect x="2" y="4.5" width="12" height="7" rx="2.5"/><path d="M6 8h4"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>',
    party: '<circle cx="6" cy="6" r="2.2"/><circle cx="11" cy="6.5" r="1.7"/><path d="M2.5 13c.5-2.2 2-3.4 3.5-3.4s3 1.2 3.5 3.4M10 9.6c1.6 0 2.9 1 3.4 3"/>',
    copy: '<rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 5V4a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 3 4v5.5A1.5 1.5 0 0 0 4.5 11H5"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1.5 1.5 0 0 0 1.5 1.3h2.8a1.5 1.5 0 0 0 1.5-1.3l.6-8.2"/>',
    activity: '<rect x="2.5" y="3.5" width="11" height="9" rx="2"/><path d="m6.5 6.3 3.2 1.7-3.2 1.7z"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.7 1.8 2.5 3.8 2.5 6S9.7 12.2 8 14C6.3 12.2 5.5 10.2 5.5 8S6.3 3.8 8 2z"/>',
    folder: '<path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h2.6l1.5 1.5H12a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5z"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M1.8 8h1.6M12.6 8h1.6M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/><circle cx="8" cy="8" r="4.6"/>'
};

const icon = name => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.innerHTML = ICONS[name];
    return svg;
};

function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null) continue;
        if (key === "class") el.className = value;
        else if (key === "text") el.textContent = value;
        else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key in el && key !== "list") el[key] = value;
        else el.setAttribute(key, value);
    }
    el.append(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
    return el;
}

const isAppId = value => /^\d{17,20}$/.test(value.trim());
const isLink = value => /^https?:\/\//i.test(value.trim());

let presets = [];
let selectedId = null;
let presence = { status: { state: "connecting" }, live: {} };
let bridge = { browsers: 0, outdated: false, activities: {} };
let extensionDir = "";
let minimizeToTray = false;
const apps = new Map();     // appId -> info, null (not found) or "pending"
const timing = new Map();   // preview timer state per preset
let refs = {};              // elements of the current editor that update in place
let timers = [];            // { view, el } for every timer on screen, ticked each second
let dragging = false;       // the list isn't re-rendered mid-drag

const siteName = preset => SITES[preset.site]?.name ?? preset.label;

const selected = () => presets.find(p => p.id === selectedId);

/* Saving */

let saveTimer;
function save(now = false) {
    clearTimeout(saveTimer);
    if (now) window.rpc.setPresets(presets);
    else saveTimer = setTimeout(() => window.rpc.setPresets(presets), 350);
}

/* Discord application info (name, icon, uploaded art) */

function appFor(appId) {
    const id = appId.trim();
    if (!isAppId(id)) return null;
    if (!apps.has(id)) {
        apps.set(id, "pending");
        window.rpc.appInfo(id).then(info => {
            apps.set(id, info);
            renderList();
            if (selected() && appIdOf(selected()) === id) {
                updateAppHint();
                renderPreview();
            }
        });
    }
    const info = apps.get(id);
    return info === "pending" ? null : info;
}

// The built-in app has no name of yours, so only your own app can stand in for an empty name.
const displayName = preset => preset.name.trim() || (preset.appId.trim() && appFor(preset.appId)?.name) || "(type a name)";

function imageFor(preset, size) {
    const value = preset[`${size}Image`].trim();
    if (!value) return null;
    if (isLink(value)) return value;
    return appFor(appIdOf(preset))?.assets?.[value] ?? null;
}

function previewTiming(preset) {
    const now = Date.now();
    let state = timing.get(preset.id);
    if (!state) timing.set(preset.id, state = { activatedAt: now, loopStart: now });
    if (preset.timer === "progress" && now >= state.loopStart + preset.progressSeconds * 1000) state.loopStart = now;
    return state;
}

/* Title bar connection pill */

function avatarUrl(user) {
    if (!user) return null;
    if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
    return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

function connectionText({ state, blocked, modded, via }) {
    if (state === "connected") return `Connected through ${via}`;
    if (state !== "offline") return "Looking for Discord…";
    if (blocked) return "Discord is running as admin: reopen it normally";
    return modded ? `${modded.name} is open: ${modded.fix}` : "Discord isn't running";
}

function renderConnection() {
    const { state, user } = presence.status;
    const el = document.getElementById("connection");
    el.className = `connection ${state}`;
    if (user) {
        el.replaceChildren(
            h("img", { class: "avatar", src: avatarUrl(user), alt: "" }),
            h("span", { text: `Connected as ${user.global_name || user.username}` })
        );
    } else {
        el.replaceChildren(h("span", { class: "dot" }), h("span", { text: connectionText(presence.status) }));
    }
}

/* Theme (Settings) */

let theme = DEFAULT_THEME;
let glassSupported = false;

function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
}

// A color moved toward white by t (0..1), as rgb().
const lighten = (hex, t) => `rgb(${rgb(hex).map(c => Math.round(c + (255 - c) * t)).join(", ")})`;

function applyTheme() {
    const [r, g, b] = rgb(theme.accent);
    const root = document.documentElement.style;
    root.setProperty("--accent", theme.accent);
    root.setProperty("--accent-strong", lighten(theme.accent, 0.3));
    root.setProperty("--accent-soft", `rgba(${r}, ${g}, ${b}, 0.14)`);
    root.setProperty("--accent-line", `rgba(${r}, ${g}, ${b}, 0.38)`);
    root.setProperty("--accent-glow", `rgba(${r}, ${g}, ${b}, 0.35)`);
    root.setProperty("--round", CORNERS.find(c => c.value === theme.corners).factor);
    // See-through 0% = a nearly solid tint over the blur, 100% = no tint, just the blurred desktop.
    root.setProperty("--glass-tint", (0.85 * (1 - theme.glass / 100)).toFixed(3));

    const body = document.body;
    body.classList.toggle("bg-dark", theme.background === "dark");
    body.classList.toggle("bg-glass", theme.background === "glass");
    // Custom: your color, with raised surfaces (menus, the dragged card) a touch lighter.
    for (const [name, value] of Object.entries({
        "--bg": theme.backgroundColor,
        "--ring": theme.backgroundColor,
        "--raised": lighten(theme.backgroundColor, 0.07),
        "--popover": lighten(theme.backgroundColor, 0.045)
    })) {
        if (theme.background === "custom") body.style.setProperty(name, value);
        else body.style.removeProperty(name);
    }
}

let themeTimer;
// Only the swatch highlight is updated in place, so the color picker stays open while you drag.
function setTheme(change, { rebuild = false } = {}) {
    theme = normalizeTheme({ ...theme, ...change });
    applyTheme();
    if (rebuild) renderSettings();
    for (const swatch of document.querySelectorAll(".settings .swatch"))
        swatch.classList.toggle("active", swatch.dataset.color === theme.accent);
    // The color picker fires constantly while dragging; save once it settles.
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => window.rpc.setTheme(theme), 300);
}

function closeSettings() {
    document.querySelector(".settings")?.remove();
    document.getElementById("settings-button").classList.remove("open");
    document.removeEventListener("pointerdown", onOutsideSettings, true);
    document.removeEventListener("keydown", onSettingsKey, true);
}

function onOutsideSettings(event) {
    if (!event.target.closest(".settings, #settings-button")) closeSettings();
}

function onSettingsKey(event) {
    if (event.key === "Escape") closeSettings();
}

function renderSettings() {
    const existing = document.querySelector(".settings");
    if (!existing) return;
    const backgrounds = Object.entries(BACKGROUNDS)
        .filter(([id]) => id !== "glass" || glassSupported)
        .map(([value, { label }]) => ({ value, label }));
    const custom = h("input", {
        type: "color",
        value: theme.accent,
        onInput: () => setTheme({ accent: custom.value })
    });

    // Shown only for the background they belong to.
    const backgroundPicker = h("input", {
        type: "color",
        value: theme.backgroundColor,
        onInput: () => {
            backgroundSwatch.style.background = backgroundPicker.value;
            setTheme({ backgroundColor: backgroundPicker.value });
        }
    });
    const backgroundSwatch = h("span", { class: "custom-swatch", style: `background:${theme.backgroundColor}` }, backgroundPicker);
    const customRow = h("label", { class: "settings-row" }, backgroundSwatch, "Background color (dark colors keep text readable)");
    customRow.hidden = theme.background !== "custom";

    const glassValue = h("span", { class: "value", text: `${theme.glass}%` });
    const glassSlider = h("input", {
        class: "slider",
        type: "range",
        min: 0,
        max: 100,
        value: theme.glass,
        style: `--fill:${theme.glass}%`,
        onInput: () => {
            glassValue.textContent = `${glassSlider.value}%`;
            glassSlider.style.setProperty("--fill", `${glassSlider.value}%`);
            setTheme({ glass: Number(glassSlider.value) });
        }
    });
    const glassRow = h("label", { class: "settings-row" }, "See-through", glassSlider, glassValue);
    glassRow.hidden = theme.background !== "glass";

    const minimizeSwitch = h("button", {
        class: `switch${minimizeToTray ? " on" : ""}`,
        type: "button",
        title: "Minimize to the tray",
        onClick: () => {
            minimizeToTray = !minimizeToTray;
            minimizeSwitch.classList.toggle("on", minimizeToTray);
            window.rpc.setMinimizeToTray(minimizeToTray);
        }
    });

    existing.replaceChildren(
        h("h3", { text: "Appearance" }),
        h("div", { class: "field" },
            h("label", { text: "Accent color" }),
            h("div", { class: "swatches" }, ...ACCENTS.map(({ name, color }) => h("button", {
                class: `swatch${color === theme.accent ? " active" : ""}`,
                type: "button",
                title: name,
                "data-color": color,
                style: `--swatch:${color}`,
                onClick: () => {
                    custom.value = color;
                    setTheme({ accent: color });
                }
            }))),
            h("label", { class: "custom-color" }, h("span", { class: "custom-swatch" }, custom), "Pick any color"),
            h("div", { class: "hint", text: "The app icon follows this color. The taskbar picks it up the next time you open the app." })
        ),
        h("div", { class: "field" },
            h("label", { text: "Background" }),
            segmented(backgrounds, theme.background, value => {
                customRow.hidden = value !== "custom";
                glassRow.hidden = value !== "glass";
                setTheme({ background: value });
            }),
            customRow,
            glassRow
        ),
        h("div", { class: "field" },
            h("label", { text: "Text and UI size" }),
            segmented(SCALES, theme.scale, value => setTheme({ scale: value }))
        ),
        h("div", { class: "field" },
            h("label", { text: "Corners" }),
            segmented(CORNERS, theme.corners, value => setTheme({ corners: value }))
        ),
        h("div", { class: "settings-foot" },
            h("button", { class: "button ghost small", type: "button", onClick: () => setTheme(DEFAULT_THEME, { rebuild: true }) }, "Reset to red and black")
        ),
        h("h3", { text: "Window" }),
        h("div", { class: "settings-row settings-option" }, "Minimize button goes to the tray", minimizeSwitch)
    );
}

function toggleSettings() {
    if (document.querySelector(".settings")) return closeSettings();
    document.body.append(h("div", { class: "settings", role: "dialog", "aria-label": "Settings" }));
    document.getElementById("settings-button").classList.add("open");
    renderSettings();
    document.addEventListener("pointerdown", onOutsideSettings, true);
    document.addEventListener("keydown", onSettingsKey, true);
}

/* Live status */

function statusFor(preset) {
    if (!preset.active) return { cls: "off", text: "Off", long: "Turned off. Switch it on in the list to show it on Discord." };
    if (preset.kind === "site") {
        if (!bridge.browsers)
            return { cls: "error", text: "No extension", long: "Your browser's RPC Manager extension isn't connected. See below." };
        if (bridge.outdated)
            return { cls: "error", text: "Reload extension", long: "Your browser is running an older copy of the extension. See below." };
        if (!bridge.activities[preset.site])
            return { cls: "off", text: "Idle", long: `Nothing playing on ${siteName(preset)} right now. It shows up the moment a video plays.` };
    }
    if (presence.status.state !== "connected")
        return { cls: "off", text: "Waiting", long: "Waiting for Discord to open. It goes live as soon as Discord is running." };
    const live = presence.live[preset.id];
    switch (live?.state) {
        case "live": return { cls: "live", text: "Live", long: "Live on your Discord profile." };
        case "sending": return {
            cls: "sending",
            text: "Updating",
            long: live.limited
                ? "Waiting on Discord: it limits how often your status can change, so this can take up to about 30 seconds after a lot of changes."
                : "Sending your changes to Discord…"
        };
        case "error": return { cls: "error", text: "Problem", long: live.error };
        default: return { cls: "sending", text: "Starting", long: "Starting…" };
    }
}

const chip = status => h("span", { class: `chip ${status.cls}`, text: status.text });

/* Preset list */

const siteTile = site => h("div", { class: "site-tile" },
    SITES[site]?.icon ? h("img", { src: SITES[site].icon, alt: "", draggable: false }) : icon("globe"));

// Cards are kept and updated in place (not rebuilt), so a live update arriving
// mid-animation can't make the list jump or the thumbnails flash.
function renderList() {
    if (dragging) return;
    const list = document.getElementById("preset-list");
    if (!presets.length) {
        list.replaceChildren(h("li", { class: "empty", text: "No presets yet. Hit New to make one." }));
        return;
    }
    const existing = new Map([...list.children].filter(li => li.dataset.id).map(li => [li.dataset.id, li]));
    const activeIds = presets.filter(p => p.active).map(p => p.id);
    list.replaceChildren(...presets.map(preset => {
        const isSite = preset.kind === "site";
        const thumbSrc = isSite ? bridge.activities[preset.site]?.assets?.large_image : imageFor(preset, "large") ?? appFor(appIdOf(preset))?.icon;
        const kindText = isSite ? bridge.activities[preset.site]?.name ?? "Site" : TYPES.find(t => t.value === preset.type)?.label;
        const rank = activeIds.length > 1 && preset.active ? activeIds.indexOf(preset.id) + 1 : null;

        let card = existing.get(preset.id);
        if (!card) {
            card = h("li", { "data-id": preset.id });
            card.addEventListener("pointerdown", event => startDrag(event, card));
        }
        card.className = `preset-card${preset.id === selectedId ? " selected" : ""}`;

        // Keep the same thumbnail element while its picture stays the same.
        const thumbKey = thumbSrc ?? (isSite ? `tile:${preset.site}` : "icon");
        if (card.thumbKey !== thumbKey) {
            card.thumbKey = thumbKey;
            card.thumb = h("div", { class: "preset-thumb" },
                thumbSrc ? h("img", { src: thumbSrc, alt: "", draggable: false }) : isSite ? siteTile(preset.site) : icon("activity"));
        }
        card.replaceChildren(...[
            rank && h("span", { class: "rank", text: rank, title: rank === 1 ? "Shown first" : `Shown ${rank}${["", "st", "nd", "rd"][rank] ?? "th"}` }),
            card.thumb,
            h("div", { class: "preset-text" },
                h("div", { class: "preset-label", text: (isSite ? siteName(preset) : preset.label.trim()) || "Untitled preset" }),
                h("div", { class: "preset-sub" }, chip(statusFor(preset)), h("span", { text: `· ${kindText}` }))
            ),
            h("button", {
                class: `switch${preset.active ? " on" : ""}`,
                type: "button",
                title: preset.active ? "Turn off" : "Turn on",
                onClick: event => {
                    event.stopPropagation();
                    toggle(preset);
                }
            })
        ].filter(Boolean));
        return card;
    }));
}

function toggle(preset) {
    preset.active = !preset.active;
    if (preset.active) timing.delete(preset.id);
    save(true);
    renderList();
    renderPreview();
    if (preset.id === selectedId) renderStatusLine();
}

function select(id) {
    if (id === selectedId) return;
    selectedId = id;
    renderList();
    renderEditor(true);
    renderPreview();
}

/* Drag to reorder */

function startDrag(event, card) {
    if (event.button !== 0 || event.target.closest(".switch")) return;
    const preset = presets.find(p => p.id === card.dataset.id);
    if (!preset) return;
    const list = card.parentElement;
    const startY = event.clientY;
    // Keep getting the pointer even if it leaves the card or the window.
    card.setPointerCapture(event.pointerId);
    let items;
    let rects;
    let from;
    let to;
    let step;
    let moved = false;

    const move = e => {
        const dy = e.clientY - startY;
        if (!moved) {
            if (Math.abs(dy) < 5) return;
            moved = dragging = true;
            items = [...list.children];
            rects = items.map(item => item.getBoundingClientRect());
            from = to = items.indexOf(card);
            // Cards the dragged one passes move by its height plus the gap, whatever their own height.
            const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 6;
            step = rects[from].height + gap;
            card.classList.add("dragging");
            items.forEach(item => item !== card && item.classList.add("shifting"));
        }
        const min = rects[0].top - rects[from].top;
        const max = rects[rects.length - 1].bottom - rects[from].bottom;
        const offset = Math.min(Math.max(dy, min - 8), max + 8);
        card.style.transform = `translateY(${offset}px)`;

        const center = rects[from].top + rects[from].height / 2 + offset;
        to = from;
        items.forEach((item, i) => {
            if (item === card) return;
            const mid = rects[i].top + rects[i].height / 2;
            let shift = 0;
            if (i < from && center < mid) shift = step;
            if (i > from && center > mid) shift = -step;
            if (shift > 0) to--;
            if (shift < 0) to++;
            item.style.transform = shift ? `translateY(${shift}px)` : "";
        });
    };

    const up = event => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerup", up);
        card.removeEventListener("pointercancel", up);
        if (!moved) return event.type === "pointerup" && select(preset.id);

        const visualTop = card.getBoundingClientRect().top;
        // Settle every card where it is now, with no animation, before the list is reordered.
        for (const item of items) {
            item.classList.remove("shifting", "dragging");
            item.style.transform = "";
        }
        dragging = false;
        if (to !== from) {
            presets.splice(to, 0, ...presets.splice(from, 1));
            save(true);
        }
        renderList();
        renderPreview();
        // Glide the dropped card from where it was let go into its slot.
        const delta = visualTop - card.getBoundingClientRect().top;
        card.style.transform = `translateY(${delta}px)`;
        card.getBoundingClientRect();
        card.classList.add("shifting");
        card.style.transform = "";
        card.addEventListener("transitionend", () => card.classList.remove("shifting"), { once: true });
    };

    card.addEventListener("pointermove", move);
    card.addEventListener("pointerup", up);
    card.addEventListener("pointercancel", up);
}

/* Editor */

function segmented(options, value, onChange) {
    const thumb = h("span", { class: "thumb" });
    const wrap = h("div", { class: "segmented" }, thumb);
    const buttons = options.map(option => h("button", {
        type: "button",
        text: option.label,
        class: option.value === value ? "active" : "",
        onClick: () => {
            buttons.forEach(b => b.classList.toggle("active", b === button(option)));
            place();
            onChange(option.value);
        }
    }));
    const button = option => buttons[options.indexOf(option)];
    const place = () => {
        const active = buttons.find(b => b.classList.contains("active"));
        if (!active) return;
        thumb.style.left = `${active.offsetLeft}px`;
        thumb.style.width = `${active.offsetWidth}px`;
    };
    wrap.append(...buttons);
    new ResizeObserver(place).observe(wrap);
    return wrap;
}

// A labeled input bound to a preset field. `key` is also the error key from validate().
function field(preset, { key, label, placeholder, hint, number, get, set }) {
    const read = get ?? (() => preset[key]);
    const write = set ?? (value => { preset[key] = value; });
    const input = h("input", {
        type: number ? "number" : "text",
        value: read(),
        placeholder: placeholder ?? "",
        min: number ? 0 : undefined,
        spellcheck: false,
        onInput: () => {
            write(number ? Math.max(0, Math.floor(Number(input.value) || 0)) : input.value);
            edited();
        }
    });
    const hintEl = typeof hint === "string" ? h("div", { class: "hint", text: hint }) : hint;
    return h("div", { class: "field", "data-key": key },
        label && h("label", { text: label }),
        input,
        hintEl,
        h("div", { class: "error" })
    );
}

const panel = (iconName, title, ...children) =>
    h("section", { class: "panel" }, h("div", { class: "panel-title" }, icon(iconName), title), ...children);

function renderEditor(entering = false) {
    const editor = document.getElementById("editor");
    const preset = selected();
    refs = {};
    if (!preset) {
        editor.replaceChildren(h("div", { class: "editor-inner empty" },
            h("p", { text: presets.length ? "Pick a preset on the left to edit it." : "Make your first preset to get started." }),
            !presets.length && h("button", { class: "button primary", type: "button", onClick: createPreset }, icon("plus"), "New preset")
        ));
        return;
    }
    if (preset.kind === "site") return renderSiteEditor(preset, entering);

    const deleteButton = makeDeleteButton(preset, "Delete");

    const title = h("input", {
        class: "title-input",
        value: preset.label,
        placeholder: "Untitled preset",
        spellcheck: false,
        onInput: () => {
            preset.label = title.value;
            edited();
        }
    });
    refs.title = title;

    refs.appHint = h("div", { class: "hint" });
    refs.nameField = field(preset, { key: "name", label: "Name shown", hint: "What shows after \"Playing\" or \"Watching\"." });

    const partyPanel = panel("party", "Party",
        h("div", { class: "row" },
            field(preset, { key: "party", label: "Party size", number: true, get: () => preset.partySize || "", set: v => { preset.partySize = v; } }),
            field(preset, { key: "partyMax", label: "Out of", number: true, get: () => preset.partyMax || "", set: v => { preset.partyMax = v; } })
        ),
        h("div", { class: "field" }, h("div", { class: "hint", text: "Only shows on Playing activities, e.g. \"2 of 5\"." }))
    );
    partyPanel.hidden = preset.type !== 0;

    const durationField = h("div", { class: "field", "data-key": "progressSeconds" },
        h("label", { text: "Length (the bar starts over when it ends)" }),
        h("div", { class: "duration" },
            durationInput(preset, "minutes"), h("span", { text: "min" }),
            durationInput(preset, "seconds"), h("span", { text: "sec" })
        ),
        h("div", { class: "error" })
    );
    durationField.hidden = preset.timer !== "progress";
    const timerHint = h("div", { class: "hint" });
    const updateTimerHint = () => {
        timerHint.textContent = {
            none: "No timer.",
            activated: "Counts up from when you turned this preset on.",
            midnight: "Counts up from midnight, so it matches your clock.",
            progress: "A progress bar, like a video or song."
        }[preset.timer];
    };
    updateTimerHint();

    refs.statusLine = h("div", { class: "status-line" });

    const inner = h("div", { class: "editor-inner" },
        h("div", { class: "editor-head" },
            title,
            h("button", { class: "button ghost small", type: "button", onClick: () => duplicatePreset(preset) }, icon("copy"), "Duplicate"),
            deleteButton
        ),
        refs.statusLine,

        panel("app", "Application",
            h("div", { class: "row" },
                field(preset, { key: "appId", label: "Application ID (optional)", placeholder: "Built-in", hint: refs.appHint }),
                refs.nameField
            ),
            h("div", { class: "field" },
                h("label", { text: "Activity type" }),
                segmented(TYPES, preset.type, value => {
                    preset.type = value;
                    partyPanel.hidden = value !== 0;
                    edited();
                })
            )
        ),

        panel("text", "Text",
            h("div", { class: "row" },
                field(preset, { key: "details", label: "Details (first line)", placeholder: "What you're doing" }),
                field(preset, { key: "detailsUrl", label: "Details link", placeholder: "https://… (optional)" })
            ),
            h("div", { class: "row" },
                field(preset, { key: "state", label: "State (second line)", placeholder: "More info" }),
                field(preset, { key: "stateUrl", label: "State link", placeholder: "https://… (optional)" })
            ),
            h("div", { class: "field", "data-key": "statusDisplay" },
                h("label", { text: "Member list shows" }),
                segmented([
                    { value: "name", label: "Name" },
                    { value: "details", label: "Details" },
                    { value: "state", label: "State" }
                ], preset.statusDisplay, value => {
                    preset.statusDisplay = value;
                    edited();
                }),
                h("div", { class: "hint", text: "The one line under your name in member lists and DMs." }),
                h("div", { class: "error" })
            )
        ),

        panel("image", "Images",
            h("div", { class: "row three" },
                field(preset, { key: "largeImage", label: "Large image", placeholder: "https://i.imgur.com/… or asset name" }),
                field(preset, { key: "largeText", label: "Hover text" }),
                field(preset, { key: "largeUrl", label: "Click link", placeholder: "https://…" })
            ),
            h("div", { class: "row three" },
                field(preset, { key: "smallImage", label: "Small image", placeholder: "https://… or asset name" }),
                field(preset, { key: "smallText", label: "Hover text" }),
                field(preset, { key: "smallUrl", label: "Click link", placeholder: "https://…" })
            )
        ),

        panel("button", "Buttons",
            ...preset.buttons.map((button, i) => h("div", { class: "row" },
                field(preset, { key: `button${i}Label`, label: `Button ${i + 1}`, placeholder: "Label", get: () => button.label, set: v => { button.label = v; } }),
                field(preset, { key: `button${i}Url`, label: "Link", placeholder: "https://…", get: () => button.url, set: v => { button.url = v; } })
            )),
            h("div", { class: "field" }, h("div", { class: "hint", text: "Discord hides your own buttons from you. Everyone else sees them." }))
        ),

        panel("clock", "Timer",
            h("div", { class: "field" },
                segmented(TIMERS, preset.timer, value => {
                    preset.timer = value;
                    durationField.hidden = value !== "progress";
                    timing.delete(preset.id);
                    updateTimerHint();
                    edited();
                }),
                timerHint
            ),
            durationField
        ),

        partyPanel
    );

    mountEditor(inner, entering);
}

function makeDeleteButton(preset, label) {
    let armed;
    const button = h("button", {
        class: "button ghost small danger",
        type: "button",
        onClick: () => {
            if (armed) return deletePreset(preset);
            armed = setTimeout(() => {
                armed = null;
                button.classList.remove("confirm");
                button.lastChild.textContent = label;
            }, 3000);
            button.classList.add("confirm");
            button.lastChild.textContent = "Click again to remove";
        }
    }, icon("trash"), h("span", { text: label }));
    return button;
}

function mountEditor(inner, entering) {
    const editor = document.getElementById("editor");
    if (!entering) inner.style.animation = "none";
    const scroll = editor.scrollTop;
    editor.replaceChildren(inner);
    editor.scrollTop = entering ? 0 : scroll;

    updateAppHint();
    updateErrors();
    renderStatusLine();
}

// Only shown when the browser side isn't working: not installed or not connected, or an old copy.
function extensionProblemPanel() {
    if (bridge.browsers && !bridge.outdated) return null;
    if (bridge.outdated) {
        return panel("globe", "Reload the browser extension",
            h("p", { class: "lead", text: "Your browser is still running an older copy of the RPC Manager extension, so it may show the wrong things." }),
            h("ol", { class: "steps" },
                h("li", {}, "Open ", h("code", { text: "vivaldi://extensions" }), " (or chrome://, edge://, brave://extensions)."),
                h("li", {}, "Click the reload arrow on ", h("b", { text: "RPC Manager Bridge" }), "."),
                h("li", {}, "That's it: tabs you already have open pick it up on their own and keep playing.")
            )
        );
    }
    return panel("globe", "Browser extension isn't connected",
        h("p", { class: "lead", text: "Sites only show up while the RPC Manager extension is running in your browser. If it's already installed, it reconnects by itself within about 30 seconds. To install it:" }),
        h("ol", { class: "steps" },
            h("li", {}, "Open ", h("code", { text: "vivaldi://extensions" }), " (or chrome://, edge://, brave://extensions)."),
            h("li", {}, "Turn on ", h("b", { text: "Developer mode" }), " (top right)."),
            h("li", {}, "Click ", h("b", { text: "Load unpacked" }), " and choose this folder:")
        ),
        h("div", { class: "path-row" },
            h("code", { class: "path", text: extensionDir }),
            h("button", { class: "button small", type: "button", onClick: () => window.rpc.openExtensionFolder() }, icon("folder"), "Open folder")
        )
    );
}

// A site preset: what it shows is fixed by the site, so this is a description, an
// example (or what's playing right now), and a fix-it panel if the browser side is down.
function renderSiteEditor(preset, entering) {
    const site = SITES[preset.site];
    refs.statusLine = h("div", { class: "status-line" });
    const liveActivity = bridge.activities[preset.site];
    const now = Date.now();
    const example = site && {
        ...site.example,
        timestamps: { start: now + site.example.timestamps.start, end: now + site.example.timestamps.end }
    };

    const inner = h("div", { class: "editor-inner" },
        h("div", { class: "editor-head" },
            h("div", { class: "site-title" }, siteTile(preset.site), h("span", { text: siteName(preset) })),
            makeDeleteButton(preset, "Remove")
        ),
        refs.statusLine,
        extensionProblemPanel(),
        panel("activity", "What it shows",
            h("ul", { class: "shows" }, ...(site?.shows ?? []).map(line => h("li", { text: line }))),
            h("div", { class: "field" }, h("div", { class: "hint", text: "Only while a video is actually playing. Pausing, stopping or leaving the page clears it right away, and nothing shows while you browse." }))
        ),
        panel("image", liveActivity ? "Showing right now" : "Example",
            h("div", { class: "editor-preview" }, activityCard(activityView(liveActivity ?? example)))
        ),
        panel("globe", "Reads these sites",
            h("ul", { class: "sites" }, ...(site?.domains ?? []).map(domain => h("li", { text: domain })))
        )
    );
    mountEditor(inner, entering);
    renderTimers();
}

function durationInput(preset, part) {
    const input = h("input", {
        type: "number",
        min: 0,
        value: part === "minutes" ? Math.floor(preset.progressSeconds / 60) : preset.progressSeconds % 60,
        onInput: () => {
            const [minutes, seconds] = [...input.parentElement.querySelectorAll("input")].map(i => Math.max(0, Math.floor(Number(i.value) || 0)));
            preset.progressSeconds = minutes * 60 + seconds;
            timing.delete(preset.id);
            edited();
        }
    });
    return input;
}

function updateAppHint() {
    const preset = selected();
    if (!preset || !refs.appHint) return;
    const id = preset.appId.trim();
    const info = id ? appFor(id) : null;
    const nameInput = refs.nameField?.querySelector("input");
    if (nameInput) nameInput.placeholder = info?.name ?? "e.g. Minecraft";

    const portal = h("a", { class: "inline-link", text: "Developer Portal", onClick: () => window.rpc.openLink("https://discord.com/developers/applications") });
    refs.appHint.className = "hint";
    if (!id) refs.appHint.replaceChildren("Empty uses RPC Manager's built-in app, so no Developer Portal is needed. Paste your own app's ID only if you want its icon or uploaded art.");
    else if (!isAppId(id)) refs.appHint.replaceChildren("Make one in the ", portal, " and copy its ID, or leave this empty.");
    else if (apps.get(id) === "pending") refs.appHint.replaceChildren("Checking…");
    else if (info) {
        refs.appHint.className = "hint ok";
        refs.appHint.replaceChildren(h("span", { class: "app-badge" }, info.icon && h("img", { src: info.icon, alt: "" }), `Found "${info.name}"`));
    } else refs.appHint.replaceChildren("Couldn't look this app up. Check the ID in the ", portal, ".");
}

function updateErrors() {
    const preset = selected();
    if (!preset) return;
    const errors = validate(preset);
    for (const el of document.querySelectorAll("#editor .field[data-key]")) {
        const message = errors[el.dataset.key];
        el.classList.toggle("invalid", Boolean(message));
        el.querySelector(".error").textContent = message ?? "";
    }
}

function renderStatusLine() {
    const preset = selected();
    if (!preset || !refs.statusLine) return;
    const status = statusFor(preset);
    const problems = blockingErrors(validate(preset)).length;
    const text = preset.active && problems ? "Fix the highlighted fields to go live." : status.long;
    refs.statusLine.replaceChildren(chip(status), h("span", { class: status.cls === "error" || (preset.active && problems) ? "error-text" : "", text }));
}

// Called after any change in the editor.
function edited() {
    updateErrors();
    renderList();
    renderStatusLine();
    renderPreview();
    save();
}

/* Preset actions */

// A new site goes to the top, so it shows above your custom presets while it plays.
function addSite(site) {
    const preset = newSitePreset(site, SITES[site].name);
    presets.unshift(preset);
    save(true);
    selectedId = preset.id;
    renderList();
    renderEditor(true);
    renderPreview();
}

/* New button menu: a custom preset, or one of the sites */

function closeNewMenu() {
    document.querySelector(".menu")?.remove();
    document.removeEventListener("pointerdown", onOutsideMenu, true);
    document.removeEventListener("keydown", onMenuKey, true);
}

function onOutsideMenu(event) {
    if (!event.target.closest(".menu, #new-preset")) closeNewMenu();
}

function onMenuKey(event) {
    if (event.key === "Escape") closeNewMenu();
}

function toggleNewMenu() {
    if (document.querySelector(".menu")) return closeNewMenu();
    const added = new Set(presets.filter(p => p.kind === "site").map(p => p.site));
    const item = (content, onClick, disabled = false) => h("button", {
        class: "menu-item",
        type: "button",
        disabled,
        onClick: () => {
            closeNewMenu();
            onClick();
        }
    }, ...content);
    const menu = h("div", { class: "menu", role: "menu" },
        item([h("span", { class: "menu-icon" }, icon("plus")), h("span", { text: "Custom preset" })], createPreset),
        h("div", { class: "menu-heading", text: "Sites" }),
        ...Object.entries(SITES).map(([id, site]) => item(
            [siteTile(id), h("span", { text: site.name }), added.has(id) && h("span", { class: "menu-note", text: "Added" })],
            () => addSite(id),
            added.has(id)
        ))
    );
    document.querySelector(".sidebar-head").append(menu);
    document.addEventListener("pointerdown", onOutsideMenu, true);
    document.addEventListener("keydown", onMenuKey, true);
}

function createPreset() {
    // New presets use the built-in app; nothing is copied from another preset.
    const preset = newPreset();
    presets.push(preset);
    save(true);
    selectedId = preset.id;
    renderList();
    renderEditor(true);
    renderPreview();
    refs.title.focus();
    refs.title.select();
}

function duplicatePreset(preset) {
    const copy = newPreset({
        ...structuredClone(preset),
        id: crypto.randomUUID(),
        label: `${preset.label} copy`,
        active: false
    });
    presets.splice(presets.indexOf(preset) + 1, 0, copy);
    save(true);
    selectedId = copy.id;
    renderList();
    renderEditor(true);
    renderPreview();
}

function deletePreset(preset) {
    const index = presets.indexOf(preset);
    presets.splice(index, 1);
    timing.delete(preset.id);
    save(true);
    selectedId = presets[Math.min(index, presets.length - 1)]?.id ?? null;
    renderList();
    renderEditor(true);
    renderPreview();
}

/* Preview */

function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${String(minutes).padStart(2, "0")}:${seconds}`;
}

function renderTimer(view, el, now) {
    const stamps = view.stamps(now);
    if (!stamps) return el.replaceChildren();
    if (stamps.end) {
        const length = stamps.end - stamps.start;
        const done = Math.min(now - stamps.start, length);
        const existing = el.querySelector(".progress");
        if (existing) {
            existing.children[0].textContent = formatClock(done);
            existing.querySelector(".fill").style.width = `${(done / length) * 100}%`;
            existing.children[2].textContent = formatClock(length);
            return;
        }
        el.replaceChildren(h("div", { class: "progress" },
            h("span", { text: formatClock(done) }),
            h("div", { class: "track" }, h("div", { class: "fill", style: `width:${(done / length) * 100}%` })),
            h("span", { text: formatClock(length) })
        ));
    } else {
        el.replaceChildren(h("div", { class: "elapsed" }, icon("activity"), h("span", { text: formatClock(now - stamps.start) })));
    }
}

function renderTimers() {
    timers = timers.filter(t => t.el.isConnected);
    const now = Date.now();
    for (const { view, el } of timers) renderTimer(view, el, now);
}

const linked = (text, url, cls) => url.trim() && isLink(url)
    ? h("div", { class: cls }, h("a", { text, title: url, onClick: () => window.rpc.openLink(url.trim()) }))
    : h("div", { class: cls, text });

// A ready-made activity (what a site is playing, or a site's example) as the preview needs it.
function activityView(a) {
    return {
        verb: verbFor(a.type),
        name: a.name ?? "",
        details: a.details ?? "",
        detailsUrl: a.details_url ?? "",
        state: a.state ?? "",
        stateUrl: a.state_url ?? "",
        large: a.assets?.large_image,
        largeText: a.assets?.large_text ?? "",
        largeUrl: a.assets?.large_url ?? "",
        small: a.assets?.small_image,
        smallText: a.assets?.small_text ?? "",
        buttons: (a.buttons ?? []).map(b => ({ label: b.label, url: b.url ?? "" })),
        summary: a.name ?? "",
        stamps: () => a.timestamps
    };
}

// Everything the preview needs, from a preset or from what its site is playing.
function viewFor(preset) {
    if (preset.kind === "site") {
        const activity = bridge.activities[preset.site];
        return activity ? activityView(activity) : null;
    }
    const name = displayName(preset);
    const details = preset.details.trim();
    const state = preset.state.trim();
    const party = preset.type === 0 && preset.partySize > 0 && preset.partyMax >= preset.partySize ? ` (${preset.partySize} of ${preset.partyMax})` : "";
    return {
        verb: verbFor(preset.type),
        name,
        details,
        detailsUrl: preset.detailsUrl,
        state: state + party,
        stateUrl: preset.stateUrl,
        large: imageFor(preset, "large") ?? appFor(appIdOf(preset))?.icon,
        largeText: preset.largeText,
        largeUrl: preset.largeUrl,
        small: imageFor(preset, "small"),
        smallText: preset.smallText,
        buttons: preset.buttons.filter(b => b.label.trim()),
        summary: { details, state }[preset.statusDisplay] || name,
        stamps: now => timestampsFor(preset, previewTiming(preset), now)
    };
}

function activityCard(view, { selected = false, dim = false, onClick } = {}) {
    const timer = h("div");
    timers.push({ view, el: timer });
    const open = url => event => {
        event.stopPropagation();
        if (isLink(url)) window.rpc.openLink(url.trim());
    };
    return h("div", { class: `discord-card${selected ? " selected" : ""}${dim ? " dim" : ""}${onClick ? " clickable" : ""}`, onClick },
        h("div", { class: "heading", text: `${view.verb} ${view.name}` }),
        h("div", { class: "body" },
            h("div", { class: "art" },
                view.large
                    ? h("img", { class: "large", src: view.large, alt: "", title: view.largeText, onClick: open(view.largeUrl) })
                    : h("div", { class: "placeholder" }, icon("activity")),
                view.small && h("img", { class: "small", src: view.small, alt: "", title: view.smallText })
            ),
            h("div", { class: "lines" },
                view.details && linked(view.details, view.detailsUrl, "details"),
                view.state && linked(view.state, view.stateUrl, "state"),
                timer
            )
        ),
        view.buttons.length > 0 && h("div", { class: "discord-buttons" },
            ...view.buttons.map(b => h("button", { type: "button", text: b.label.trim(), title: b.url, onClick: open(b.url) })))
    );
}

// The whole profile as others see it: every active activity, newest (top of the list) first.
function renderPreview() {
    const container = document.getElementById("preview");
    const user = presence.status.user;
    const showing = presets
        .filter(p => p.active && !blockingErrors(validate(p)).length)
        .map(preset => ({ preset, view: viewFor(preset) }))
        .filter(s => s.view);
    const top = showing[0]?.view;
    const current = selected();

    const children = [h("div", { class: "preview-label", text: "Profile" })];
    if (showing.length) {
        children.push(...showing.map(({ preset, view }) =>
            activityCard(view, { selected: preset.id === selectedId, onClick: () => select(preset.id) })));
    } else {
        children.push(h("p", { class: "preview-empty", text: "No activities on your profile right now." }));
    }

    children.push(
        h("div", { class: "preview-label", text: "Member list" }),
        h("div", { class: "member" },
            h("div", { class: "avatar-wrap" },
                user ? h("img", { class: "avatar", src: avatarUrl(user), alt: "" }) : h("div", { class: "avatar" }),
                h("span", { class: "presence-dot" })
            ),
            h("div", { class: "who" },
                h("div", { class: "username", text: user ? (user.global_name || user.username) : "You" }),
                top ? h("div", { class: "activity" }, `${top.verb} `, h("b", { text: top.summary })) : h("div", { class: "activity", text: "No activity" })
            )
        )
    );

    // Editing a custom preset that isn't on the profile: show how it would look.
    // (A site that isn't playing simply isn't there, just like on Discord.)
    if (current?.kind === "preset" && !showing.some(s => s.preset === current)) {
        children.push(h("div", { class: "preview-label", text: current.active ? "Not showing yet: fix the highlighted fields" : "Off · how it would look" }),
            activityCard(viewFor(current), { dim: true }));
    }

    children.push(h("p", { class: "preview-note", text: "Games and Spotify that Discord adds by itself also appear on your real profile, newest on top." }));
    container.replaceChildren(...children);
    renderTimers();
}

/* Startup */

document.getElementById("new-preset").addEventListener("click", toggleNewMenu);
document.getElementById("settings-button").append(icon("gear"));
document.getElementById("settings-button").addEventListener("click", toggleSettings);

const initial = await window.rpc.getState();
presets = initial.presets;
presence = initial.presence;
bridge = initial.bridge;
extensionDir = initial.extensionDir;
minimizeToTray = initial.minimizeToTray;
theme = normalizeTheme(initial.theme);
glassSupported = initial.glassSupported;
applyTheme();
// The title-bar icon follows the accent color too.
const brandMark = document.querySelector(".brand-mark");
brandMark.src = initial.titleIcon;
window.rpc.onIcon(url => { brandMark.src = url; });
const updateButton = document.getElementById("update-button");
const showUpdate = version => {
    updateButton.hidden = !version;
    updateButton.title = `Installs version ${version} and opens RPC Manager again`;
};
updateButton.addEventListener("click", () => window.rpc.installUpdate());
showUpdate(initial.updateReady);
window.rpc.onUpdateReady(showUpdate);
selectedId = presets[0]?.id ?? null;

renderConnection();
renderList();
renderEditor(true);
renderPreview();

window.rpc.onPresence(snapshot => {
    const userChanged = snapshot.status.user?.id !== presence.status.user?.id;
    presence = snapshot;
    renderConnection();
    renderList();
    renderStatusLine();
    if (userChanged) renderPreview();
});

window.rpc.onBridge(snapshot => {
    const previous = bridge;
    bridge = snapshot;
    const connectionChanged = snapshot.browsers !== previous.browsers || snapshot.outdated !== previous.outdated;
    const changedSites = Object.keys(SITES).filter(site =>
        JSON.stringify(snapshot.activities[site]) !== JSON.stringify(previous.activities[site]));
    if (!connectionChanged && !changedSites.length) return;
    renderList();
    renderPreview();
    const current = selected();
    if (current?.kind === "site" && (connectionChanged || changedSites.includes(current.site))) renderEditor(false);
    else renderStatusLine();
});

setInterval(renderTimers, 1000);
