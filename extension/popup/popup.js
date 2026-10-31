function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

// Drops the connection to the app and makes a fresh one, then shows the result.
document.getElementById("refresh").addEventListener("click", () => {
    document.getElementById("status").textContent = "Reconnecting…";
    chrome.runtime.sendMessage({ type: "refresh" }, () => setTimeout(showStatus, 1500));
});

function showStatus() {
    chrome.runtime.sendMessage({ type: "status" }, render);
}

// Reloading has to be done from the extensions page; this opens it on this extension.
document.getElementById("open-extensions").addEventListener("click", () => {
    chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});

function render({ connected, activities, outdated }) {
    document.getElementById("now").replaceChildren();
    document.getElementById("update").hidden = !outdated;
    document.getElementById("dot").classList.toggle("on", connected);
    document.getElementById("status").textContent = connected
        ? "Connected to the RPC Manager app"
        : "RPC Manager app isn't running";

    const now = document.getElementById("now");
    const playing = Object.values(activities ?? {}).filter(Boolean);
    if (!playing.length) {
        now.append(el("div", "empty", "Nothing playing on your sites right now."));
        return;
    }
    for (const activity of playing) {
        const card = el("div", "card");
        const image = el("img");
        image.src = activity.assets?.large_image ?? "../icon.png";
        const lines = el("div", "lines");
        lines.append(
            el("div", "top", `Watching ${activity.name}`),
            el("div", "details", activity.details),
            el("div", "state", activity.state)
        );
        card.append(image, lines);
        now.append(card);
    }
}

showStatus();
