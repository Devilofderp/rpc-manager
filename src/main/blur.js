// Windows' blur-behind for the Glass background, through SetWindowCompositionAttribute
// (via koffi). Unlike Windows 11's Acrylic backdrop, it stays on while the window
// isn't focused, and it doesn't lag when the window is dragged.
import koffi from "koffi";

const WCA_ACCENT_POLICY = 19;
const ACCENT_DISABLED = 0;
const ACCENT_ENABLE_BLURBEHIND = 3;

let setAttribute;
let accentSize;

function api() {
    if (setAttribute !== undefined) return setAttribute;
    try {
        const user32 = koffi.load("user32.dll");
        const AccentPolicy = koffi.struct("ACCENT_POLICY", {
            AccentState: "int32",
            AccentFlags: "int32",
            GradientColor: "uint32",
            AnimationId: "int32"
        });
        const Data = koffi.struct("WINDOWCOMPOSITIONATTRIBDATA", {
            Attrib: "int32",
            pvData: koffi.pointer(AccentPolicy),
            cbData: "size_t"
        });
        accentSize = koffi.sizeof(AccentPolicy);
        setAttribute = user32.func("__stdcall", "SetWindowCompositionAttribute", "bool", ["intptr_t", koffi.pointer(Data)]);
    } catch (err) {
        console.error("blur isn't available", err);
        setAttribute = null;
    }
    return setAttribute;
}

// Turns the blur behind the window on or off. Returns false if Windows didn't take it.
export function setBlur(win, on) {
    if (process.platform !== "win32") return false;
    const call = api();
    if (!call) return false;
    const handle = win.getNativeWindowHandle();
    const hwnd = handle.length >= 8 ? handle.readBigInt64LE(0) : BigInt(handle.readInt32LE(0));
    return call(hwnd, {
        Attrib: WCA_ACCENT_POLICY,
        pvData: { AccentState: on ? ACCENT_ENABLE_BLURBEHIND : ACCENT_DISABLED, AccentFlags: 0, GradientColor: 0, AnimationId: 0 },
        cbData: accentSize
    });
}
