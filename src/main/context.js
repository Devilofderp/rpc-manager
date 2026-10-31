// The app's long-lived pieces, created once in main.js and shared by the modules around it.
export const ctx = {
    win: null,
    tray: null,
    store: null,
    presence: null,
    bridge: null,
    icons: null,
    updates: null,
    quitting: false
};
