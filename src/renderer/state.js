// What the window currently knows, shared by every part of the page.
import { SITES } from "../shared/sites.js";

export const state = {
    presets: [],
    selectedId: null,
    presence: { status: { state: "connecting" }, live: {} },
    bridge: { browsers: 0, outdated: false, activities: {} },
    extensionDir: ""
};

export const selected = () => state.presets.find(p => p.id === state.selectedId);

export const siteName = preset => SITES[preset.site]?.name ?? preset.label;

let saveTimer;
export function save(now = false) {
    clearTimeout(saveTimer);
    if (now) window.rpc.setPresets(state.presets);
    else saveTimer = setTimeout(() => window.rpc.setPresets(state.presets), 350);
}
