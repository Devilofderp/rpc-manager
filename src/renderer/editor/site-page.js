// A site's page in the editor.
import { makeDeleteButton, mountEditor, refs } from "./editor.js";
import { panel } from "../controls.js";
import { h, icon } from "../dom.js";
import { siteTile } from "../presets/list.js";
import { activityCard, activityView } from "../preview/card.js";
import { renderTimers } from "../preview/timers.js";
import { siteName, state } from "../state.js";
import { SITES } from "../../shared/sites.js";

// Only shown when the browser side isn't working: not installed or not connected, or an old copy.
function extensionProblemPanel() {
    if (state.bridge.browsers && !state.bridge.outdated) return null;
    if (state.bridge.outdated) {
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
            h("code", { class: "path", text: state.extensionDir }),
            h("button", { class: "button small", type: "button", onClick: () => window.rpc.openExtensionFolder() }, icon("folder"), "Open folder")
        )
    );
}

// A site preset: what it shows is fixed by the site, so this is a description, an
// example (or what's playing right now), and a fix-it panel if the browser side is down.
export function renderSiteEditor(preset, entering) {
    const site = SITES[preset.site];
    refs.statusLine = h("div", { class: "status-line" });
    const liveActivity = state.bridge.activities[preset.site];
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
