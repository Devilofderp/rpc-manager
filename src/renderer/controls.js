// Form controls shared by the editor and Settings.
import { h, icon } from "./dom.js";
import { edited } from "./editor/editor.js";

export function segmented(options, value, onChange) {
    const thumb = h("span", { class: "thumb" });
    const wrap = h("div", { class: "segmented" }, thumb);
    const buttons = options.map(option => h("button", {
        type: "button",
        text: option.label,
        class: option.value === value ? "active" : "",
        onClick: () => {
            buttons.forEach(b => b.classList.toggle("active", b === button(option)));
            place();
            onChange(option.value);
        }
    }));
    const button = option => buttons[options.indexOf(option)];
    const place = () => {
        const active = buttons.find(b => b.classList.contains("active"));
        if (!active) return;
        thumb.style.left = `${active.offsetLeft}px`;
        thumb.style.width = `${active.offsetWidth}px`;
    };
    wrap.append(...buttons);
    new ResizeObserver(place).observe(wrap);
    return wrap;
}

// A labeled input bound to a preset field. `key` is also the error key from validate().
export function field(preset, { key, label, placeholder, hint, number, get, set }) {
    const read = get ?? (() => preset[key]);
    const write = set ?? (value => { preset[key] = value; });
    const input = h("input", {
        type: number ? "number" : "text",
        value: read(),
        placeholder: placeholder ?? "",
        min: number ? 0 : undefined,
        spellcheck: false,
        onInput: () => {
            write(number ? Math.max(0, Math.floor(Number(input.value) || 0)) : input.value);
            edited();
        }
    });
    const hintEl = typeof hint === "string" ? h("div", { class: "hint", text: hint }) : hint;
    return h("div", { class: "field", "data-key": key },
        label && h("label", { text: label }),
        input,
        hintEl,
        h("div", { class: "error" })
    );
}

export const panel = (iconName, title, ...children) =>
    h("section", { class: "panel" }, h("div", { class: "panel-title" }, icon(iconName), title), ...children);
