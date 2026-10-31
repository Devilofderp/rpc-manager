// The Settings popover behind the gear button.
import { segmented } from "./controls.js";
import { h } from "./dom.js";
import { setTheme, theme } from "./theme.js";
import { ACCENTS, BACKGROUNDS, CORNERS, DEFAULT_THEME, SCALES } from "../shared/theme.js";

let glassSupported = false;
let minimizeToTray = false;

export function loadSettings(initial) {
    glassSupported = initial.glassSupported;
    minimizeToTray = initial.minimizeToTray;
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

export function renderSettings() {
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

export function toggleSettings() {
    if (document.querySelector(".settings")) return closeSettings();
    document.body.append(h("div", { class: "settings", role: "dialog", "aria-label": "Settings" }));
    document.getElementById("settings-button").classList.add("open");
    renderSettings();
    document.addEventListener("pointerdown", onOutsideSettings, true);
    document.addEventListener("keydown", onSettingsKey, true);
}
