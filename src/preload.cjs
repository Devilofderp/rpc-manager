const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rpc", {
    getState: () => ipcRenderer.invoke("state:get"),
    setPresets: presets => ipcRenderer.send("presets:set", presets),
    setTheme: theme => ipcRenderer.send("theme:set", theme),
    appInfo: appId => ipcRenderer.invoke("app:info", appId),
    openLink: url => ipcRenderer.send("link:open", url),
    openExtensionFolder: () => ipcRenderer.send("extension:open"),
    installUpdate: () => ipcRenderer.send("update:install"),
    onBridge: callback => ipcRenderer.on("bridge:change", (_event, snapshot) => callback(snapshot)),
    onIcon: callback => ipcRenderer.on("icon:change", (_event, url) => callback(url)),
    onPresence: callback => ipcRenderer.on("presence:change", (_event, snapshot) => callback(snapshot)),
    onUpdateReady: callback => ipcRenderer.on("update:ready", (_event, version) => callback(version))
});
