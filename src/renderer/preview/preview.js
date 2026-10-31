// The right side of the window: your profile as others see it.
import { activityCard, viewFor } from "./card.js";
import { renderTimers } from "./timers.js";
import { h } from "../dom.js";
import { select } from "../presets/list.js";
import { selected, state } from "../state.js";
import { avatarUrl } from "../titlebar.js";
import { blockingErrors, validate } from "../../shared/activity.js";

// The whole profile as others see it: every active activity, newest (top of the list) first.
export function renderPreview() {
    const container = document.getElementById("preview");
    const user = state.presence.status.user;
    const showing = state.presets
        .filter(p => p.active && !blockingErrors(validate(p)).length)
        .map(preset => ({ preset, view: viewFor(preset) }))
        .filter(s => s.view);
    const top = showing[0]?.view;
    const current = selected();

    const children = [h("div", { class: "preview-label", text: "Profile" })];
    if (showing.length) {
        children.push(...showing.map(({ preset, view }) =>
            activityCard(view, { selected: preset.id === state.selectedId, onClick: () => select(preset.id) })));
    } else {
        children.push(h("p", { class: "preview-empty", text: "No activities on your profile right now." }));
    }

    children.push(
        h("div", { class: "preview-label", text: "Member list" }),
        h("div", { class: "member" },
            h("div", { class: "avatar-wrap" },
                user ? h("img", { class: "avatar", src: avatarUrl(user), alt: "" }) : h("div", { class: "avatar" }),
                h("span", { class: "presence-dot" })
            ),
            h("div", { class: "who" },
                h("div", { class: "username", text: user ? (user.global_name || user.username) : "You" }),
                top ? h("div", { class: "activity" }, `${top.verb} `, h("b", { text: top.summary })) : h("div", { class: "activity", text: "No activity" })
            )
        )
    );

    // Editing a custom preset that isn't on the profile: show how it would look.
    // (A site that isn't playing simply isn't there, just like on Discord.)
    if (current?.kind === "preset" && !showing.some(s => s.preset === current)) {
        children.push(h("div", { class: "preview-label", text: current.active ? "Not showing yet: fix the highlighted fields" : "Off · how it would look" }),
            activityCard(viewFor(current), { dim: true }));
    }

    children.push(h("p", { class: "preview-note", text: "Games and Spotify that Discord adds by itself also appear on your real profile, newest on top." }));
    container.replaceChildren(...children);
    renderTimers();
}
