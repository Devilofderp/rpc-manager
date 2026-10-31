// Startup: loads what the app knows, draws the window and listens for changes.
import { icon } from "./dom.js";
import { renderEditor, renderStatusLine } from "./editor/editor.js";
import { renderList } from "./presets/list.js";
import { toggleNewMenu } from "./presets/new-menu.js";
import { renderPreview } from "./preview/preview.js";
import { renderTimers } from "./preview/timers.js";
import { loadSettings, toggleSettings } from "./settings.js";
import { selected, state } from "./state.js";
import { loadTheme } from "./theme.js";
import { renderConnection, setUpBrandMark, setUpUpdateButton } from "./titlebar.js";
import { SITES } from "../shared/sites.js";

document.getElementById("new-preset").addEventListener("click", toggleNewMenu);
document.getElementById("settings-button").append(icon("gear"));
document.getElementById("settings-button").addEventListener("click", toggleSettings);

const initial = await window.rpc.getState();
state.presets = initial.presets;
state.presence = initial.presence;
state.bridge = initial.bridge;
state.extensionDir = initial.extensionDir;
loadSettings(initial);
loadTheme(initial.theme);
setUpBrandMark(initial.titleIcon);
setUpUpdateButton(initial.updateReady);
state.selectedId = state.presets[0]?.id ?? null;

renderConnection();
renderList();
renderEditor(true);
renderPreview();

window.rpc.onPresence(snapshot => {
    const userChanged = snapshot.status.user?.id !== state.presence.status.user?.id;
    state.presence = snapshot;
    renderConnection();
    renderList();
    renderStatusLine();
    if (userChanged) renderPreview();
});

window.rpc.onBridge(snapshot => {
    const previous = state.bridge;
    state.bridge = snapshot;
    const connectionChanged = snapshot.browsers !== previous.browsers || snapshot.outdated !== previous.outdated;
    const changedSites = Object.keys(SITES).filter(site =>
        JSON.stringify(snapshot.activities[site]) !== JSON.stringify(previous.activities[site]));
    if (!connectionChanged && !changedSites.length) return;
    renderList();
    renderPreview();
    const current = selected();
    if (current?.kind === "site" && (connectionChanged || changedSites.includes(current.site))) renderEditor(false);
    else renderStatusLine();
});

setInterval(renderTimers, 1000);
