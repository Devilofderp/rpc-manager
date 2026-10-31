// A close copy of Discord's activity card, and the data it's drawn from.
import { previewTiming, trackTimer } from "./timers.js";
import { appFor, displayName, imageFor, isLink } from "../app-info.js";
import { h, icon } from "../dom.js";
import { state } from "../state.js";
import { appIdOf, timestampsFor, verbFor } from "../../shared/activity.js";

const linked = (text, url, cls) => url.trim() && isLink(url)
    ? h("div", { class: cls }, h("a", { text, title: url, onClick: () => window.rpc.openLink(url.trim()) }))
    : h("div", { class: cls, text });

// A ready-made activity (what a site is playing, or a site's example) as the preview needs it.
export function activityView(a) {
    return {
        verb: verbFor(a.type),
        name: a.name ?? "",
        details: a.details ?? "",
        detailsUrl: a.details_url ?? "",
        state: a.state ?? "",
        stateUrl: a.state_url ?? "",
        large: a.assets?.large_image,
        largeText: a.assets?.large_text ?? "",
        largeUrl: a.assets?.large_url ?? "",
        small: a.assets?.small_image,
        smallText: a.assets?.small_text ?? "",
        buttons: (a.buttons ?? []).map(b => ({ label: b.label, url: b.url ?? "" })),
        summary: a.name ?? "",
        stamps: () => a.timestamps
    };
}

// Everything the preview needs, from a preset or from what its site is playing.
export function viewFor(preset) {
    if (preset.kind === "site") {
        const activity = state.bridge.activities[preset.site];
        return activity ? activityView(activity) : null;
    }
    const name = displayName(preset);
    const details = preset.details.trim();
    const stateLine = preset.state.trim();
    const party = preset.type === 0 && preset.partySize > 0 && preset.partyMax >= preset.partySize ? ` (${preset.partySize} of ${preset.partyMax})` : "";
    return {
        verb: verbFor(preset.type),
        name,
        details,
        detailsUrl: preset.detailsUrl,
        state: stateLine + party,
        stateUrl: preset.stateUrl,
        large: imageFor(preset, "large") ?? appFor(appIdOf(preset))?.icon,
        largeText: preset.largeText,
        largeUrl: preset.largeUrl,
        small: imageFor(preset, "small"),
        smallText: preset.smallText,
        buttons: preset.buttons.filter(b => b.label.trim()),
        summary: { details, state: stateLine }[preset.statusDisplay] || name,
        stamps: now => timestampsFor(preset, previewTiming(preset), now)
    };
}

export function activityCard(view, { selected = false, dim = false, onClick } = {}) {
    const timer = h("div");
    trackTimer(view, timer);
    const open = url => event => {
        event.stopPropagation();
        if (isLink(url)) window.rpc.openLink(url.trim());
    };
    return h("div", { class: `discord-card${selected ? " selected" : ""}${dim ? " dim" : ""}${onClick ? " clickable" : ""}`, onClick },
        h("div", { class: "heading", text: `${view.verb} ${view.name}` }),
        h("div", { class: "body" },
            h("div", { class: "art" },
                view.large
                    ? h("img", { class: "large", src: view.large, alt: "", title: view.largeText, onClick: open(view.largeUrl) })
                    : h("div", { class: "placeholder" }, icon("activity")),
                view.small && h("img", { class: "small", src: view.small, alt: "", title: view.smallText })
            ),
            h("div", { class: "lines" },
                view.details && linked(view.details, view.detailsUrl, "details"),
                view.state && linked(view.state, view.stateUrl, "state"),
                timer
            )
        ),
        view.buttons.length > 0 && h("div", { class: "discord-buttons" },
            ...view.buttons.map(b => h("button", { type: "button", text: b.label.trim(), title: b.url, onClick: open(b.url) })))
    );
}
