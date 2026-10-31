// The middle of the window: one page for the selected preset.
import { renderPresetForm } from "./preset-form.js";
import { renderSiteEditor } from "./site-page.js";
import { appFor, apps, isAppId } from "../app-info.js";
import { h, icon } from "../dom.js";
import { createPreset, deletePreset } from "../presets/actions.js";
import { renderList } from "../presets/list.js";
import { chip, statusFor } from "../presets/status.js";
import { renderPreview } from "../preview/preview.js";
import { save, selected, state } from "../state.js";
import { blockingErrors, validate } from "../../shared/activity.js";

export let refs = {};              // elements of the current editor that update in place

export function renderEditor(entering = false) {
    const editor = document.getElementById("editor");
    const preset = selected();
    refs = {};
    if (!preset) {
        editor.replaceChildren(h("div", { class: "editor-inner empty" },
            h("p", { text: state.presets.length ? "Pick a preset on the left to edit it." : "Make your first preset to get started." }),
            !state.presets.length && h("button", { class: "button primary", type: "button", onClick: createPreset }, icon("plus"), "New preset")
        ));
        return;
    }
    if (preset.kind === "site") return renderSiteEditor(preset, entering);
    renderPresetForm(preset, entering);
}

export function makeDeleteButton(preset, label) {
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

export function mountEditor(inner, entering) {
    const editor = document.getElementById("editor");
    if (!entering) inner.style.animation = "none";
    const scroll = editor.scrollTop;
    editor.replaceChildren(inner);
    editor.scrollTop = entering ? 0 : scroll;

    updateAppHint();
    updateErrors();
    renderStatusLine();
}

export function updateAppHint() {
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

export function renderStatusLine() {
    const preset = selected();
    if (!preset || !refs.statusLine) return;
    const status = statusFor(preset);
    const problems = blockingErrors(validate(preset)).length;
    const text = preset.active && problems ? "Fix the highlighted fields to go live." : status.long;
    refs.statusLine.replaceChildren(chip(status), h("span", { class: status.cls === "error" || (preset.active && problems) ? "error-text" : "", text }));
}

// Called after any change in the editor.
export function edited() {
    updateErrors();
    renderList();
    renderStatusLine();
    renderPreview();
    save();
}
