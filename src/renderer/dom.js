// Small helpers for building the page.

const ICONS = {
    app: '<rect x="2.5" y="2.5" width="11" height="11" rx="3"/><path d="M6 8h4M8 6v4"/>',
    text: '<path d="M3 4h10M3 8h10M3 12h6"/>',
    image: '<rect x="2" y="3" width="12" height="10" rx="2"/><circle cx="6" cy="6.5" r="1.2"/><path d="m3 12 3.5-3.5 2.5 2.5 2-2 3 3"/>',
    button: '<rect x="2" y="4.5" width="12" height="7" rx="2.5"/><path d="M6 8h4"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>',
    party: '<circle cx="6" cy="6" r="2.2"/><circle cx="11" cy="6.5" r="1.7"/><path d="M2.5 13c.5-2.2 2-3.4 3.5-3.4s3 1.2 3.5 3.4M10 9.6c1.6 0 2.9 1 3.4 3"/>',
    copy: '<rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 5V4a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 3 4v5.5A1.5 1.5 0 0 0 4.5 11H5"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1.5 1.5 0 0 0 1.5 1.3h2.8a1.5 1.5 0 0 0 1.5-1.3l.6-8.2"/>',
    activity: '<rect x="2.5" y="3.5" width="11" height="9" rx="2"/><path d="m6.5 6.3 3.2 1.7-3.2 1.7z"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.7 1.8 2.5 3.8 2.5 6S9.7 12.2 8 14C6.3 12.2 5.5 10.2 5.5 8S6.3 3.8 8 2z"/>',
    folder: '<path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h2.6l1.5 1.5H12a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 12 13H4a1.5 1.5 0 0 1-1.5-1.5z"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M1.8 8h1.6M12.6 8h1.6M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/><circle cx="8" cy="8" r="4.6"/>'
};

export const icon = name => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.innerHTML = ICONS[name];
    return svg;
};

export function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null) continue;
        if (key === "class") el.className = value;
        else if (key === "text") el.textContent = value;
        else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key in el && key !== "list") el[key] = value;
        else el.setAttribute(key, value);
    }
    el.append(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
    return el;
}
