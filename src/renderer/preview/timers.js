// The elapsed time and progress bars in the preview, ticked once a second.
import { h, icon } from "../dom.js";

export const timing = new Map();   // preview timer state per preset
let timers = [];                   // { view, el } for every timer on screen

export const trackTimer = (view, el) => timers.push({ view, el });

export function previewTiming(preset) {
    const now = Date.now();
    let state = timing.get(preset.id);
    if (!state) timing.set(preset.id, state = { activatedAt: now, loopStart: now });
    if (preset.timer === "progress" && now >= state.loopStart + preset.progressSeconds * 1000) state.loopStart = now;
    return state;
}

function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${String(minutes).padStart(2, "0")}:${seconds}`;
}

function renderTimer(view, el, now) {
    const stamps = view.stamps(now);
    if (!stamps) return el.replaceChildren();
    if (stamps.end) {
        const length = stamps.end - stamps.start;
        const done = Math.min(now - stamps.start, length);
        const existing = el.querySelector(".progress");
        if (existing) {
            existing.children[0].textContent = formatClock(done);
            existing.querySelector(".fill").style.width = `${(done / length) * 100}%`;
            existing.children[2].textContent = formatClock(length);
            return;
        }
        el.replaceChildren(h("div", { class: "progress" },
            h("span", { text: formatClock(done) }),
            h("div", { class: "track" }, h("div", { class: "fill", style: `width:${(done / length) * 100}%` })),
            h("span", { text: formatClock(length) })
        ));
    } else {
        el.replaceChildren(h("div", { class: "elapsed" }, icon("activity"), h("span", { text: formatClock(now - stamps.start) })));
    }
}

export function renderTimers() {
    timers = timers.filter(t => t.el.isConnected);
    const now = Date.now();
    for (const { view, el } of timers) renderTimer(view, el, now);
}
