// Adding, copying and removing presets.
import { refs, renderEditor } from "../editor/editor.js";
import { renderList } from "./list.js";
import { renderPreview } from "../preview/preview.js";
import { timing } from "../preview/timers.js";
import { save, state } from "../state.js";
import { newPreset, newSitePreset } from "../../shared/activity.js";
import { SITES } from "../../shared/sites.js";

function show(id) {
    state.selectedId = id;
    renderList();
    renderEditor(true);
    renderPreview();
}

// A new site goes to the top, so it shows above your custom presets while it plays.
export function addSite(site) {
    const preset = newSitePreset(site, SITES[site].name);
    state.presets.unshift(preset);
    save(true);
    show(preset.id);
}

export function createPreset() {
    // New presets use the built-in app; nothing is copied from another preset.
    const preset = newPreset();
    state.presets.push(preset);
    save(true);
    show(preset.id);
    refs.title.focus();
    refs.title.select();
}

export function duplicatePreset(preset) {
    const copy = newPreset({
        ...structuredClone(preset),
        id: crypto.randomUUID(),
        label: `${preset.label} copy`,
        active: false
    });
    state.presets.splice(state.presets.indexOf(preset) + 1, 0, copy);
    save(true);
    show(copy.id);
}

export function deletePreset(preset) {
    const index = state.presets.indexOf(preset);
    state.presets.splice(index, 1);
    timing.delete(preset.id);
    save(true);
    show(state.presets[Math.min(index, state.presets.length - 1)]?.id ?? null);
}
