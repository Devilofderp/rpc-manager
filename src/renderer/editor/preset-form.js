// The form for a custom preset.
import { edited, makeDeleteButton, mountEditor, refs } from "./editor.js";
import { field, panel, segmented } from "../controls.js";
import { h, icon } from "../dom.js";
import { duplicatePreset } from "../presets/actions.js";
import { timing } from "../preview/timers.js";
import { TIMERS, TYPES } from "../../shared/activity.js";

export function renderPresetForm(preset, entering) {
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
