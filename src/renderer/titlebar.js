// The title bar: the app icon, the Discord pill and the update button.
import { h } from "./dom.js";
import { state } from "./state.js";

export function avatarUrl(user) {
    if (!user) return null;
    if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
    return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
}

function connectionText({ state: connection, blocked, modded, via }) {
    if (connection === "connected") return `Connected through ${via}`;
    if (connection !== "offline") return "Looking for Discord…";
    if (blocked) return "Discord is running as admin: reopen it normally";
    return modded ? `${modded.name} is open: ${modded.fix}` : "Discord isn't running";
}

export function renderConnection() {
    const { status } = state.presence;
    const el = document.getElementById("connection");
    el.className = `connection ${status.state}`;
    if (status.user) {
        el.replaceChildren(
            h("img", { class: "avatar", src: avatarUrl(status.user), alt: "" }),
            h("span", { text: `Connected as ${status.user.global_name || status.user.username}` })
        );
    } else {
        el.replaceChildren(h("span", { class: "dot" }), h("span", { text: connectionText(status) }));
    }
}

// The title-bar icon follows the accent color too.
export function setUpBrandMark(titleIcon) {
    const brandMark = document.querySelector(".brand-mark");
    brandMark.src = titleIcon;
    window.rpc.onIcon(url => { brandMark.src = url; });
}

export function setUpUpdateButton(version) {
    const button = document.getElementById("update-button");
    const show = version => {
        button.hidden = !version;
        button.title = `Installs version ${version} and opens RPC Manager again`;
    };
    button.addEventListener("click", () => window.rpc.installUpdate());
    show(version);
    window.rpc.onUpdateReady(show);
}
