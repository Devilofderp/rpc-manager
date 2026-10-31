// Drag to reorder.
import { renderList, select } from "./list.js";
import { renderPreview } from "../preview/preview.js";
import { save, state } from "../state.js";

export let dragging = false;       // the list isn't re-rendered mid-drag

export function startDrag(event, card) {
    if (event.button !== 0 || event.target.closest(".switch")) return;
    const preset = state.presets.find(p => p.id === card.dataset.id);
    if (!preset) return;
    const list = card.parentElement;
    const startY = event.clientY;
    // Keep getting the pointer even if it leaves the card or the window.
    card.setPointerCapture(event.pointerId);
    let items;
    let rects;
    let from;
    let to;
    let step;
    let moved = false;

    const move = e => {
        const dy = e.clientY - startY;
        if (!moved) {
            if (Math.abs(dy) < 5) return;
            moved = dragging = true;
            items = [...list.children];
            rects = items.map(item => item.getBoundingClientRect());
            from = to = items.indexOf(card);
            // Cards the dragged one passes move by its height plus the gap, whatever their own height.
            const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 6;
            step = rects[from].height + gap;
            card.classList.add("dragging");
            items.forEach(item => item !== card && item.classList.add("shifting"));
        }
        const min = rects[0].top - rects[from].top;
        const max = rects[rects.length - 1].bottom - rects[from].bottom;
        const offset = Math.min(Math.max(dy, min - 8), max + 8);
        card.style.transform = `translateY(${offset}px)`;

        const center = rects[from].top + rects[from].height / 2 + offset;
        to = from;
        items.forEach((item, i) => {
            if (item === card) return;
            const mid = rects[i].top + rects[i].height / 2;
            let shift = 0;
            if (i < from && center < mid) shift = step;
            if (i > from && center > mid) shift = -step;
            if (shift > 0) to--;
            if (shift < 0) to++;
            item.style.transform = shift ? `translateY(${shift}px)` : "";
        });
    };

    const up = event => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerup", up);
        card.removeEventListener("pointercancel", up);
        if (!moved) return event.type === "pointerup" && select(preset.id);

        const visualTop = card.getBoundingClientRect().top;
        // Settle every card where it is now, with no animation, before the list is reordered.
        for (const item of items) {
            item.classList.remove("shifting", "dragging");
            item.style.transform = "";
        }
        dragging = false;
        if (to !== from) {
            state.presets.splice(to, 0, ...state.presets.splice(from, 1));
            save(true);
        }
        renderList();
        renderPreview();
        // Glide the dropped card from where it was let go into its slot.
        const delta = visualTop - card.getBoundingClientRect().top;
        card.style.transform = `translateY(${delta}px)`;
        card.getBoundingClientRect();
        card.classList.add("shifting");
        card.style.transform = "";
        card.addEventListener("transitionend", () => card.classList.remove("shifting"), { once: true });
    };

    card.addEventListener("pointermove", move);
    card.addEventListener("pointerup", up);
    card.addEventListener("pointercancel", up);
}
