// App appearance, chosen in Settings. Stored in presets.json under prefs.theme.

export const DEFAULT_THEME = {
    accent: "#ff2a40",
    background: "oled",
    backgroundColor: "#101018", // used when background is "custom"
    glass: 50,                  // how see-through Glass is, 0-100
    scale: 1,                   // text and UI size
    corners: "rounded"
};

export const ACCENTS = [
    { name: "Red", color: "#ff2a40" },
    { name: "Crimson", color: "#d1123f" },
    { name: "Orange", color: "#ff7a1a" },
    { name: "Gold", color: "#f5c02a" },
    { name: "Lime", color: "#9be22d" },
    { name: "Green", color: "#2fd27a" },
    { name: "Teal", color: "#1fc7b6" },
    { name: "Sky", color: "#2fb4ff" },
    { name: "Blue", color: "#4c74ff" },
    { name: "Violet", color: "#8b6bff" },
    { name: "Purple", color: "#b34dff" },
    { name: "Pink", color: "#ff4fb8" },
    { name: "Rose", color: "#ff7a9c" },
    { name: "White", color: "#e9e9ef" }
];

// The window's own background behind the page (Glass shows a blur of what's behind the window).
export const BACKGROUNDS = {
    oled: { label: "OLED black", windowColor: "#000000" },
    dark: { label: "Dark gray", windowColor: "#131318" },
    custom: { label: "Custom" },
    glass: { label: "Glass", windowColor: "#00000000" }
};

export const SCALES = [
    { value: 0.9, label: "90%" },
    { value: 1, label: "100%" },
    { value: 1.1, label: "110%" },
    { value: 1.25, label: "125%" }
];

// How round corners are, as a multiplier on every rounded corner in the app.
export const CORNERS = [
    { value: "rounded", label: "Rounded", factor: 1 },
    { value: "slight", label: "Slight", factor: 0.45 },
    { value: "square", label: "Square", factor: 0 }
];

const isHex = value => /^#[0-9a-f]{6}$/i.test(value ?? "");

export function normalizeTheme(theme = {}) {
    return {
        accent: isHex(theme.accent) ? theme.accent.toLowerCase() : DEFAULT_THEME.accent,
        background: theme.background in BACKGROUNDS ? theme.background : DEFAULT_THEME.background,
        backgroundColor: isHex(theme.backgroundColor) ? theme.backgroundColor.toLowerCase() : DEFAULT_THEME.backgroundColor,
        glass: Number.isFinite(theme.glass) ? Math.min(100, Math.max(0, Math.round(theme.glass))) : DEFAULT_THEME.glass,
        scale: SCALES.some(s => s.value === theme.scale) ? theme.scale : DEFAULT_THEME.scale,
        corners: CORNERS.some(c => c.value === theme.corners) ? theme.corners : DEFAULT_THEME.corners
    };
}

export const windowColorFor = theme =>
    theme.background === "custom" ? theme.backgroundColor : BACKGROUNDS[theme.background].windowColor;
