// The list of presets on the left.
import { appFor, imageFor } from "../app-info.js";
import { h, icon } from "../dom.js";
import { renderEditor, renderStatusLine } from "../editor/editor.js";
import { dragging, startDrag } from "./drag.js";
import { chip, statusFor } from "./status.js";
import { renderPreview } from "../preview/preview.js";
import { timing } from "../preview/timers.js";
import { save, siteName, state } from "../state.js";
import { appIdOf, TYPES } from "../../shared/activity.js";
import { SITES } from "../../shared/sites.js";

export const siteTile = site => h("div", { class: "site-tile" },
    SITES[site]?.icon ? h("img", { src: SITES[site].icon, alt: "", draggable: false }) : icon("globe"));

// Cards are kept and updated in place (not rebuilt), so a live update arriving
// mid-animation can't make the list jump or the thumbnails flash.
export function renderList() {
    if (dragging) return;
    const list = document.getElementById("preset-list");
    if (!state.presets.length) {
        list.replaceChildren(h("li", { class: "empty", text: "No presets yet. Hit New to make one." }));
        return;
    }
    const existing = new Map([...list.children].filter(li => li.dataset.id).map(li => [li.dataset.id, li]));
    const activeIds = state.presets.filter(p => p.active).map(p => p.id);
    list.replaceChildren(...state.presets.map(preset => {
        const isSite = preset.kind === "site";
        const thumbSrc = isSite ? state.bridge.activities[preset.site]?.assets?.large_image : imageFor(preset, "large") ?? appFor(appIdOf(preset))?.icon;
        const kindText = isSite ? state.bridge.activities[preset.site]?.name ?? "Site" : TYPES.find(t => t.value === preset.type)?.label;
        const rank = activeIds.length > 1 && preset.active ? activeIds.indexOf(preset.id) + 1 : null;

        let card = existing.get(preset.id);
        if (!card) {
            card = h("li", { "data-id": preset.id });
            card.addEventListener("pointerdown", event => startDrag(event, card));
        }
        card.className = `preset-card${preset.id === state.selectedId ? " selected" : ""}`;

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
    if (preset.id === state.selectedId) renderStatusLine();
}

export function select(id) {
    if (id === state.selectedId) return;
    state.selectedId = id;
    renderList();
    renderEditor(true);
    renderPreview();
}
