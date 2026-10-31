// The New button's menu: a custom preset, or one of the sites.
import { h, icon } from "../dom.js";
import { addSite, createPreset } from "./actions.js";
import { siteTile } from "./list.js";
import { state } from "../state.js";
import { SITES } from "../../shared/sites.js";

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

export function toggleNewMenu() {
    if (document.querySelector(".menu")) return closeNewMenu();
    const added = new Set(state.presets.filter(p => p.kind === "site").map(p => p.site));
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
