// Applies the chosen look to the page. Stored by the app in presets.json under prefs.theme.
import { renderSettings } from "./settings.js";
import { CORNERS, DEFAULT_THEME, normalizeTheme } from "../shared/theme.js";

export let theme = DEFAULT_THEME;

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
export function setTheme(change, { rebuild = false } = {}) {
    theme = normalizeTheme({ ...theme, ...change });
    applyTheme();
    if (rebuild) renderSettings();
    for (const swatch of document.querySelectorAll(".settings .swatch"))
        swatch.classList.toggle("active", swatch.dataset.color === theme.accent);
    // The color picker fires constantly while dragging; save once it settles.
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => window.rpc.setTheme(theme), 300);
}

export function loadTheme(saved) {
    theme = normalizeTheme(saved);
    applyTheme();
}
