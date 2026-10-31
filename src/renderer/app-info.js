// What Discord says about an application: its name, icon and uploaded art.
import { renderPreview } from "./preview/preview.js";
import { renderList } from "./presets/list.js";
import { selected } from "./state.js";
import { updateAppHint } from "./editor/editor.js";
import { appIdOf } from "../shared/activity.js";

export const isAppId = value => /^\d{17,20}$/.test(value.trim());
export const isLink = value => /^https?:\/\//i.test(value.trim());

export const apps = new Map();     // appId -> info, null (not found) or "pending"

export function appFor(appId) {
    const id = appId.trim();
    if (!isAppId(id)) return null;
    if (!apps.has(id)) {
        apps.set(id, "pending");
        window.rpc.appInfo(id).then(info => {
            apps.set(id, info);
            renderList();
            if (selected() && appIdOf(selected()) === id) {
                updateAppHint();
                renderPreview();
            }
        });
    }
    const info = apps.get(id);
    return info === "pending" ? null : info;
}

// The built-in app has no name of yours, so only your own app can stand in for an empty name.
export const displayName = preset => preset.name.trim() || (preset.appId.trim() && appFor(preset.appId)?.name) || "(type a name)";

export function imageFor(preset, size) {
    const value = preset[`${size}Image`].trim();
    if (!value) return null;
    if (isLink(value)) return value;
    return appFor(appIdOf(preset))?.assets?.[value] ?? null;
}
